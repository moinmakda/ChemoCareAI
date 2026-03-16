"""
Vitals, Appointments, and Notifications API endpoints.
"""
import re
from typing import List, Optional
from uuid import UUID
from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field, field_validator


def _strip_tags(value):
    if value is None:
        return None
    return re.sub(r'<[^>]+>', '', str(value)).strip()
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.core.database import get_db
from app.models import (
    Vital,
    Appointment,
    Notification,
    SymptomEntry,
    Patient,
    User,
    UserRole,
)
from app.schemas import (
    VitalCreate,
    VitalResponse,
    AppointmentCreate,
    AppointmentUpdate,
    AppointmentResponse,
    NotificationResponse,
    SymptomEntryCreate,
    SymptomEntryResponse,
)
from app.api.deps import get_current_user, allow_medical_staff, allow_nurses

router = APIRouter(tags=["Clinical"])


# ============ Vitals ============
# Single schema covering all callers. patient_id is required for staff, ignored for patients.
class VitalCreateRequest(BaseModel):
    """Unified vital sign creation schema. Staff must supply patient_id; patients omit it."""
    patient_id: Optional[UUID] = None
    cycle_id: Optional[UUID] = None
    temperature_f: Optional[float] = None
    pulse_bpm: Optional[int] = None
    blood_pressure_systolic: Optional[int] = None
    blood_pressure_diastolic: Optional[int] = None
    respiratory_rate: Optional[int] = None
    oxygen_saturation: Optional[int] = None
    pain_score: Optional[int] = Field(None, ge=0, le=10)
    pain_location: Optional[str] = None
    blood_sugar: Optional[float] = None
    weight_kg: Optional[float] = None
    notes: Optional[str] = None

    @field_validator('notes', 'pain_location', mode='before')
    @classmethod
    def sanitize_text(cls, v):
        return _strip_tags(v)


def _compute_vital_alerts(data: VitalCreateRequest, is_patient: bool) -> list:
    alerts = []
    suffix = " - please contact your care team" if is_patient else ""
    if data.temperature_f and data.temperature_f > 101.3:
        alerts.append({"type": "high_fever", "message": f"High fever - seek immediate medical attention{suffix}", "severity": "critical"})
    elif data.temperature_f and data.temperature_f > 100.4:
        alerts.append({"type": "fever", "message": f"Fever detected{suffix}", "severity": "warning"})
    if data.blood_pressure_systolic and data.blood_pressure_systolic > 140:
        alerts.append({"type": "bp_high", "message": f"Elevated blood pressure{suffix}", "severity": "warning"})
    if data.oxygen_saturation and data.oxygen_saturation < 95:
        msg = "Low oxygen - seek immediate medical attention" if is_patient else "Low oxygen saturation"
        alerts.append({"type": "low_spo2", "message": msg, "severity": "critical"})
    if data.pulse_bpm and (data.pulse_bpm > 100 or data.pulse_bpm < 60):
        alerts.append({"type": "abnormal_hr", "message": f"Abnormal heart rate{suffix}", "severity": "warning"})
    return alerts


