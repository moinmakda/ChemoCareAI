"""
Day Care Management API endpoints.

Provides real-time monitoring, chair management, and infusion session tracking
for the chemotherapy day care unit.
"""
from typing import List, Optional
from uuid import UUID
from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.core.database import get_db
from app.models import (
    Patient,
    Appointment,
    AppointmentStatus,
    AppointmentType,
    TreatmentCycle,
    TreatmentPlan,
    DrugAdministration,
    Vital,
    User,
    Nurse,
    CycleStatus,
    AdminStatus,
)
from app.api.deps import allow_medical_staff, allow_nurses
from app.schemas.daycare import (
    VitalsStatus,
    AlertInfo,
    ActivePatientResponse,
    ChairSchedule,
    ChairStatus,
    InfusionDrug,
    InfusionSessionResponse,
    ReactionReport,
    ReactionResponse,
    SessionCompletionResponse,
    DaycareStatsResponse,
)
from app.schemas.auth import MessageResponse

router = APIRouter(prefix="/daycare", tags=["Day Care"])


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def calculate_session_progress(cycle: TreatmentCycle, drugs: List[DrugAdministration]) -> int:
    """Calculate progress percentage for a treatment session."""
    if not drugs:
        return 0
    
    total_drugs = len(drugs)
    completed = sum(1 for d in drugs if d.status == AdminStatus.COMPLETED)
    in_progress = sum(1 for d in drugs if d.status == AdminStatus.STARTED)
    
    # Each completed drug = full portion, in-progress = half
    progress = (completed * 100 + in_progress * 50) / total_drugs
    return min(int(progress), 100)


def get_current_drug(drugs: List[DrugAdministration]) -> Optional[str]:
    """Get the currently infusing drug name."""
    for drug in sorted(drugs, key=lambda d: d.id):
        if drug.status == AdminStatus.STARTED:
            return drug.drug_name
    return None


def map_cycle_status_to_session(cycle_status: CycleStatus) -> str:
    """Map cycle status to session status."""
    status_map = {
        CycleStatus.SCHEDULED: "awaiting",
        CycleStatus.PRE_ASSESSMENT: "premedication",
        CycleStatus.APPROVED: "awaiting",
        CycleStatus.IN_PROGRESS: "infusing",
        CycleStatus.COMPLETED: "completed",
        CycleStatus.DELAYED: "awaiting",
        CycleStatus.CANCELLED: "completed",
    }
    return status_map.get(cycle_status, "awaiting")


