"""
Protocol and Treatment Plan API endpoints.

Includes both:
- DB-stored ProtocolTemplate CRUD (existing)
- SOPHIA engine protocol library (566+ NHS protocols) for browsing/searching
"""
import json
from typing import List, Optional
from uuid import UUID
from datetime import datetime, date, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models import (
    ProtocolTemplate,
    TreatmentPlan,
    TreatmentCycle,
    DrugAdministration,
    Appointment,
    AppointmentStatus,
    Patient,
    Doctor,
    User,
    PlanStatus,
    CycleStatus,
)
from app.schemas import (
    ProtocolTemplateCreate,
    ProtocolTemplateResponse,
    TreatmentPlanCreate,
    TreatmentPlanUpdate,
    TreatmentPlanResponse,
    TreatmentCycleCreate,
    TreatmentCycleUpdate,
    TreatmentCycleResponse,
    DischargeSummaryResponse,
    DrugAdministrationUpdate,
    DrugAdministrationResponse,
)
from app.schemas.treatment import (
    CycleCompletionResponse, SophiaProtocolDrugsResponse,
    PreChemoLabsInput, LabSafetyResult, PreChemoLabsResponse,
    DoseRecalculationRequest, DoseRecalculationResponse,
    TimelineItem, TimelineResponse,
    CycleCostUpdate, CycleCostDetail, TreatmentCostResponse,
)
from app.models.medication import TakeHomeMedication
from app.services.discharge_summary import generate_discharge_summary
from app.api.deps import get_current_user, allow_doctors, allow_medical_staff, allow_nurses
from app.services.sophia import (
    list_protocols as sophia_list_protocols,
    get_protocol_detail as sophia_get_protocol_detail,
    get_protocol_categories as sophia_get_protocol_categories,
)

router = APIRouter(tags=["Protocols & Treatment"])


# =============================================================================
# SOPHIA PROTOCOL LIBRARY (566+ NHS protocols)
# =============================================================================

@router.get("/sophia-protocols")
async def list_sophia_protocols(
    search: Optional[str] = Query(None, description="Search by code, name, indication, or drug"),
    category: Optional[str] = Query(None, description="Filter by disease category"),
    current_user: User = Depends(get_current_user),
):
    """List all SOPHIA protocol library entries. Used by the protocol selector dropdown."""
    return sophia_list_protocols(search=search, category=category)


@router.get("/sophia-protocols/categories")
async def get_sophia_categories(
    current_user: User = Depends(get_current_user),
):
    """Get list of protocol categories with counts."""
    return sophia_get_protocol_categories()


@router.get("/sophia-protocols/{protocol_code}")
async def get_sophia_protocol(
    protocol_code: str,
    current_user: User = Depends(get_current_user),
):
    """Get detailed protocol information from SOPHIA library."""
    detail = sophia_get_protocol_detail(protocol_code)
    if not detail:
        raise HTTPException(status_code=404, detail=f"Protocol not found: {protocol_code}")
    return detail


@router.get("/sophia-protocols/{protocol_code}/drugs", response_model=SophiaProtocolDrugsResponse)
async def get_sophia_protocol_drugs(
    protocol_code: str,
    current_user: User = Depends(get_current_user),
):
    """Get all drugs in a SOPHIA protocol grouped by category."""
    detail = sophia_get_protocol_detail(protocol_code)
    if not detail:
        raise HTTPException(status_code=404, detail=f"Protocol not found: {protocol_code}")
    return {
        "protocol_code": detail.get("protocol_code"),
        "protocol_name": detail.get("protocol_name"),
        "core_drugs": detail.get("drugs", []),
        "pre_medications": detail.get("pre_medications", []),
        "take_home_medicines": detail.get("take_home_medicines", []),
        "rescue_medications": detail.get("rescue_medications", []),
    }


# Protocol Templates
@router.get("/protocols", response_model=List[ProtocolTemplateResponse])
async def list_protocols(
    cancer_type: Optional[str] = None,
    is_active: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(allow_medical_staff),
):
    """List all protocol templates."""
    query = select(ProtocolTemplate).where(ProtocolTemplate.is_active == is_active)
    
    if cancer_type:
        query = query.where(ProtocolTemplate.cancer_types.contains([cancer_type]))
    
    result = await db.execute(query)
    protocols = result.scalars().all()
    
    return protocols


# =============================================================================
# TREATMENT CALENDAR
# =============================================================================