@router.post("/vitals", response_model=VitalResponse, status_code=status.HTTP_201_CREATED)
async def create_vital(
    vital_data: VitalCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Record vitals. Behaviour is role-aware:
    - Patient: patient_id is resolved from token; timing set to 'self_reported'.
    - Nurse/Doctor: patient_id must be provided in body.
    """
    if current_user.role == UserRole.PATIENT:
        result = await db.execute(select(Patient).where(Patient.user_id == current_user.id))
        patient = result.scalar_one_or_none()
        if not patient:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient profile not found")
        patient_id = patient.id
        timing = "self_reported"
        recorded_by = None
    else:
        if not vital_data.patient_id:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="patient_id is required for staff")
        patient_id = vital_data.patient_id
        timing = "staff_recorded"
        from app.models import Nurse
        nurse_result = await db.execute(select(Nurse).where(Nurse.user_id == current_user.id))
        nurse = nurse_result.scalar_one_or_none()
        recorded_by = nurse.id if nurse else None

    vital = Vital(
        patient_id=patient_id,
        cycle_id=vital_data.cycle_id,
        temperature_f=vital_data.temperature_f,
        pulse_bpm=vital_data.pulse_bpm,
        blood_pressure_systolic=vital_data.blood_pressure_systolic,
        blood_pressure_diastolic=vital_data.blood_pressure_diastolic,
        respiratory_rate=vital_data.respiratory_rate,
        oxygen_saturation=vital_data.oxygen_saturation,
        pain_score=vital_data.pain_score,
        pain_location=vital_data.pain_location,
        blood_sugar=vital_data.blood_sugar,
        weight_kg=vital_data.weight_kg,
        notes=vital_data.notes,
        timing=timing,
        recorded_by=recorded_by,
        ai_alerts=_compute_vital_alerts(vital_data, current_user.role == UserRole.PATIENT),
    )

    db.add(vital)
    await db.commit()
    await db.refresh(vital)
    return vital


@router.get("/vitals", response_model=List[VitalResponse])
async def list_vitals(
    patient_id: Optional[UUID] = None,
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List vitals. Behaviour is role-aware:
    - Patient: returns only their own vitals (patient_id param ignored).
    - Staff: patient_id param required to filter by patient.
    """
    if current_user.role == UserRole.PATIENT:
        result = await db.execute(select(Patient).where(Patient.user_id == current_user.id))
        patient = result.scalar_one_or_none()
        if not patient:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient profile not found")
        filter_patient_id = patient.id
    else:
        filter_patient_id = patient_id

    query = select(Vital).order_by(Vital.recorded_at.desc()).limit(limit)
    if filter_patient_id:
        query = query.where(Vital.patient_id == filter_patient_id)

    result = await db.execute(query)
    return result.scalars().all()


# Appointments
@router.get("/appointments", response_model=List[AppointmentResponse])
async def list_appointments(
    patient_id: Optional[UUID] = None,
    scheduled_date: Optional[date] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List appointments."""
    query = select(Appointment)
    
    # Patients can only see their own appointments
    if current_user.role == UserRole.PATIENT:
        result = await db.execute(select(Patient).where(Patient.user_id == current_user.id))
        patient = result.scalar_one_or_none()
        if patient:
            query = query.where(Appointment.patient_id == patient.id)
    elif patient_id:
        query = query.where(Appointment.patient_id == patient_id)
    
    if scheduled_date:
        query = query.where(Appointment.scheduled_date == scheduled_date)
    
    if status:
        query = query.where(Appointment.status == status)
    
    query = query.order_by(Appointment.scheduled_date, Appointment.scheduled_time)
    
    result = await db.execute(query)
    appointments = result.scalars().all()
    
    return appointments


@router.post("/appointments", response_model=AppointmentResponse, status_code=status.HTTP_201_CREATED)
async def create_appointment(
    appointment_data: AppointmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new appointment."""
    # Verify patient exists
    result = await db.execute(select(Patient).where(Patient.id == appointment_data.patient_id))
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found",
        )
    
    appointment = Appointment(**appointment_data.model_dump())
    db.add(appointment)
    await db.commit()
    await db.refresh(appointment)
    
    return appointment


@router.get("/appointments/{appointment_id}", response_model=AppointmentResponse)
async def get_appointment(
    appointment_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get appointment by ID."""
    result = await db.execute(
        select(Appointment).where(Appointment.id == appointment_id)
    )
    appointment = result.scalar_one_or_none()
    
    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Appointment not found",
        )
    
    return appointment


@router.put("/appointments/{appointment_id}", response_model=AppointmentResponse)
async def update_appointment(
    appointment_id: UUID,
    appointment_data: AppointmentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update an appointment."""
    result = await db.execute(
        select(Appointment).where(Appointment.id == appointment_id)
    )
    appointment = result.scalar_one_or_none()
    
    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Appointment not found",
        )
    
    update_data = appointment_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(appointment, field, value)
    
    await db.commit()
    await db.refresh(appointment)
    
    return appointment


@router.post("/appointments/{appointment_id}/checkin", response_model=AppointmentResponse)
async def checkin_appointment(
    appointment_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(allow_medical_staff),
):
    """Check in for an appointment."""
    from app.models import AppointmentStatus
    
    result = await db.execute(
        select(Appointment).where(Appointment.id == appointment_id)
    )
    appointment = result.scalar_one_or_none()
    
    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Appointment not found",
        )
    
    appointment.checked_in_at = datetime.utcnow()
    appointment.status = AppointmentStatus.CHECKED_IN
    
    await db.commit()
    await db.refresh(appointment)
    
    return appointment


