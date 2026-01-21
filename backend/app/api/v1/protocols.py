"""
Protocol and Treatment Plan API endpoints.
"""
from typing import List, Optional
from uuid import UUID
from datetime import datetime
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
    DrugAdministrationUpdate,
    DrugAdministrationResponse,
)
from app.api.deps import get_current_user, allow_doctors, allow_medical_staff

router = APIRouter(tags=["Protocols & Treatment"])


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
    
    if cycle.status != CycleStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cycle must be approved before starting",
        )
    
    cycle.started_at = datetime.utcnow()
    cycle.status = CycleStatus.IN_PROGRESS
    
    await db.commit()
    await db.refresh(cycle)
    
    return cycle


@router.post("/cycles/{cycle_id}/complete", response_model=TreatmentCycleResponse)
async def complete_cycle(
    cycle_id: UUID,
    discharge_notes: Optional[str] = None,
    follow_up_instructions: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(allow_medical_staff),
):
    """Complete treatment cycle."""
    result = await db.execute(select(TreatmentCycle).where(TreatmentCycle.id == cycle_id))
    cycle = result.scalar_one_or_none()
    
    if not cycle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cycle not found",
        )
    
    cycle.completed_at = datetime.utcnow()
    cycle.status = CycleStatus.COMPLETED
    cycle.discharge_notes = discharge_notes
    cycle.follow_up_instructions = follow_up_instructions
    
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
    
    return cycle


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