@router.get("/treatment-plans/{plan_id}/calendar")
async def get_treatment_calendar(
    plan_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get calendar view of a treatment plan.
    Returns all cycle days with drug schedules, marked by type.
    """
    from app.schemas.treatment import CalendarDaySchema, TreatmentCalendarResponse

    result = await db.execute(select(TreatmentPlan).where(TreatmentPlan.id == plan_id))
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Treatment plan not found")

    # Get cycles
    cycles_result = await db.execute(
        select(TreatmentCycle)
        .where(TreatmentCycle.treatment_plan_id == plan_id)
        .order_by(TreatmentCycle.cycle_number)
    )
    cycles = cycles_result.scalars().all()

    # Get appointments for this patient
    appts_result = await db.execute(
        select(Appointment).where(Appointment.patient_id == plan.patient_id)
    )
    appointments = appts_result.scalars().all()
    appts_by_date = {}
    for a in appointments:
        d = str(a.scheduled_date)
        appts_by_date.setdefault(d, []).append({
            "id": str(a.id),
            "type": a.appointment_type.value if hasattr(a.appointment_type, 'value') else str(a.appointment_type),
            "time": str(a.scheduled_time) if a.scheduled_time else None,
            "status": a.status.value if hasattr(a.status, 'value') else str(a.status),
        })

    # Parse protocol data
    protocol = plan.custom_protocol or {}
    chemo_drugs = protocol.get("chemotherapy_drugs") or protocol.get("drugs") or []
    take_home = protocol.get("take_home_medicines") or protocol.get("take_home_medications") or []
    cycle_length = protocol.get("cycle_length_days") or 21

    # Build calendar days
    calendar_days = []
    next_treatment = None
    current_cycle_num = None
    today = date.today()

    for cycle in cycles:
        cycle_start = cycle.scheduled_date
        if not cycle_start:
            continue

        cycle_num = cycle.cycle_number
        cycle_status = cycle.status.value if hasattr(cycle.status, 'value') else str(cycle.status)

        # Track current/next cycle
        if cycle_start <= today and cycle_status in ("scheduled", "approved", "pre_assessment"):
            current_cycle_num = cycle_num
        if cycle_start > today and next_treatment is None:
            next_treatment = cycle_start

        # Find treatment days (from chemo drugs)
        treatment_days = set()
        drug_by_day = {}
        for drug in chemo_drugs:
            days = drug.get("days") or [1]
            drug_info = {
                "name": drug.get("drug_name") or drug.get("drugName", ""),
                "dose": drug.get("calculated_dose") or drug.get("calculatedDose") or drug.get("dose", 0),
                "unit": drug.get("calculated_dose_unit") or drug.get("calculatedDoseUnit") or drug.get("unit", "mg"),
                "route": drug.get("route", ""),
            }
            for d in days:
                treatment_days.add(d)
                drug_by_day.setdefault(d, []).append(drug_info)

        # Find take-home days
        takehome_days = set()
        takehome_by_day = {}
        for drug in take_home:
            days = drug.get("days") or []
            drug_info = {
                "name": drug.get("drug_name") or drug.get("drugName", ""),
                "dose": drug.get("calculated_dose") or drug.get("calculatedDose") or drug.get("dose", 0),
                "unit": drug.get("calculated_dose_unit") or drug.get("calculatedDoseUnit") or drug.get("unit", "mg"),
                "route": drug.get("route", ""),
            }
            for d in days:
                takehome_days.add(d)
                takehome_by_day.setdefault(d, []).append(drug_info)

        # Generate days for this cycle
        effective_length = cycle_length or 21
        for day_num in range(1, effective_length + 1):
            cal_date = cycle_start + timedelta(days=day_num - 1)
            date_str = str(cal_date)

            if day_num in treatment_days:
                day_type = "treatment"
                drugs = drug_by_day.get(day_num, [])
            elif day_num in takehome_days:
                day_type = "take_home"
                drugs = takehome_by_day.get(day_num, [])
            elif day_num == 1:
                day_type = "lab"  # Pre-chemo labs typically day 1
                drugs = []
            else:
                day_type = "rest"
                drugs = []

            calendar_days.append(CalendarDaySchema(
                date=cal_date,
                day_in_cycle=day_num,
                cycle_number=cycle_num,
                day_type=day_type,
                cycle_status=cycle_status,
                drugs=drugs,
                appointments=appts_by_date.get(date_str, []),
            ))

    # If no cycles exist yet, generate from plan data
    if not cycles and plan.start_date:
        planned = plan.planned_cycles or 6
        for c in range(1, planned + 1):
            cycle_start = plan.start_date + timedelta(days=(c - 1) * (cycle_length or 21))
            if c == 1 or cycle_start > today:
                if next_treatment is None and cycle_start >= today:
                    next_treatment = cycle_start

            effective_length = cycle_length or 21
            for day_num in range(1, effective_length + 1):
                cal_date = cycle_start + timedelta(days=day_num - 1)
                day_type = "treatment" if day_num == 1 else "rest"
                calendar_days.append(CalendarDaySchema(
                    date=cal_date,
                    day_in_cycle=day_num,
                    cycle_number=c,
                    day_type=day_type,
                    cycle_status="scheduled",
                    drugs=[],
                ))

    return TreatmentCalendarResponse(
        plan_id=plan.id,
        protocol_name=plan.protocol_name or "Treatment Plan",
        cycle_length_days=cycle_length or 21,
        total_cycles=plan.planned_cycles,
        completed_cycles=plan.completed_cycles or 0,
        current_cycle=current_cycle_num,
        next_treatment_date=next_treatment,
        calendar_days=calendar_days,
    )


@router.get("/protocols/{protocol_id}", response_model=ProtocolTemplateResponse)
async def get_protocol(
    protocol_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(allow_medical_staff),
):
    """Get protocol template by ID."""
    result = await db.execute(
        select(ProtocolTemplate).where(ProtocolTemplate.id == protocol_id)
    )
    protocol = result.scalar_one_or_none()
    
    if not protocol:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Protocol not found",
        )
    
    return protocol


@router.post("/protocols", response_model=ProtocolTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_protocol(
    protocol_data: ProtocolTemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(allow_doctors),
):
    """Create a new protocol template."""
    protocol = ProtocolTemplate(
        name=protocol_data.name,
        full_name=protocol_data.full_name,
        cancer_types=protocol_data.cancer_types,
        cycle_days=protocol_data.cycle_days,
        total_cycles=protocol_data.total_cycles,
        drugs=[d.model_dump() for d in protocol_data.drugs],
        pre_medications=[m.model_dump() for m in protocol_data.pre_medications],
        post_medications=[m.model_dump() for m in protocol_data.post_medications],
        required_labs=protocol_data.required_labs,
        monitoring_parameters=protocol_data.monitoring_parameters,
        dose_modification_rules=[r.model_dump() for r in protocol_data.dose_modification_rules],
        common_side_effects=protocol_data.common_side_effects,
        serious_side_effects=protocol_data.serious_side_effects,
        reference_guidelines=protocol_data.reference_guidelines,
    )
    db.add(protocol)
    await db.commit()
    await db.refresh(protocol)
    
    return protocol


# Treatment Plans
@router.get("/treatment-plans", response_model=List[TreatmentPlanResponse])
async def list_treatment_plans(
    patient_id: Optional[UUID] = None,
    status: Optional[PlanStatus] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List treatment plans. Patients can only see their own plans."""
    from app.models import UserRole
    
    query = select(TreatmentPlan)
    
    # If patient, only show their own plans
    if current_user.role == UserRole.PATIENT:
        result = await db.execute(select(Patient).where(Patient.user_id == current_user.id))
        patient = result.scalar_one_or_none()
        if patient:
            query = query.where(TreatmentPlan.patient_id == patient.id)
        else:
            return []  # No patient profile yet
    elif patient_id:
        query = query.where(TreatmentPlan.patient_id == patient_id)
    
    if status:
        query = query.where(TreatmentPlan.status == status)
    
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    plans = result.scalars().all()
    
    return plans


@router.post("/treatment-plans", response_model=TreatmentPlanResponse, status_code=status.HTTP_201_CREATED)
async def create_treatment_plan(
    plan_data: TreatmentPlanCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(allow_doctors),
):
    """Create a new treatment plan."""
    # Verify patient exists
    result = await db.execute(select(Patient).where(Patient.id == plan_data.patient_id))
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found",
        )
    
    # Get doctor ID
    result = await db.execute(select(Doctor).where(Doctor.user_id == current_user.id))
    doctor = result.scalar_one_or_none()
    
    plan = TreatmentPlan(
        patient_id=plan_data.patient_id,
        protocol_template_id=plan_data.protocol_template_id,
        protocol_name=plan_data.protocol_name,
        custom_protocol=plan_data.custom_protocol,
        start_date=plan_data.start_date,
        planned_cycles=plan_data.planned_cycles,
        opd_notes=plan_data.opd_notes,
        created_by_doctor_id=doctor.id if doctor else None,
        status=PlanStatus.DRAFT,
    )
    db.add(plan)
    await db.commit()
    await db.refresh(plan)
    
    return plan


