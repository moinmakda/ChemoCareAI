"""
Vitals, Appointments, and Notifications API endpoints.
"""
from typing import List, Optional
from uuid import UUID
from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field
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


# Vitals
@router.post("/vitals", response_model=VitalResponse, status_code=status.HTTP_201_CREATED)
async def create_vital(
    vital_data: VitalCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(allow_nurses),
):
    """Record patient vitals (nurses only)."""
    from app.models import Nurse
    
    # Get nurse ID
    result = await db.execute(select(Nurse).where(Nurse.user_id == current_user.id))
    nurse = result.scalar_one_or_none()
    
    vital = Vital(
        **vital_data.model_dump(),
        recorded_by=nurse.id if nurse else None,
    )
    
    # AI analysis for alerts (simplified)
    alerts = []
    if vital_data.temperature_f and vital_data.temperature_f > 100.4:
        alerts.append({"type": "fever", "message": "Fever detected", "severity": "warning"})
    if vital_data.blood_pressure_systolic and vital_data.blood_pressure_systolic > 140:
        alerts.append({"type": "bp_high", "message": "Elevated blood pressure", "severity": "warning"})
    if vital_data.oxygen_saturation and vital_data.oxygen_saturation < 95:
        alerts.append({"type": "low_spo2", "message": "Low oxygen saturation", "severity": "critical"})
    if vital_data.pulse_bpm and (vital_data.pulse_bpm > 100 or vital_data.pulse_bpm < 60):
        alerts.append({"type": "abnormal_hr", "message": "Abnormal heart rate", "severity": "warning"})
    
    vital.ai_alerts = alerts
    
    db.add(vital)
    await db.commit()
    await db.refresh(vital)
    
    return vital


# Schema for patient self-logging (without patient_id)
class PatientVitalCreate(BaseModel):
    """Schema for patients logging their own vitals."""
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


@router.post("/vitals/me", response_model=VitalResponse, status_code=status.HTTP_201_CREATED)
async def log_my_vitals(
    vital_data: PatientVitalCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Log vitals for the current patient (patient self-logging)."""
    if current_user.role != UserRole.PATIENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only patients can use this endpoint",
        )
    
    # Get patient ID
    result = await db.execute(select(Patient).where(Patient.user_id == current_user.id))
    patient = result.scalar_one_or_none()
    
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient profile not found",
        )
    
    vital = Vital(
        patient_id=patient.id,
        **vital_data.model_dump(),
        timing="self_reported",
    )
    
    # AI analysis for alerts
    alerts = []
    if vital_data.temperature_f and vital_data.temperature_f > 100.4:
        alerts.append({"type": "fever", "message": "Fever detected - please contact your care team", "severity": "warning"})
    if vital_data.blood_pressure_systolic and vital_data.blood_pressure_systolic > 140:
        alerts.append({"type": "bp_high", "message": "Elevated blood pressure", "severity": "warning"})
    if vital_data.oxygen_saturation and vital_data.oxygen_saturation < 95:
        alerts.append({"type": "low_spo2", "message": "Low oxygen - seek immediate medical attention", "severity": "critical"})
    if vital_data.pulse_bpm and (vital_data.pulse_bpm > 100 or vital_data.pulse_bpm < 60):
        alerts.append({"type": "abnormal_hr", "message": "Abnormal heart rate", "severity": "warning"})
    if vital_data.temperature_f and vital_data.temperature_f > 101.3:
        alerts.append({"type": "high_fever", "message": "High fever - seek immediate medical attention", "severity": "critical"})
    
    vital.ai_alerts = alerts
    
    db.add(vital)
    await db.commit()
    await db.refresh(vital)
    
    return vital


@router.get("/vitals/me", response_model=List[VitalResponse])
async def get_my_vitals(
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get vitals history for the current patient."""
    if current_user.role != UserRole.PATIENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only patients can use this endpoint",
        )
    
    # Get patient
    result = await db.execute(select(Patient).where(Patient.user_id == current_user.id))
    patient = result.scalar_one_or_none()
    
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient profile not found",
        )
    
    result = await db.execute(
        select(Vital)
        .where(Vital.patient_id == patient.id)
        .order_by(Vital.recorded_at.desc())
        .limit(limit)
    )
    vitals = result.scalars().all()
    
    return vitals