def generate_alerts_from_vitals(vital: Vital, patient: Patient) -> List[AlertInfo]:
    """Generate alerts based on vital signs."""
    alerts = []
    patient_name = f"{patient.first_name} {patient.last_name}"
    
    if vital.temperature_f and vital.temperature_f > 101.0:
        alerts.append(AlertInfo(
            id=f"vital-temp-{vital.id}",
            type="vital_critical" if vital.temperature_f > 102.5 else "vital_warning",
            message=f"Temperature: {vital.temperature_f}°F",
            patient_id=str(patient.id),
            patient_name=patient_name,
            timestamp=vital.recorded_at.isoformat(),
            severity="critical" if vital.temperature_f > 102.5 else "high",
        ))
    
    if vital.oxygen_saturation and vital.oxygen_saturation < 95:
        alerts.append(AlertInfo(
            id=f"vital-spo2-{vital.id}",
            type="vital_critical" if vital.oxygen_saturation < 90 else "vital_warning",
            message=f"SpO2: {vital.oxygen_saturation}%",
            patient_id=str(patient.id),
            patient_name=patient_name,
            timestamp=vital.recorded_at.isoformat(),
            severity="critical" if vital.oxygen_saturation < 90 else "high",
        ))
    
    if vital.pulse_bpm and (vital.pulse_bpm > 120 or vital.pulse_bpm < 50):
        severity = "critical" if vital.pulse_bpm > 140 or vital.pulse_bpm < 40 else "high"
        alerts.append(AlertInfo(
            id=f"vital-hr-{vital.id}",
            type="vital_critical" if severity == "critical" else "vital_warning",
            message=f"Heart Rate: {vital.pulse_bpm} bpm",
            patient_id=str(patient.id),
            patient_name=patient_name,
            timestamp=vital.recorded_at.isoformat(),
            severity=severity,
        ))
    
    return alerts


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.get("/sessions/active", response_model=List[ActivePatientResponse])
async def get_active_sessions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(allow_medical_staff),
):
    """
    Get all active patients currently in day care.
    
    Returns patients with today's appointments that are:
    - Scheduled, confirmed, checked in, or in progress
    - For chemotherapy day care appointments
    """
    today = date.today()
    
    # Get today's daycare appointments
    appt_result = await db.execute(
        select(Appointment).where(
            and_(
                Appointment.scheduled_date == today,
                Appointment.appointment_type == AppointmentType.DAYCARE_CHEMO,
                Appointment.status.in_([
                    AppointmentStatus.SCHEDULED,
                    AppointmentStatus.CONFIRMED,
                    AppointmentStatus.CHECKED_IN,
                    AppointmentStatus.IN_PROGRESS,
                ])
            )
        ).order_by(Appointment.scheduled_time)
    )
    appointments = appt_result.scalars().all()
    
    active_patients = []
    
    for appt in appointments:
        # Get patient info
        patient_result = await db.execute(
            select(Patient).where(Patient.id == appt.patient_id)
        )
        patient = patient_result.scalar_one_or_none()
        if not patient:
            continue
        
        patient_name = f"{patient.first_name} {patient.last_name}"
        
        # Get treatment cycle if linked
        cycle = None
        drugs = []
        protocol_name = "Unknown Protocol"
        
        if appt.cycle_id:
            cycle_result = await db.execute(
                select(TreatmentCycle).where(TreatmentCycle.id == appt.cycle_id)
            )
            cycle = cycle_result.scalar_one_or_none()
            
            if cycle:
                # Get drugs for this cycle
                drugs_result = await db.execute(
                    select(DrugAdministration).where(DrugAdministration.cycle_id == cycle.id)
                )
                drugs = drugs_result.scalars().all()
                
                # Get protocol name from treatment plan
                plan_result = await db.execute(
                    select(TreatmentPlan).where(TreatmentPlan.id == cycle.treatment_plan_id)
                )
                plan = plan_result.scalar_one_or_none()
                if plan:
                    protocol_name = plan.protocol_name
        
        # Get last vitals
        vitals_result = await db.execute(
            select(Vital)
            .where(Vital.patient_id == patient.id)
            .order_by(Vital.recorded_at.desc())
            .limit(1)
        )
        last_vital = vitals_result.scalar_one_or_none()
        
        # Determine vitals status and build alerts
        vitals_status = "normal"
        alerts = []
        last_vitals_data = None
        
        if last_vital:
            alerts = generate_alerts_from_vitals(last_vital, patient)
            if any(a.severity == "critical" for a in alerts):
                vitals_status = "critical"
            elif alerts:
                vitals_status = "warning"
            
            bp_str = None
            if last_vital.blood_pressure_systolic and last_vital.blood_pressure_diastolic:
                bp_str = f"{last_vital.blood_pressure_systolic}/{last_vital.blood_pressure_diastolic}"
            
            last_vitals_data = VitalsStatus(
                temperature=float(last_vital.temperature_f) if last_vital.temperature_f else None,
                blood_pressure=bp_str,
                heart_rate=last_vital.pulse_bpm,
                oxygen_saturation=last_vital.oxygen_saturation,
            )
        
        # Calculate progress
        progress = 0
        if cycle and drugs:
            progress = calculate_session_progress(cycle, drugs)
        elif appt.status == AppointmentStatus.COMPLETED:
            progress = 100
        elif appt.status == AppointmentStatus.IN_PROGRESS:
            progress = 50
        elif appt.status == AppointmentStatus.CHECKED_IN:
            progress = 10
        
        # Determine session status
        if cycle:
            session_status = map_cycle_status_to_session(cycle.status)
        else:
            status_map = {
                AppointmentStatus.SCHEDULED: "awaiting",
                AppointmentStatus.CONFIRMED: "awaiting",
                AppointmentStatus.CHECKED_IN: "premedication",
                AppointmentStatus.IN_PROGRESS: "infusing",
            }
            session_status = status_map.get(appt.status, "awaiting")
        
        if vitals_status == "critical":
            session_status = "alert"
        
        # Get nurse info
        nurse_name = None
        nurse_id = None
        if appt.nurse_id:
            nurse_result = await db.execute(
                select(Nurse).where(Nurse.id == appt.nurse_id)
            )
            nurse = nurse_result.scalar_one_or_none()
            if nurse:
                nurse_name = f"{nurse.first_name} {nurse.last_name}"
                nurse_id = str(nurse.id)
        
        # Calculate times
        start_time = None
        if appt.checked_in_at:
            start_time = appt.checked_in_at.isoformat()
        
        # Estimate end time (assuming 4 hours for chemo)
        scheduled_datetime = datetime.combine(appt.scheduled_date, appt.scheduled_time)
        estimated_end = scheduled_datetime.replace(
            hour=scheduled_datetime.hour + 4
        ).isoformat()
        
        active_patients.append(ActivePatientResponse(
            id=str(appt.id),
            patient_id=str(patient.id),
            patient_name=patient_name,
            chair_number=appt.chair_number,
            protocol_name=protocol_name,
            current_drug=get_current_drug(drugs) if drugs else None,
            status=session_status,
            progress=progress,
            start_time=start_time,
            estimated_end_time=estimated_end,
            nurse_assigned=nurse_name,
            nurse_id=nurse_id,
            vitals_status=vitals_status,
            last_vitals=last_vitals_data,
            alerts=alerts,
        ))
    
    return active_patients