@router.get("/treatment-plans/{plan_id}", response_model=TreatmentPlanResponse)
async def get_treatment_plan(
    plan_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get treatment plan by ID."""
    result = await db.execute(
        select(TreatmentPlan)
        .options(selectinload(TreatmentPlan.cycles))
        .where(TreatmentPlan.id == plan_id)
    )
    plan = result.scalar_one_or_none()
    
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Treatment plan not found",
        )
    
    return plan


@router.put("/treatment-plans/{plan_id}", response_model=TreatmentPlanResponse)
async def update_treatment_plan(
    plan_id: UUID,
    plan_data: TreatmentPlanUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(allow_doctors),
):
    """Update treatment plan."""
    result = await db.execute(select(TreatmentPlan).where(TreatmentPlan.id == plan_id))
    plan = result.scalar_one_or_none()
    
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Treatment plan not found",
        )
    
    update_data = plan_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(plan, field, value)
    
    await db.commit()
    await db.refresh(plan)
    
    return plan


@router.post("/treatment-plans/{plan_id}/approve-opd", response_model=TreatmentPlanResponse)
async def approve_opd(
    plan_id: UUID,
    notes: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(allow_doctors),
):
    """Approve treatment plan (OPD doctor)."""
    result = await db.execute(select(TreatmentPlan).where(TreatmentPlan.id == plan_id))
    plan = result.scalar_one_or_none()
    
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Treatment plan not found",
        )
    
    # Get doctor ID
    result = await db.execute(select(Doctor).where(Doctor.user_id == current_user.id))
    doctor = result.scalar_one_or_none()
    
    plan.opd_approved_by = doctor.id if doctor else None
    plan.opd_approved_at = datetime.utcnow()
    plan.opd_notes = notes
    plan.status = PlanStatus.PENDING_DAYCARE_APPROVAL
    
    await db.commit()
    await db.refresh(plan)
    
    return plan


@router.post("/treatment-plans/{plan_id}/approve-daycare", response_model=TreatmentPlanResponse)
async def approve_daycare(
    plan_id: UUID,
    notes: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(allow_doctors),
):
    """Approve treatment plan (Day Care doctor)."""
    result = await db.execute(select(TreatmentPlan).where(TreatmentPlan.id == plan_id))
    plan = result.scalar_one_or_none()
    
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Treatment plan not found",
        )
    
    # Get doctor ID
    result = await db.execute(select(Doctor).where(Doctor.user_id == current_user.id))
    doctor = result.scalar_one_or_none()
    
    plan.daycare_approved_by = doctor.id if doctor else None
    plan.daycare_approved_at = datetime.utcnow()
    plan.daycare_notes = notes
    plan.status = PlanStatus.APPROVED
    
    await db.commit()
    await db.refresh(plan)
    
    return plan


# Treatment Cycles
@router.get("/treatment-plans/{plan_id}/cycles", response_model=List[TreatmentCycleResponse])
async def list_cycles(
    plan_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all cycles for a treatment plan."""
    result = await db.execute(
        select(TreatmentCycle)
        .where(TreatmentCycle.treatment_plan_id == plan_id)
        .order_by(TreatmentCycle.cycle_number)
    )
    cycles = result.scalars().all()
    
    return cycles


@router.post("/treatment-plans/{plan_id}/cycles", response_model=TreatmentCycleResponse, status_code=status.HTTP_201_CREATED)
async def create_cycle(
    plan_id: UUID,
    cycle_data: TreatmentCycleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(allow_medical_staff),
):
    """Create a new treatment cycle."""
    # Verify plan exists
    result = await db.execute(select(TreatmentPlan).where(TreatmentPlan.id == plan_id))
    plan = result.scalar_one_or_none()
    
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Treatment plan not found",
        )
    
    cycle = TreatmentCycle(
        treatment_plan_id=plan_id,
        cycle_number=cycle_data.cycle_number,
        scheduled_date=cycle_data.scheduled_date,
    )
    db.add(cycle)
    await db.commit()
    await db.refresh(cycle)
    
    # Create drug administrations based on protocol
    if plan.custom_protocol and "drugs" in plan.custom_protocol:
        for drug in plan.custom_protocol["drugs"]:
            drug_admin = DrugAdministration(
                cycle_id=cycle.id,
                drug_name=drug.get("drug_name", ""),
                planned_dose=drug.get("calculated_dose", drug.get("dose_per_m2", 0)),
                unit=drug.get("unit", "mg"),
                route=drug.get("route", "IV"),
                planned_duration_mins=drug.get("infusion_duration_mins"),
            )
            db.add(drug_admin)
        await db.commit()
    
    return cycle