@router.get("/vitals/{patient_id}", response_model=List[VitalResponse])
async def get_patient_vitals(
    patient_id: UUID,
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get vitals history for a patient."""
    result = await db.execute(
        select(Vital)
        .where(Vital.patient_id == patient_id)
        .order_by(Vital.recorded_at.desc())
        .limit(limit)
    )
    vitals = result.scalars().all()
    
    return vitals


@router.get("/vitals/cycle/{cycle_id}", response_model=List[VitalResponse])
async def get_cycle_vitals(
    cycle_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get vitals for a specific treatment cycle."""
    result = await db.execute(
        select(Vital)
        .where(Vital.cycle_id == cycle_id)
        .order_by(Vital.recorded_at)
    )
    vitals = result.scalars().all()
    
    return vitals


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
        query = query.where(Notification.is_read == False)
    
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
                Notification.is_read == False
            )
        )
    )
    notifications = result.scalars().all()
    
    for notification in notifications:
        notification.is_read = True
        notification.read_at = datetime.utcnow()
    
    await db.commit()
    
    return {"message": f"Marked {len(notifications)} notifications as read"}


# Symptom Diary
@router.post("/patients/{patient_id}/symptoms", response_model=SymptomEntryResponse, status_code=status.HTTP_201_CREATED)
async def create_symptom_entry(
    patient_id: UUID,
    symptom_data: SymptomEntryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Log symptoms for a patient."""
    symptom_entry = SymptomEntry(
        patient_id=patient_id,
        **symptom_data.model_dump(exclude={"patient_id"}),
    )
    
    # Simple AI severity calculation
    severity_scores = []
    if symptom_data.nausea_score:
        severity_scores.append(symptom_data.nausea_score / 10)
    if symptom_data.fatigue_score:
        severity_scores.append(symptom_data.fatigue_score / 10)
    if symptom_data.pain_score:
        severity_scores.append(symptom_data.pain_score / 10)
    
    if severity_scores:
        avg_severity = sum(severity_scores) / len(severity_scores)
        symptom_entry.ai_severity_score = round(avg_severity, 2)
        
        if avg_severity > 0.7 or symptom_data.has_fever:
            symptom_entry.ai_alert_level = "urgent"
            symptom_entry.ai_recommendations = "Please contact your care team immediately."
        elif avg_severity > 0.4:
            symptom_entry.ai_alert_level = "monitor"
            symptom_entry.ai_recommendations = "Monitor symptoms closely. Contact care team if symptoms worsen."
        else:
            symptom_entry.ai_alert_level = "normal"
            symptom_entry.ai_recommendations = "Continue with prescribed medications and rest."
    
    db.add(symptom_entry)
    await db.commit()
    await db.refresh(symptom_entry)
    
    return symptom_entry


@router.get("/patients/{patient_id}/symptoms", response_model=List[SymptomEntryResponse])
async def get_symptom_entries(
    patient_id: UUID,
    limit: int = Query(30, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get symptom diary entries for a patient."""
    result = await db.execute(
        select(SymptomEntry)
        .where(SymptomEntry.patient_id == patient_id)
        .order_by(SymptomEntry.recorded_at.desc())
        .limit(limit)
    )
    entries = result.scalars().all()
    
    return entries


# Patient self-service symptom endpoints
class PatientSymptomCreate(BaseModel):
    """Schema for patient self-logging symptoms"""
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


@router.post("/symptoms/me", response_model=SymptomEntryResponse, status_code=status.HTTP_201_CREATED)
async def log_my_symptoms(
    symptom_data: PatientSymptomCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Log symptoms for the current patient (patient self-logging)."""
    if current_user.role != UserRole.PATIENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only patients can use this endpoint",
        )
    
    # Get patient ID
    result = await db.execute(select(Patient).where(Patient.user_id == current_user.id))
    patient = result.scalar_one_or_none()
    
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient profile not found",
        )
    
    symptom_entry = SymptomEntry(
        patient_id=patient.id,
        **symptom_data.model_dump(),
    )
    
    # AI severity calculation
    severity_scores = []
    if symptom_data.nausea_score:
        severity_scores.append(symptom_data.nausea_score / 10)
    if symptom_data.fatigue_score:
        severity_scores.append(symptom_data.fatigue_score / 10)
    if symptom_data.pain_score:
        severity_scores.append(symptom_data.pain_score / 10)
    if symptom_data.appetite_score:
        # Invert appetite (0 = severe, 10 = good)
        severity_scores.append((10 - symptom_data.appetite_score) / 10)
    
    # Count boolean symptoms
    boolean_symptoms = [
        symptom_data.has_fever,
        symptom_data.has_mouth_sores,
        symptom_data.has_diarrhea,
        symptom_data.has_constipation,
        symptom_data.has_numbness,
        symptom_data.has_hair_loss,
        symptom_data.has_skin_changes,
    ]
    active_booleans = sum(1 for s in boolean_symptoms if s)
    
    if severity_scores:
        avg_severity = sum(severity_scores) / len(severity_scores)
        symptom_entry.ai_severity_score = round(avg_severity, 2)
        
        # Determine alert level
        if avg_severity > 0.7 or symptom_data.has_fever or (symptom_data.pain_score and symptom_data.pain_score >= 8):
            symptom_entry.ai_alert_level = "urgent"
            symptom_entry.ai_recommendations = "Your symptoms are concerning. Please contact your care team immediately or visit the emergency room if symptoms are severe."
        elif avg_severity > 0.4 or active_booleans >= 3:
            symptom_entry.ai_alert_level = "monitor"
            symptom_entry.ai_recommendations = "Monitor your symptoms closely. Stay hydrated, rest, and contact your care team if symptoms worsen or persist."
        else:
            symptom_entry.ai_alert_level = "normal"
            symptom_entry.ai_recommendations = "Your symptoms appear manageable. Continue with prescribed medications, rest well, and maintain good nutrition."
    else:
        # Just boolean symptoms
        if symptom_data.has_fever:
            symptom_entry.ai_alert_level = "urgent"
            symptom_entry.ai_recommendations = "Fever detected. Please contact your care team immediately."
        elif active_booleans >= 3:
            symptom_entry.ai_alert_level = "monitor"
            symptom_entry.ai_recommendations = "Multiple symptoms noted. Monitor closely and contact care team if symptoms worsen."
        else:
            symptom_entry.ai_alert_level = "normal"
            symptom_entry.ai_recommendations = "Symptoms noted. Continue with your care plan and report any changes."
    
    db.add(symptom_entry)
    await db.commit()
    await db.refresh(symptom_entry)
    
    return symptom_entry


@router.get("/symptoms/me", response_model=List[SymptomEntryResponse])
async def get_my_symptoms(
    limit: int = Query(30, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get symptom diary entries for the current patient."""
    if current_user.role != UserRole.PATIENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only patients can use this endpoint",
        )
    
    # Get patient
    result = await db.execute(select(Patient).where(Patient.user_id == current_user.id))
    patient = result.scalar_one_or_none()
    
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient profile not found",
        )
    
    result = await db.execute(
        select(SymptomEntry)
        .where(SymptomEntry.patient_id == patient.id)
        .order_by(SymptomEntry.recorded_at.desc())
        .limit(limit)
    )
    entries = result.scalars().all()
    
    return entries