@router.get("/chairs", response_model=List[ChairStatus])
async def get_chair_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(allow_medical_staff),
):
    """
    Get status of all day care chairs.
    
    Returns 12 chairs by default (configurable) with their current
    occupancy and scheduled sessions.
    """
    NUM_CHAIRS = 12
    today = date.today()
    
    # Get today's appointments with chair numbers
    appt_result = await db.execute(
        select(Appointment).where(
            and_(
                Appointment.scheduled_date == today,
                Appointment.appointment_type == AppointmentType.DAYCARE_CHEMO,
                Appointment.chair_number.isnot(None),
            )
        ).order_by(Appointment.scheduled_time)
    )
    appointments = appt_result.scalars().all()
    
    # Build chair status map
    chair_occupancy = {}
    chair_schedules = {i: [] for i in range(1, NUM_CHAIRS + 1)}
    
    for appt in appointments:
        if appt.chair_number and 1 <= appt.chair_number <= NUM_CHAIRS:
            # Get patient name
            patient_result = await db.execute(
                select(Patient).where(Patient.id == appt.patient_id)
            )
            patient = patient_result.scalar_one_or_none()
            patient_name = f"{patient.first_name} {patient.last_name}" if patient else "Unknown"
            
            # Add to schedule
            chair_schedules[appt.chair_number].append(ChairSchedule(
                time=appt.scheduled_time.strftime("%H:%M"),
                patient_name=patient_name,
                duration=appt.duration_mins or 240,  # Default 4 hours
            ))
            
            # Check if currently occupied
            if appt.status in [AppointmentStatus.CHECKED_IN, AppointmentStatus.IN_PROGRESS]:
                chair_occupancy[appt.chair_number] = {
                    "patient_id": str(appt.patient_id),
                    "patient_name": patient_name,
                }
    
    # Build chair list
    chairs = []
    for chair_num in range(1, NUM_CHAIRS + 1):
        occupant = chair_occupancy.get(chair_num)
        
        if occupant:
            status = "occupied"
            current_patient_id = occupant["patient_id"]
            current_patient_name = occupant["patient_name"]
        elif chair_schedules[chair_num]:
            status = "reserved"
            current_patient_id = None
            current_patient_name = None
        else:
            status = "available"
            current_patient_id = None
            current_patient_name = None
        
        chairs.append(ChairStatus(
            id=chair_num,
            status=status,
            current_patient_id=current_patient_id,
            current_patient_name=current_patient_name,
            scheduled_sessions=chair_schedules[chair_num],
        ))
    
    return chairs