@router.get("/cycles/{cycle_id}", response_model=TreatmentCycleResponse)
async def get_cycle(
    cycle_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get cycle by ID."""
    result = await db.execute(
        select(TreatmentCycle)
        .options(selectinload(TreatmentCycle.drug_administrations))
        .where(TreatmentCycle.id == cycle_id)
    )
    cycle = result.scalar_one_or_none()
    
    if not cycle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cycle not found",
        )
    
    return cycle


@router.put("/cycles/{cycle_id}", response_model=TreatmentCycleResponse)
async def update_cycle(
    cycle_id: UUID,
    cycle_data: TreatmentCycleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(allow_medical_staff),
):
    """Update treatment cycle."""
    result = await db.execute(select(TreatmentCycle).where(TreatmentCycle.id == cycle_id))
    cycle = result.scalar_one_or_none()
    
    if not cycle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cycle not found",
        )
    
    update_data = cycle_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(cycle, field, value)
    
    await db.commit()
    await db.refresh(cycle)
    
    return cycle


@router.post("/cycles/{cycle_id}/approve", response_model=TreatmentCycleResponse)
async def approve_cycle(
    cycle_id: UUID,
    notes: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(allow_doctors),
):
    """Approve cycle for treatment."""
    result = await db.execute(select(TreatmentCycle).where(TreatmentCycle.id == cycle_id))
    cycle = result.scalar_one_or_none()
    
    if not cycle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cycle not found",
        )
    
    # Get doctor ID
    result = await db.execute(select(Doctor).where(Doctor.user_id == current_user.id))
    doctor = result.scalar_one_or_none()
    
    cycle.daycare_doctor_id = doctor.id if doctor else None
    cycle.approved_at = datetime.utcnow()
    cycle.approval_notes = notes
    cycle.status = CycleStatus.APPROVED
    
    await db.commit()
    await db.refresh(cycle)
    
    return cycle


@router.post("/cycles/{cycle_id}/start", response_model=TreatmentCycleResponse)
async def start_cycle(
    cycle_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(allow_medical_staff),
):
    """Start treatment cycle."""
    result = await db.execute(select(TreatmentCycle).where(TreatmentCycle.id == cycle_id))
    cycle = result.scalar_one_or_none()
    
    if not cycle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cycle not found",
        )
    
    # Pre-chemo labs gate (Feature 1)
    if not cycle.pre_chemo_labs or not isinstance(cycle.pre_chemo_labs, dict) or len(cycle.pre_chemo_labs) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pre-chemo labs must be submitted before starting treatment",
        )

    # Require at minimum neutrophils and platelets
    required_params = ["neutrophils", "platelets"]
    missing = [p for p in required_params if p not in cycle.pre_chemo_labs or cycle.pre_chemo_labs[p] is None]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Required lab parameters missing: {', '.join(missing)}. At minimum, neutrophils and platelets must be submitted.",
        )

    # Check for blocked lab values
    _, can_proceed, _ = validate_labs(cycle.pre_chemo_labs)
    if not can_proceed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Treatment blocked due to unsafe lab values. Review pre-chemo labs.",
        )

    if cycle.status not in (CycleStatus.APPROVED, CycleStatus.SCHEDULED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cycle must be scheduled or approved before starting",
        )
    
    cycle.started_at = datetime.utcnow()
    cycle.status = CycleStatus.IN_PROGRESS

    # Auto-update linked appointment to checked_in
    appt_result = await db.execute(
        select(Appointment).where(Appointment.cycle_id == cycle_id)
    )
    linked_appt = appt_result.scalar_one_or_none()
    if linked_appt and linked_appt.status != AppointmentStatus.COMPLETED:
        linked_appt.status = AppointmentStatus.IN_PROGRESS
        if not linked_appt.checked_in_at:
            linked_appt.checked_in_at = datetime.utcnow()

    await db.commit()
    await db.refresh(cycle)
    
    return cycle


@router.post("/cycles/{cycle_id}/complete", response_model=CycleCompletionResponse)
async def complete_cycle(
    cycle_id: UUID,
    discharge_notes: Optional[str] = None,
    follow_up_instructions: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(allow_medical_staff),
):
    """Complete treatment cycle and auto-generate discharge summary."""
    result = await db.execute(select(TreatmentCycle).where(TreatmentCycle.id == cycle_id))
    cycle = result.scalar_one_or_none()

    if not cycle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cycle not found",
        )

    cycle.completed_at = datetime.utcnow()
    cycle.status = CycleStatus.COMPLETED
    cycle.follow_up_instructions = follow_up_instructions

    # Auto-update linked appointment to completed
    appt_result = await db.execute(
        select(Appointment).where(Appointment.cycle_id == cycle_id)
    )
    linked_appt = appt_result.scalar_one_or_none()
    if linked_appt and linked_appt.status != AppointmentStatus.COMPLETED:
        linked_appt.status = AppointmentStatus.COMPLETED
        linked_appt.checked_out_at = datetime.utcnow()

    # Update completed cycles count in treatment plan
    result = await db.execute(
        select(TreatmentPlan).where(TreatmentPlan.id == cycle.treatment_plan_id)
    )
    plan = result.scalar_one_or_none()
    if plan:
        plan.completed_cycles += 1
        if plan.completed_cycles >= plan.planned_cycles:
            plan.status = PlanStatus.COMPLETED

    await db.commit()
    await db.refresh(cycle)

    # Auto-generate discharge summary
    try:
        summary = await generate_discharge_summary(db, cycle_id)
        # Store the full summary as JSON in discharge_notes
        cycle.discharge_notes = json.dumps(summary)
        await db.commit()
        await db.refresh(cycle)
    except ValueError:
        # If summary generation fails, store plain text notes instead
        if discharge_notes:
            cycle.discharge_notes = discharge_notes
            await db.commit()
            await db.refresh(cycle)
        summary = None

    # Auto-create take-home medications from protocol (Feature 6)
    try:
        protocol = plan.custom_protocol if plan else {}
        take_home_meds = protocol.get("take_home_medicines") or protocol.get("take_home_medications") or []
        if take_home_meds and plan:
            for med in take_home_meds:
                thm = TakeHomeMedication(
                    cycle_id=cycle.id,
                    patient_id=plan.patient_id,
                    drug_name=med.get("drug_name") or med.get("drugName", ""),
                    dose=str(med.get("dose", "")),
                    unit=med.get("unit", ""),
                    route=med.get("route", "Oral"),
                    frequency=med.get("frequency", "As directed"),
                    start_date=date.today(),
                    end_date=date.today() + timedelta(days=len(med.get("days", [7])) if med.get("days") else 7),
                    instructions=med.get("special_instructions") or med.get("instructions", ""),
                    is_active=True,
                )
                db.add(thm)
            await db.commit()
    except Exception:
        pass  # Non-critical — don't block cycle completion

    return CycleCompletionResponse(
        cycle=TreatmentCycleResponse.model_validate(cycle),
        discharge_summary=summary,
    )


@router.get("/cycles/{cycle_id}/discharge-summary", response_model=DischargeSummaryResponse)
async def get_discharge_summary(
    cycle_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get the discharge summary for a completed cycle."""

    result = await db.execute(select(TreatmentCycle).where(TreatmentCycle.id == cycle_id))
    cycle = result.scalar_one_or_none()

    if not cycle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cycle not found",
        )

    # Try to return the stored summary first
    if cycle.discharge_notes:
        try:
            stored = json.loads(cycle.discharge_notes)
            if isinstance(stored, dict) and "patient_name" in stored:
                return stored
        except (json.JSONDecodeError, TypeError):
            pass

    # Generate fresh if not stored or stored as plain text
    if cycle.status != CycleStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Discharge summary is only available for completed cycles",
        )

    try:
        summary = await generate_discharge_summary(db, cycle_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )

    return summary