@router.post("/appointments/{appointment_id}/checkout", response_model=AppointmentResponse)
async def checkout_appointment(
    appointment_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(allow_medical_staff),
):
    """Check out from an appointment."""
    from app.models import AppointmentStatus
    
    result = await db.execute(
        select(Appointment).where(Appointment.id == appointment_id)
    )
    appointment = result.scalar_one_or_none()
    
    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Appointment not found",
        )
    
    appointment.checked_out_at = datetime.utcnow()
    appointment.status = AppointmentStatus.COMPLETED
    
    await db.commit()
    await db.refresh(appointment)
    
    return appointment


@router.delete("/appointments/{appointment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_appointment(
    appointment_id: UUID,
    reason: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cancel an appointment."""
    from app.models import AppointmentStatus
    
    result = await db.execute(
        select(Appointment).where(Appointment.id == appointment_id)
    )
    appointment = result.scalar_one_or_none()
    
    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Appointment not found",
        )
    
    appointment.status = AppointmentStatus.CANCELLED
    appointment.cancellation_reason = reason
    
    await db.commit()


# Notifications
@router.get("/notifications", response_model=List[NotificationResponse])
async def list_notifications(
    unread_only: bool = False,
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get user notifications."""
    query = select(Notification).where(Notification.user_id == current_user.id)
    
    if unread_only:
        query = query.where(Notification.is_read == False)  # noqa: E712
    
    query = query.order_by(Notification.created_at.desc()).limit(limit)
    
    result = await db.execute(query)
    notifications = result.scalars().all()
    
    return notifications


@router.put("/notifications/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_read(
    notification_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark notification as read."""
    result = await db.execute(
        select(Notification).where(
            and_(
                Notification.id == notification_id,
                Notification.user_id == current_user.id
            )
        )
    )
    notification = result.scalar_one_or_none()
    
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    
    notification.is_read = True
    notification.read_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(notification)
    
    return notification


@router.put("/notifications/read-all")
async def mark_all_notifications_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark all notifications as read."""
    result = await db.execute(
        select(Notification).where(
            and_(
                Notification.user_id == current_user.id,
                Notification.is_read == False  # noqa: E712
            )
        )
    )
    notifications = result.scalars().all()
    
    for notification in notifications:
        notification.is_read = True
        notification.read_at = datetime.utcnow()
    
    await db.commit()
    
    return {"message": f"Marked {len(notifications)} notifications as read"}


# ============ Symptoms ============
# Unified schema: patient_id optional (staff must supply it, patients omit it).
class SymptomCreateRequest(BaseModel):
    """Unified symptom creation schema. Staff supply patient_id; patients omit it."""
    patient_id: Optional[UUID] = None
    cycle_id: Optional[UUID] = None
    nausea_score: Optional[int] = Field(None, ge=0, le=10)
    vomiting_count: Optional[int] = Field(None, ge=0)
    fatigue_score: Optional[int] = Field(None, ge=0, le=10)
    appetite_score: Optional[int] = Field(None, ge=0, le=10)
    pain_score: Optional[int] = Field(None, ge=0, le=10)
    has_fever: Optional[bool] = None
    has_mouth_sores: Optional[bool] = None
    has_diarrhea: Optional[bool] = None
    has_constipation: Optional[bool] = None
    has_numbness: Optional[bool] = None
    has_hair_loss: Optional[bool] = None
    has_skin_changes: Optional[bool] = None
    other_symptoms: Optional[str] = None
    mood_notes: Optional[str] = None

    @field_validator('other_symptoms', 'mood_notes', mode='before')
    @classmethod
    def sanitize_text(cls, v):
        return _strip_tags(v)


def _compute_symptom_severity(data: SymptomCreateRequest):
    """Returns (ai_severity_score, ai_alert_level, ai_recommendations)."""
    scores = []
    if data.nausea_score:
        scores.append(data.nausea_score / 10)
    if data.fatigue_score:
        scores.append(data.fatigue_score / 10)
    if data.pain_score:
        scores.append(data.pain_score / 10)
    if data.appetite_score:
        scores.append((10 - data.appetite_score) / 10)

    boolean_active = sum(1 for s in [
        data.has_fever, data.has_mouth_sores, data.has_diarrhea,
        data.has_constipation, data.has_numbness, data.has_hair_loss, data.has_skin_changes,
    ] if s)

    avg = round(sum(scores) / len(scores), 2) if scores else None

    if data.has_fever or (avg and avg > 0.7) or (data.pain_score and data.pain_score >= 8):
        return avg, "urgent", "Your symptoms are concerning. Please contact your care team immediately."
    elif (avg and avg > 0.4) or boolean_active >= 3:
        return avg, "monitor", "Monitor your symptoms closely. Contact your care team if symptoms worsen."
    else:
        return avg, "normal", "Symptoms appear manageable. Continue with your care plan."


@router.post("/symptoms", response_model=SymptomEntryResponse, status_code=status.HTTP_201_CREATED)
async def create_symptom(
    symptom_data: SymptomCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Log symptoms. Role-aware:
    - Patient: patient_id resolved from token.
    - Staff: patient_id must be provided in body.
    """
    if current_user.role == UserRole.PATIENT:
        result = await db.execute(select(Patient).where(Patient.user_id == current_user.id))
        patient = result.scalar_one_or_none()
        if not patient:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient profile not found")
        patient_id = patient.id
    else:
        if not symptom_data.patient_id:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="patient_id is required for staff")
        patient_id = symptom_data.patient_id

    ai_score, ai_level, ai_rec = _compute_symptom_severity(symptom_data)

    entry = SymptomEntry(
        patient_id=patient_id,
        cycle_id=symptom_data.cycle_id,
        nausea_score=symptom_data.nausea_score,
        vomiting_count=symptom_data.vomiting_count,
        fatigue_score=symptom_data.fatigue_score,
        appetite_score=symptom_data.appetite_score,
        pain_score=symptom_data.pain_score,
        has_fever=symptom_data.has_fever or False,
        has_mouth_sores=symptom_data.has_mouth_sores or False,
        has_diarrhea=symptom_data.has_diarrhea or False,
        has_constipation=symptom_data.has_constipation or False,
        has_numbness=symptom_data.has_numbness or False,
        has_hair_loss=symptom_data.has_hair_loss or False,
        has_skin_changes=symptom_data.has_skin_changes or False,
        other_symptoms=symptom_data.other_symptoms,
        mood_notes=symptom_data.mood_notes,
        ai_severity_score=ai_score,
        ai_alert_level=ai_level,
        ai_recommendations=ai_rec,
    )

    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry


@router.get("/symptoms", response_model=List[SymptomEntryResponse])
async def list_symptoms(
    patient_id: Optional[UUID] = None,
    limit: int = Query(30, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List symptoms. Role-aware:
    - Patient: returns only their own entries (patient_id param ignored).
    - Staff: patient_id param filters results.
    """
    if current_user.role == UserRole.PATIENT:
        result = await db.execute(select(Patient).where(Patient.user_id == current_user.id))
        patient = result.scalar_one_or_none()
        if not patient:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient profile not found")
        filter_patient_id = patient.id
    else:
        filter_patient_id = patient_id

    query = select(SymptomEntry).order_by(SymptomEntry.recorded_at.desc()).limit(limit)
    if filter_patient_id:
        query = query.where(SymptomEntry.patient_id == filter_patient_id)

    result = await db.execute(query)
    return result.scalars().all()


# ============ Drug Administrations / Medications ============

class MedicationResponse(BaseModel):
    id: str
    patient_id: str
    patient_name: str
    drug_name: str
    dose: str
    planned_dose: str
    unit: str
    route: str
    status: str
    scheduled_time: str
    notes: Optional[str] = None


class MedicationStatusUpdate(BaseModel):
    status: str = Field(..., description="Status: pending, in_progress, completed, held")


@router.get("/medications/today", response_model=List[MedicationResponse])
async def get_today_medications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(allow_nurses),
):
    """Get today's medications for all patients in day care."""
    try:
        from app.models.treatment import TreatmentCycle, DrugAdministration, CycleStatus, TreatmentPlan
        
        today = date.today()
        
        # Get today's active cycles with their appointments
        result = await db.execute(
            select(TreatmentCycle)
            .where(
                and_(
                    TreatmentCycle.scheduled_date == today,
                    TreatmentCycle.status.in_([CycleStatus.APPROVED, CycleStatus.IN_PROGRESS, CycleStatus.PRE_ASSESSMENT])
                )
            )
        )
        cycles = result.scalars().all()
        
        medications = []
        for cycle in cycles:
            # Get drug administrations for this cycle
            drug_result = await db.execute(
                select(DrugAdministration).where(DrugAdministration.cycle_id == cycle.id)
            )
            drugs = drug_result.scalars().all()
            
            # Get patient info via treatment plan
            plan_result = await db.execute(
                select(TreatmentPlan).where(TreatmentPlan.id == cycle.treatment_plan_id)
            )
            plan = plan_result.scalar_one_or_none()
            
            patient = None
            if plan:
                patient_result = await db.execute(
                    select(Patient).where(Patient.id == plan.patient_id)
                )
                patient = patient_result.scalar_one_or_none()
            
            # Try to get the appointment time for this cycle
            appt_result = await db.execute(
                select(Appointment).where(Appointment.cycle_id == cycle.id)
            )
            appointment = appt_result.scalar_one_or_none()
            default_time = appointment.scheduled_time if appointment else None
            
            for drug in drugs:
                # Use appointment time, or default
                drug_time = default_time
                time_str = drug_time.strftime("%H:%M") if drug_time else "09:00"
                
                medications.append(MedicationResponse(
                    id=str(drug.id),
                    patient_id=str(patient.id) if patient else "",
                    patient_name=f"{patient.first_name} {patient.last_name}" if patient else "Unknown",
                    drug_name=drug.drug_name,
                    dose=f"{drug.planned_dose}{drug.unit}",
                    planned_dose=str(drug.planned_dose),
                    unit=drug.unit,
                    route=drug.route,
                    status=drug.status.value if drug.status else "pending",
                    scheduled_time=time_str,
                    notes=drug.notes,
                ))
        
        return medications
    except Exception as e:
        import logging
        logging.error(f"Error in get_today_medications: {e}")
        # Return empty list on error to not break the mobile app
        return []


@router.put("/medications/{medication_id}/status", response_model=MedicationResponse)
async def update_medication_status(
    medication_id: UUID,
    status_update: MedicationStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(allow_nurses),
):
    """Update medication administration status."""
    from app.models.treatment import DrugAdministration, AdminStatus
    from app.models import Nurse
    
    result = await db.execute(
        select(DrugAdministration).where(DrugAdministration.id == medication_id)
    )
    drug = result.scalar_one_or_none()
    
    if not drug:
        raise HTTPException(status_code=404, detail="Medication not found")
    
    # Get nurse ID
    nurse_result = await db.execute(select(Nurse).where(Nurse.user_id == current_user.id))
    nurse = nurse_result.scalar_one_or_none()
    
    # Update status - map frontend values to backend enum
    status_map = {
        "pending": AdminStatus.PENDING,
        "prepared": AdminStatus.PREPARED,
        "verified": AdminStatus.VERIFIED,
        "started": AdminStatus.STARTED,
        "paused": AdminStatus.PAUSED,
        "resumed": AdminStatus.RESUMED,
        "completed": AdminStatus.COMPLETED,
        "stopped": AdminStatus.STOPPED,
        # Legacy mappings for backward compatibility
        "in_progress": AdminStatus.STARTED,
        "held": AdminStatus.PAUSED,
        "cancelled": AdminStatus.STOPPED,
    }
    
    new_status = status_map.get(status_update.status, AdminStatus.PENDING)
    drug.status = new_status
    
    if new_status == AdminStatus.STARTED:
        drug.started_at = datetime.utcnow()
        drug.administered_by = nurse.id if nurse else None
    elif new_status == AdminStatus.COMPLETED:
        drug.completed_at = datetime.utcnow()
        drug.actual_dose = drug.planned_dose
    
    await db.commit()
    await db.refresh(drug)
    
    # Get scheduled time from cycle's appointment (scheduled_time column was removed from DrugAdministration)
    from app.models.treatment import TreatmentCycle
    time_str = "09:00"
    cycle_result = await db.execute(
        select(TreatmentCycle).where(TreatmentCycle.id == drug.cycle_id)
    )
    cycle = cycle_result.scalar_one_or_none()
    if cycle:
        appt_result = await db.execute(
            select(Appointment).where(Appointment.cycle_id == cycle.id)
        )
        appointment = appt_result.scalar_one_or_none()
        if appointment and appointment.scheduled_time:
            time_str = appointment.scheduled_time.strftime("%H:%M")
    
    return MedicationResponse(
        id=str(drug.id),
        patient_id="",
        patient_name="",
        drug_name=drug.drug_name,
        dose=f"{drug.planned_dose}{drug.unit}",
        planned_dose=str(drug.planned_dose),
        unit=drug.unit,
        route=drug.route,
        status=drug.status.value,
        scheduled_time=time_str,
        notes=drug.notes,
    )


# ============ Dashboard Stats Endpoint ============

class DashboardStatsResponse(BaseModel):
    total_patients: int
    today_appointments: int
    active_treatments: int
    pending_alerts: int


@router.get("/dashboard/stats", response_model=DashboardStatsResponse)
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(allow_medical_staff),
):
    """Get dashboard statistics (single optimized endpoint)."""
    today = date.today()
    
    # Count patients
    patient_result = await db.execute(select(Patient))
    total_patients = len(patient_result.scalars().all())
    
    # Count today's appointments
    appt_result = await db.execute(
        select(Appointment).where(Appointment.scheduled_date == today)
    )
    today_appointments = len(appt_result.scalars().all())
    
    # Count active treatments (checked_in or in_progress)
    from app.models import AppointmentStatus
    active_result = await db.execute(
        select(Appointment).where(
            and_(
                Appointment.scheduled_date == today,
                Appointment.status.in_([AppointmentStatus.CHECKED_IN, AppointmentStatus.IN_PROGRESS])
            )
        )
    )
    active_treatments = len(active_result.scalars().all())
    
    # Count unread notifications as pending alerts
    alert_result = await db.execute(
        select(Notification).where(
            and_(
                Notification.user_id == current_user.id,
                Notification.is_read == False  # noqa: E712
            )
        )
    )
    pending_alerts = len(alert_result.scalars().all())
    
    return DashboardStatsResponse(
        total_patients=total_patients,
        today_appointments=today_appointments,
        active_treatments=active_treatments,
        pending_alerts=pending_alerts,
    )


# ============ Patient Dashboard Stats ============

class PatientDashboardStatsResponse(BaseModel):
    next_appointment: Optional[str] = None
    days_until_next: int = 0
    completed_sessions: int = 0
    upcoming_sessions: int = 0
    last_vitals_date: Optional[str] = None


@router.get("/dashboard/patient-stats", response_model=PatientDashboardStatsResponse)
async def get_patient_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get dashboard statistics for patients."""
    if current_user.role != UserRole.PATIENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only patients can access this endpoint"
        )
    
    # Get patient record
    result = await db.execute(select(Patient).where(Patient.user_id == current_user.id))
    patient = result.scalar_one_or_none()
    
    if not patient:
        return PatientDashboardStatsResponse()
    
    today = date.today()
    
    # Get upcoming appointments
    from app.models import AppointmentStatus
    upcoming_result = await db.execute(
        select(Appointment).where(
            and_(
                Appointment.patient_id == patient.id,
                Appointment.scheduled_date >= today,
                Appointment.status.notin_([AppointmentStatus.CANCELLED, AppointmentStatus.COMPLETED])
            )
        ).order_by(Appointment.scheduled_date)
    )
    upcoming_appts = upcoming_result.scalars().all()
    
    # Get completed appointments
    completed_result = await db.execute(
        select(Appointment).where(
            and_(
                Appointment.patient_id == patient.id,
                Appointment.status == AppointmentStatus.COMPLETED
            )
        )
    )
    completed_appts = completed_result.scalars().all()
    
    # Get last vitals
    vitals_result = await db.execute(
        select(Vital).where(Vital.patient_id == patient.id).order_by(Vital.recorded_at.desc()).limit(1)
    )
    last_vital = vitals_result.scalar_one_or_none()
    
    # Calculate stats
    next_appointment = None
    days_until_next = 0
    if upcoming_appts:
        next_appt = upcoming_appts[0]
        next_appointment = next_appt.scheduled_date.isoformat()
        days_until_next = (next_appt.scheduled_date - today).days
    
    return PatientDashboardStatsResponse(
        next_appointment=next_appointment,
        days_until_next=days_until_next,
        completed_sessions=len(completed_appts),
        upcoming_sessions=len(upcoming_appts),
        last_vitals_date=last_vital.recorded_at.isoformat() if last_vital else None,
    )