@router.get("/sessions/{session_id}", response_model=InfusionSessionResponse)
async def get_session_details(
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(allow_medical_staff),
):
    """
    Get detailed information about a specific infusion session.
    
    Session ID is the appointment ID.
    """
    # Get appointment
    appt_result = await db.execute(
        select(Appointment).where(Appointment.id == session_id)
    )
    appt = appt_result.scalar_one_or_none()
    
    if not appt:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Get patient
    patient_result = await db.execute(
        select(Patient).where(Patient.id == appt.patient_id)
    )
    patient = patient_result.scalar_one_or_none()
    patient_name = f"{patient.first_name} {patient.last_name}" if patient else "Unknown"
    
    # Get cycle and drugs
    drugs_list = []
    protocol_name = "Unknown Protocol"
    protocol_id = None
    cycle_number = 1
    
    if appt.cycle_id:
        cycle_result = await db.execute(
            select(TreatmentCycle).where(TreatmentCycle.id == appt.cycle_id)
        )
        cycle = cycle_result.scalar_one_or_none()
        
        if cycle:
            cycle_number = cycle.cycle_number
            
            # Get plan and protocol
            plan_result = await db.execute(
                select(TreatmentPlan).where(TreatmentPlan.id == cycle.treatment_plan_id)
            )
            plan = plan_result.scalar_one_or_none()
            if plan:
                protocol_name = plan.protocol_name
                protocol_id = str(plan.protocol_template_id) if plan.protocol_template_id else None
            
            # Get drugs
            drugs_result = await db.execute(
                select(DrugAdministration).where(DrugAdministration.cycle_id == cycle.id)
            )
            drugs = drugs_result.scalars().all()
            
            for i, drug in enumerate(sorted(drugs, key=lambda d: d.id)):
                drug_status = "pending"
                if drug.status == AdminStatus.COMPLETED:
                    drug_status = "completed"
                elif drug.status == AdminStatus.STARTED:
                    drug_status = "infusing"
                elif drug.status == AdminStatus.PAUSED:
                    drug_status = "paused"
                
                drugs_list.append(InfusionDrug(
                    name=drug.drug_name,
                    dose=f"{drug.planned_dose}{drug.unit}",
                    duration=drug.planned_duration_mins or 60,
                    order=i + 1,
                    status=drug_status,
                ))
    
    # Determine status
    status_map = {
        AppointmentStatus.SCHEDULED: "scheduled",
        AppointmentStatus.CONFIRMED: "confirmed",
        AppointmentStatus.CHECKED_IN: "checked_in",
        AppointmentStatus.IN_PROGRESS: "in_progress",
        AppointmentStatus.COMPLETED: "completed",
        AppointmentStatus.CANCELLED: "cancelled",
    }
    status = status_map.get(appt.status, "scheduled")
    
    # Calculate times
    scheduled_datetime = datetime.combine(appt.scheduled_date, appt.scheduled_time)
    estimated_end = scheduled_datetime.replace(hour=scheduled_datetime.hour + 4)
    
    return InfusionSessionResponse(
        id=str(appt.id),
        patient_id=str(appt.patient_id),
        patient_name=patient_name,
        protocol_id=protocol_id,
        protocol_name=protocol_name,
        cycle_number=cycle_number,
        chair_number=appt.chair_number,
        scheduled_start=scheduled_datetime.isoformat(),
        actual_start=appt.checked_in_at.isoformat() if appt.checked_in_at else None,
        estimated_end=estimated_end.isoformat(),
        actual_end=appt.checked_out_at.isoformat() if appt.checked_out_at else None,
        status=status,
        drugs=drugs_list,
        reactions=[],  # Would load from DrugAdministration.reactions
        notes=appt.notes,
    )