# Drug Administration
@router.get("/cycles/{cycle_id}/drugs", response_model=List[DrugAdministrationResponse])
async def list_drug_administrations(
    cycle_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all drug administrations for a cycle."""
    result = await db.execute(
        select(DrugAdministration).where(DrugAdministration.cycle_id == cycle_id)
    )
    drugs = result.scalars().all()
    
    return drugs


@router.put("/drug-admin/{admin_id}", response_model=DrugAdministrationResponse)
async def update_drug_administration(
    admin_id: UUID,
    admin_data: DrugAdministrationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(allow_medical_staff),
):
    """Update drug administration record."""
    result = await db.execute(
        select(DrugAdministration).where(DrugAdministration.id == admin_id)
    )
    drug_admin = result.scalar_one_or_none()
    
    if not drug_admin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Drug administration not found",
        )
    
    update_data = admin_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(drug_admin, field, value)
    
    await db.commit()
    await db.refresh(drug_admin)
    
    return drug_admin


# =============================================================================
# FEATURE 1: PRE-CHEMO BLOOD WORK GATE
# =============================================================================

LAB_THRESHOLDS = {
    "neutrophils": {"min": 1.0, "action": "block", "unit": "x10^9/L"},
    "platelets": {"min": 75.0, "action": "block", "unit": "x10^9/L"},
    "hemoglobin": {"min": 8.0, "action": "warn", "unit": "g/dL"},
    "gfr": {"min": 30.0, "action": "block", "unit": "mL/min"},
    "creatinine": {"max": 2.0, "action": "warn", "unit": "mg/dL"},
}


def validate_labs(labs: dict) -> tuple[list, bool, list]:
    """Validate lab values against safety thresholds. Returns (results, can_proceed, warnings)."""
    results = []
    can_proceed = True
    warnings = []

    for param, threshold in LAB_THRESHOLDS.items():
        value = labs.get(param)
        if value is None:
            continue
        try:
            val = float(value)
        except (ValueError, TypeError):
            continue

        check_min = "min" in threshold
        check_max = "max" in threshold
        limit_val = threshold.get("min") or threshold.get("max", 0)
        breached = False

        if check_min and val < threshold["min"]:
            breached = True
            if threshold["action"] == "block":
                status_str = "block"
                can_proceed = False
                msg = f"{param} ({val} {threshold['unit']}) is below minimum {threshold['min']} — TREATMENT BLOCKED"
            else:
                status_str = "warn"
                msg = f"{param} ({val} {threshold['unit']}) is below recommended {threshold['min']} — proceed with caution"
                warnings.append(msg)
        elif check_max and val > threshold["max"]:
            breached = True
            if threshold["action"] == "block":
                status_str = "block"
                can_proceed = False
                msg = f"{param} ({val} {threshold['unit']}) exceeds maximum {threshold['max']} — TREATMENT BLOCKED"
            else:
                status_str = "warn"
                msg = f"{param} ({val} {threshold['unit']}) exceeds recommended {threshold['max']} — proceed with caution"
                warnings.append(msg)

        if not breached:
            status_str = "ok"
            msg = f"{param} ({val} {threshold['unit']}) is within acceptable range"

        results.append(LabSafetyResult(
            parameter=param,
            value=val,
            threshold=limit_val,
            status=status_str,
            message=msg,
        ))

    return results, can_proceed, warnings


@router.put("/cycles/{cycle_id}/pre-chemo-labs", response_model=PreChemoLabsResponse)
async def submit_pre_chemo_labs(
    cycle_id: UUID,
    labs: PreChemoLabsInput,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(allow_medical_staff),
):
    """Submit pre-chemo lab results and run safety validation."""
    result = await db.execute(select(TreatmentCycle).where(TreatmentCycle.id == cycle_id))
    cycle = result.scalar_one_or_none()
    if not cycle:
        raise HTTPException(status_code=404, detail="Cycle not found")

    labs_dict = labs.model_dump(exclude_none=True)
    cycle.pre_chemo_labs = labs_dict
    await db.commit()
    await db.refresh(cycle)

    safety_results, can_proceed, warnings = validate_labs(labs_dict)

    return PreChemoLabsResponse(
        cycle_id=cycle.id,
        labs=labs_dict,
        safety_results=safety_results,
        can_proceed=can_proceed,
        warnings=warnings,
    )


# =============================================================================
# FEATURE 3: WEIGHT-BASED DOSE RECALCULATION
# =============================================================================

def calculate_bsa(weight_kg: float, height_cm: float) -> float:
    """Calculate BSA using DuBois formula."""
    return 0.007184 * (weight_kg ** 0.425) * (height_cm ** 0.725)


@router.post("/cycles/{cycle_id}/recalculate-doses", response_model=DoseRecalculationResponse)
async def recalculate_doses(
    cycle_id: UUID,
    data: DoseRecalculationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(allow_medical_staff),
):
    """Recalculate drug doses based on current weight."""
    result = await db.execute(select(TreatmentCycle).where(TreatmentCycle.id == cycle_id))
    cycle = result.scalar_one_or_none()
    if not cycle:
        raise HTTPException(status_code=404, detail="Cycle not found")

    # Get treatment plan for protocol data and patient height
    result = await db.execute(select(TreatmentPlan).where(TreatmentPlan.id == cycle.treatment_plan_id))
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Treatment plan not found")

    # Get patient height
    result = await db.execute(select(Patient).where(Patient.id == plan.patient_id))
    patient = result.scalar_one_or_none()
    height_cm = data.height_cm or (patient.height_cm if patient and patient.height_cm else 170.0)

    old_bsa = float(cycle.calculated_bsa) if cycle.calculated_bsa else None
    new_bsa = round(calculate_bsa(data.weight_kg, height_cm), 2)

    bsa_change = abs(new_bsa - old_bsa) / old_bsa * 100 if old_bsa and old_bsa > 0 else 0
    flagged = bsa_change > 10

    # Update cycle
    cycle.patient_weight_kg = data.weight_kg
    cycle.calculated_bsa = new_bsa

    # Recalculate drug doses
    drug_result = await db.execute(
        select(DrugAdministration).where(DrugAdministration.cycle_id == cycle_id)
    )
    drugs = drug_result.scalars().all()

    protocol = plan.custom_protocol or {}
    protocol_drugs = protocol.get("chemotherapy_drugs") or protocol.get("drugs") or []
    dose_lookup = {d.get("drug_name", ""): d.get("dose_per_m2", 0) for d in protocol_drugs}

    updated_drugs = []
    for drug in drugs:
        dose_per_m2 = dose_lookup.get(drug.drug_name, 0)
        old_dose = float(drug.planned_dose)
        new_dose = round(dose_per_m2 * new_bsa, 2) if dose_per_m2 > 0 else old_dose

        drug.planned_dose = new_dose
        updated_drugs.append({
            "drug_name": drug.drug_name,
            "old_dose": old_dose,
            "new_dose": new_dose,
            "unit": drug.unit,
            "dose_per_m2": dose_per_m2,
            "changed": abs(new_dose - old_dose) > 0.01,
        })

    await db.commit()

    return DoseRecalculationResponse(
        cycle_id=cycle.id,
        old_bsa=old_bsa,
        new_bsa=new_bsa,
        bsa_change_percent=round(bsa_change, 1),
        drugs=updated_drugs,
        flagged=flagged,
    )


# =============================================================================
# FEATURE 5: PATIENT TREATMENT TIMELINE
# =============================================================================

@router.get("/treatment-plans/{plan_id}/timeline", response_model=TimelineResponse)
async def get_treatment_timeline(
    plan_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a linear timeline view of a treatment plan."""
    result = await db.execute(select(TreatmentPlan).where(TreatmentPlan.id == plan_id))
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Treatment plan not found")

    cycles_result = await db.execute(
        select(TreatmentCycle)
        .where(TreatmentCycle.treatment_plan_id == plan_id)
        .order_by(TreatmentCycle.cycle_number)
    )
    cycles = cycles_result.scalars().all()

    appts_result = await db.execute(
        select(Appointment).where(Appointment.patient_id == plan.patient_id)
    )
    appointments = appts_result.scalars().all()
    appts_by_date = {}
    for a in appointments:
        d = str(a.scheduled_date)
        appts_by_date.setdefault(d, []).append(a)

    protocol = plan.custom_protocol or {}
    take_home = protocol.get("take_home_medicines") or protocol.get("take_home_medications") or []
    cycle_length = protocol.get("cycle_length_days") or 21
    today = date.today()

    items = []

    for cycle in cycles:
        if not cycle.scheduled_date:
            continue

        cycle_start = cycle.scheduled_date
        cycle_status = cycle.status.value if hasattr(cycle.status, 'value') else str(cycle.status)

        # Blood test reminder (2 days before)
        lab_date = cycle_start - timedelta(days=2)
        if lab_date >= today or cycle_status in ("scheduled", "pre_assessment"):
            items.append(TimelineItem(
                date=lab_date,
                type="lab",
                title=f"Blood Test - Pre Cycle {cycle.cycle_number}",
                description="Complete blood work before your chemo session",
                status="pending" if lab_date >= today else "done",
                cycle_number=cycle.cycle_number,
                is_action_required=lab_date >= today and not cycle.pre_chemo_labs,
            ))

        # Treatment day
        items.append(TimelineItem(
            date=cycle_start,
            type="treatment",
            title=f"Chemotherapy - Cycle {cycle.cycle_number}",
            description=f"{plan.protocol_name} administration",
            status=cycle_status,
            cycle_number=cycle.cycle_number,
            is_action_required=cycle_status in ("scheduled", "approved"),
        ))

        # Take-home medication days
        for drug in take_home:
            days = drug.get("days") or []
            drug_name = drug.get("drug_name") or drug.get("drugName", "Medication")
            for d in days:
                if d == 1:
                    continue  # Skip treatment day
                med_date = cycle_start + timedelta(days=d - 1)
                items.append(TimelineItem(
                    date=med_date,
                    type="medication",
                    title=f"Take-home: {drug_name}",
                    description=f"Day {d} of cycle {cycle.cycle_number}",
                    cycle_number=cycle.cycle_number,
                ))

        # Rest day context for mid-cycle
        rest_date = cycle_start + timedelta(days=7)
        if rest_date < cycle_start + timedelta(days=cycle_length):
            items.append(TimelineItem(
                date=rest_date,
                type="rest",
                title=f"Recovery Week - Cycle {cycle.cycle_number}",
                description="Stay hydrated, monitor symptoms, contact team if fever > 100.4\u00b0F",
                cycle_number=cycle.cycle_number,
            ))

    # Add appointments
    for apt in appointments:
        items.append(TimelineItem(
            date=apt.scheduled_date,
            type="appointment",
            title=apt.appointment_type.value.replace("_", " ").title() if hasattr(apt.appointment_type, 'value') else str(apt.appointment_type),
            description=f"Scheduled at {apt.scheduled_time}" if apt.scheduled_time else None,
            status=apt.status.value if hasattr(apt.status, 'value') else str(apt.status),
            is_action_required=apt.status in (AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED),
        ))

    items.sort(key=lambda x: x.date)

    return TimelineResponse(
        plan_id=plan.id,
        protocol_name=plan.protocol_name or "Treatment Plan",
        total_cycles=plan.planned_cycles,
        completed_cycles=plan.completed_cycles or 0,
        items=items,
    )


# =============================================================================
# FEATURE 10: TREATMENT COST TRACKER
# =============================================================================

@router.get("/treatment-plans/{plan_id}/costs", response_model=TreatmentCostResponse)
async def get_treatment_costs(
    plan_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get cost breakdown for a treatment plan."""
    result = await db.execute(select(TreatmentPlan).where(TreatmentPlan.id == plan_id))
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Treatment plan not found")

    cycles_result = await db.execute(
        select(TreatmentCycle)
        .where(TreatmentCycle.treatment_plan_id == plan_id)
        .order_by(TreatmentCycle.cycle_number)
    )
    cycles = cycles_result.scalars().all()

    cycle_details = []
    total_spent = 0

    for cycle in cycles:
        drug_result = await db.execute(
            select(DrugAdministration).where(DrugAdministration.cycle_id == cycle.id)
        )
        drugs = drug_result.scalars().all()

        drug_costs = []
        for d in drugs:
            cost = float(d.total_cost) if d.total_cost else 0
            drug_costs.append({
                "drug_name": d.drug_name,
                "unit_cost": float(d.unit_cost) if d.unit_cost else None,
                "total_cost": cost,
            })

        session = float(cycle.session_cost) if cycle.session_cost else 0
        lab = float(cycle.lab_cost) if cycle.lab_cost else 0
        other = float(cycle.other_charges) if cycle.other_charges else 0
        drug_total = sum(float(d.total_cost) for d in drugs if d.total_cost)
        cycle_total = session + lab + other + drug_total
        total_spent += cycle_total

        cycle_details.append(CycleCostDetail(
            cycle_number=cycle.cycle_number,
            cycle_id=cycle.id,
            session_cost=session or None,
            lab_cost=lab or None,
            other_charges=other or None,
            drug_costs=drug_costs,
            cycle_total=round(cycle_total, 2),
        ))

    return TreatmentCostResponse(
        plan_id=plan.id,
        protocol_name=plan.protocol_name or "Treatment Plan",
        estimated_total_cost=float(plan.estimated_total_cost) if plan.estimated_total_cost else None,
        total_spent=round(total_spent, 2),
        cycles=cycle_details,
    )


@router.put("/cycles/{cycle_id}/costs")
async def update_cycle_costs(
    cycle_id: UUID,
    data: CycleCostUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(allow_medical_staff),
):
    """Update cost data for a cycle."""
    result = await db.execute(select(TreatmentCycle).where(TreatmentCycle.id == cycle_id))
    cycle = result.scalar_one_or_none()
    if not cycle:
        raise HTTPException(status_code=404, detail="Cycle not found")

    if data.session_cost is not None:
        cycle.session_cost = data.session_cost
    if data.lab_cost is not None:
        cycle.lab_cost = data.lab_cost
    if data.other_charges is not None:
        cycle.other_charges = data.other_charges

    await db.commit()
    await db.refresh(cycle)

    return {"status": "ok", "cycle_id": str(cycle.id)}
