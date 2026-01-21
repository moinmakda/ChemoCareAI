"""
Pydantic schemas for clinical data (vitals, documents, appointments, etc.).
"""
from datetime import date, time, datetime
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, Field
from app.models.clinical import (
    DocumentType,
    AppointmentType,
    AppointmentStatus,
    NotificationType,
)


# Document Schemas
class DocumentCreate(BaseModel):
    """Schema for creating a document."""
    patient_id: str
    document_type: DocumentType
    title: str
    description: Optional[str] = None
    file_url: str
    file_type: Optional[str] = None
    file_size_bytes: Optional[int] = None


class DocumentResponse(BaseModel):
    """Schema for document response."""
    id: str
    patient_id: str
    document_type: DocumentType
    title: str
    description: Optional[str] = None
    file_url: str
    file_type: Optional[str] = None
    file_size_bytes: Optional[int] = None
    extracted_text: Optional[str] = None
    extracted_data: Optional[Dict[str, Any]] = None
    uploaded_by: Optional[str] = None
    uploaded_at: datetime
    is_verified: bool
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


# Vital Schemas
class VitalCreate(BaseModel):
    """Schema for creating a vital record."""
    patient_id: str
    cycle_id: Optional[str] = None
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
    timing: Optional[str] = None


class VitalResponse(BaseModel):
    """Schema for vital response."""
    id: str
    patient_id: str
    cycle_id: Optional[str] = None
    recorded_at: datetime
    recorded_by: Optional[str] = None
    temperature_f: Optional[float] = None
    pulse_bpm: Optional[int] = None
    blood_pressure_systolic: Optional[int] = None
    blood_pressure_diastolic: Optional[int] = None
    respiratory_rate: Optional[int] = None
    oxygen_saturation: Optional[int] = None
    pain_score: Optional[int] = None
    pain_location: Optional[str] = None
    blood_sugar: Optional[float] = None
    weight_kg: Optional[float] = None
    notes: Optional[str] = None
    timing: Optional[str] = None
    ai_alerts: List[Dict[str, Any]] = []
    
    class Config:
        from_attributes = True


# Appointment Schemas
class AppointmentCreate(BaseModel):
    """Schema for creating an appointment."""
    patient_id: str
    appointment_type: AppointmentType
    scheduled_date: date
    scheduled_time: time
    duration_mins: int = 30
    cycle_id: Optional[str] = None
    chair_number: Optional[int] = None
    doctor_id: Optional[str] = None
    nurse_id: Optional[str] = None
    notes: Optional[str] = None


class AppointmentUpdate(BaseModel):
    """Schema for updating an appointment."""
    scheduled_date: Optional[date] = None
    scheduled_time: Optional[time] = None
    duration_mins: Optional[int] = None
    status: Optional[AppointmentStatus] = None
    chair_number: Optional[int] = None
    doctor_id: Optional[str] = None
    nurse_id: Optional[str] = None
    notes: Optional[str] = None
    cancellation_reason: Optional[str] = None


class AppointmentResponse(BaseModel):
    """Schema for appointment response."""
    id: str
    patient_id: str
    appointment_type: AppointmentType
    scheduled_date: date
    scheduled_time: time
    duration_mins: int
    cycle_id: Optional[str] = None
    chair_number: Optional[int] = None
    doctor_id: Optional[str] = None
    nurse_id: Optional[str] = None
    status: AppointmentStatus
    checked_in_at: Optional[datetime] = None
    checked_out_at: Optional[datetime] = None
    notes: Optional[str] = None
    cancellation_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# Notification Schemas
class NotificationCreate(BaseModel):
    """Schema for creating a notification."""
    user_id: str
    type: NotificationType
    title: str
    body: str
    data: Optional[Dict[str, Any]] = None


class NotificationResponse(BaseModel):
    """Schema for notification response."""
    id: str
    user_id: str
    type: NotificationType
    title: str
    body: str
    data: Optional[Dict[str, Any]] = None
    is_read: bool
    read_at: Optional[datetime] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


# Symptom Entry Schemas
class SymptomEntryCreate(BaseModel):
    """Schema for creating a symptom entry."""
    patient_id: str
    cycle_id: Optional[str] = None
    nausea_score: Optional[int] = Field(None, ge=0, le=10)
    vomiting_count: Optional[int] = None
    fatigue_score: Optional[int] = Field(None, ge=0, le=10)
    appetite_score: Optional[int] = Field(None, ge=0, le=10)
    pain_score: Optional[int] = Field(None, ge=0, le=10)
    has_fever: bool = False
    has_mouth_sores: bool = False
    has_diarrhea: bool = False
    has_constipation: bool = False
    has_numbness: bool = False
    has_hair_loss: bool = False
    has_skin_changes: bool = False
    other_symptoms: Optional[str] = None
    mood_notes: Optional[str] = None


class SymptomEntryResponse(BaseModel):
    """Schema for symptom entry response."""
    id: str
    patient_id: str
    cycle_id: Optional[str] = None
    recorded_at: datetime
    nausea_score: Optional[int] = None
    vomiting_count: Optional[int] = None
    fatigue_score: Optional[int] = None
    appetite_score: Optional[int] = None
    pain_score: Optional[int] = None
    has_fever: bool
    has_mouth_sores: bool
    has_diarrhea: bool
    has_constipation: bool
    has_numbness: bool
    has_hair_loss: bool
    has_skin_changes: bool
    other_symptoms: Optional[str] = None
    mood_notes: Optional[str] = None
    ai_severity_score: Optional[float] = None
    ai_recommendations: Optional[str] = None
    ai_alert_level: Optional[str] = None
    
    class Config:
        from_attributes = True