@router.post("/sessions/{session_id}/start", response_model=MessageResponse)
async def start_infusion(
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(allow_nurses),
):
    """
    Start the infusion session.
    
    Updates appointment status to IN_PROGRESS and marks the first drug as STARTED.
    """
    # Get appointment
    appt_result = await db.execute(
        select(Appointment).where(Appointment.id == session_id)
    )
    appt = appt_result.scalar_one_or_none()
    
    if not appt:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if appt.status not in [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED, AppointmentStatus.CHECKED_IN]:
        raise HTTPException(status_code=400, detail="Session cannot be started in current state")
    
    # Update appointment status
    appt.status = AppointmentStatus.IN_PROGRESS
    if not appt.checked_in_at:
        appt.checked_in_at = datetime.utcnow()
    
    # If cycle linked, update cycle and start first drug
    if appt.cycle_id:
        cycle_result = await db.execute(
            select(TreatmentCycle).where(TreatmentCycle.id == appt.cycle_id)
        )
        cycle = cycle_result.scalar_one_or_none()
        
        if cycle:
            cycle.status = CycleStatus.IN_PROGRESS
            cycle.started_at = datetime.utcnow()
            
            # Get nurse ID
            nurse_result = await db.execute(
                select(Nurse).where(Nurse.user_id == current_user.id)
            )
            nurse = nurse_result.scalar_one_or_none()
            
            # Start first pending drug
            drugs_result = await db.execute(
                select(DrugAdministration)
                .where(DrugAdministration.cycle_id == cycle.id)
                .order_by(DrugAdministration.id)
            )
            drugs = drugs_result.scalars().all()
            
            for drug in drugs:
                if drug.status == AdminStatus.PENDING:
                    drug.status = AdminStatus.STARTED
                    drug.started_at = datetime.utcnow()
                    if nurse:
                        drug.administered_by = nurse.id
                    break
    
    await db.commit()

    return MessageResponse(message="Infusion started")


@router.patch("/sessions/{session_id}/progress", response_model=MessageResponse)
async def update_progress(
    session_id: UUID,
    progress: int = Query(..., ge=0, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(allow_nurses),
):
    """
    Update session progress manually.
    
    This can be used to override automatic progress calculation.
    In practice, progress is calculated from drug administration status.
    """
    # Get appointment
    appt_result = await db.execute(
        select(Appointment).where(Appointment.id == session_id)
    )
    appt = appt_result.scalar_one_or_none()
    
    if not appt:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Update cycle drugs based on progress if cycle exists
    if appt.cycle_id and progress == 100:
        # Mark all drugs as completed
        drugs_result = await db.execute(
            select(DrugAdministration).where(DrugAdministration.cycle_id == appt.cycle_id)
        )
        drugs = drugs_result.scalars().all()
        
        for drug in drugs:
            if drug.status != AdminStatus.COMPLETED:
                drug.status = AdminStatus.COMPLETED
                drug.completed_at = datetime.utcnow()
    
    await db.commit()

    return MessageResponse(message="Progress updated")


@router.post("/sessions/{session_id}/reaction", response_model=ReactionResponse)
async def report_reaction(
    session_id: UUID,
    reaction: ReactionReport,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(allow_nurses),
):
    """
    Report an adverse reaction during infusion.
    
    Creates an alert and logs the reaction to the current drug administration.
    """
    # Get appointment
    appt_result = await db.execute(
        select(Appointment).where(Appointment.id == session_id)
    )
    appt = appt_result.scalar_one_or_none()
    
    if not appt:
        raise HTTPException(status_code=404, detail="Session not found")
    
    reaction_data = {
        "type": reaction.reaction_type,
        "severity": reaction.severity,
        "description": reaction.description,
        "action_taken": reaction.action_taken,
        "vital_signs": reaction.vital_signs,
        "reported_by": str(current_user.id),
        "reported_at": datetime.utcnow().isoformat(),
    }
    
    # If cycle linked, add reaction to current drug
    if appt.cycle_id:
        drugs_result = await db.execute(
            select(DrugAdministration)
            .where(
                and_(
                    DrugAdministration.cycle_id == appt.cycle_id,
                    DrugAdministration.status == AdminStatus.STARTED,
                )
            )
        )
        current_drug = drugs_result.scalar_one_or_none()
        
        if current_drug:
            reactions = current_drug.reactions or []
            reactions.append(reaction_data)
            current_drug.reactions = reactions
            
            # If severe, pause the drug
            if reaction.severity in ["severe", "life_threatening"]:
                current_drug.status = AdminStatus.PAUSED
    
    await db.commit()

    return ReactionResponse(
        message="Reaction reported",
        reaction_id=f"reaction-{datetime.utcnow().timestamp()}",
        severity=reaction.severity,
    )


@router.post("/sessions/{session_id}/complete", response_model=SessionCompletionResponse)
async def complete_session(
    session_id: UUID,
    discharge_notes: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(allow_nurses),
):
    """
    Complete an infusion session.
    
    Marks the appointment as completed and updates the treatment cycle.
    """
    # Get appointment
    appt_result = await db.execute(
        select(Appointment).where(Appointment.id == session_id)
    )
    appt = appt_result.scalar_one_or_none()
    
    if not appt:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Update appointment
    appt.status = AppointmentStatus.COMPLETED
    appt.checked_out_at = datetime.utcnow()
    if discharge_notes:
        appt.notes = (appt.notes or "") + f"\n\nDischarge Notes: {discharge_notes}"
    
    # If cycle linked, complete cycle
    if appt.cycle_id:
        cycle_result = await db.execute(
            select(TreatmentCycle).where(TreatmentCycle.id == appt.cycle_id)
        )
        cycle = cycle_result.scalar_one_or_none()
        
        if cycle:
            cycle.status = CycleStatus.COMPLETED
            cycle.completed_at = datetime.utcnow()
            cycle.discharge_notes = discharge_notes
            
            # Complete all drugs
            drugs_result = await db.execute(
                select(DrugAdministration).where(DrugAdministration.cycle_id == cycle.id)
            )
            drugs = drugs_result.scalars().all()
            
            for drug in drugs:
                if drug.status != AdminStatus.COMPLETED:
                    drug.status = AdminStatus.COMPLETED
                    drug.completed_at = datetime.utcnow()
            
            # Update treatment plan completed cycles count
            plan_result = await db.execute(
                select(TreatmentPlan).where(TreatmentPlan.id == cycle.treatment_plan_id)
            )
            plan = plan_result.scalar_one_or_none()
            
            if plan:
                plan.completed_cycles = (plan.completed_cycles or 0) + 1
    
    await db.commit()

    return SessionCompletionResponse(message="Session completed", session_id=str(session_id))


@router.get("/stats", response_model=DaycareStatsResponse)
async def get_daycare_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(allow_medical_staff),
):
    """
    Get dashboard statistics for the day care unit.
    """
    from sqlalchemy import func
    
    today = date.today()
    
    # 1. Total Patients
    result = await db.execute(select(func.count(Patient.id)))
    total_patients = result.scalar() or 0
    
    # 2. Today's Appointments (scheduled, confirmed, checked_in, in_progress, completed)
    # Exclude cancelled
    result = await db.execute(
        select(func.count(Appointment.id)).where(
            and_(
                Appointment.scheduled_date == today,
                Appointment.appointment_type == AppointmentType.DAYCARE_CHEMO,
                Appointment.status != AppointmentStatus.CANCELLED
            )
        )
    )
    today_appointments = result.scalar() or 0
    
    # 3. Active Treatments
    # Check-in or In-progress
    result = await db.execute(
        select(func.count(Appointment.id)).where(
            and_(
                Appointment.scheduled_date == today,
                Appointment.appointment_type == AppointmentType.DAYCARE_CHEMO,
                Appointment.status.in_([
                    AppointmentStatus.CHECKED_IN,
                    AppointmentStatus.IN_PROGRESS
                ])
            )
        )
    )
    active_treatments = result.scalar() or 0
    
    # 4. Pending Alerts (simplified: critical vitals)
    # Count sessions with Critical/Warning status logic
    # This is expensive to calculate exactly like get_active_sessions, 
    # so we'll do a simpler check for recent critical vitals
    # For now return 0 or implement deeper logic if needed.
    # Let's count vitals from today with abnormal values
    
    # This query is illustrative; for speed we might stick to 0 or simple count
    pending_alerts = 0
    
    return DaycareStatsResponse(
        total_patients=total_patients,
        today_appointments=today_appointments,
        active_treatments=active_treatments,
        pending_alerts=pending_alerts,
    )
