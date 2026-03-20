"""
Pydantic schemas for clinical data (vitals, documents, appointments, etc.).
"""
import re
from datetime import date, time, datetime
from typing import Optional, List, Any, Dict
from uuid import UUID
from pydantic import BaseModel, Field, field_serializer, field_validator
from app.models.clinical import (
    DocumentType,
    AppointmentType,
    AppointmentStatus,
    NotificationType,
)


def _strip_tags(value: Optional[str]) -> Optional[str]:
    """Remove HTML/script tags from free-text input to prevent stored XSS."""
    if value is None:
        return None
    return re.sub(r'<[^>]+>', '', value).strip()


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

    @field_validator('notes', 'pain_location', 'timing', mode='before')
    @classmethod
    def sanitize_text(cls, v):
        return _strip_tags(v)


class VitalResponse(BaseModel):
    """Schema for vital response."""
    id: UUID
    patient_id: UUID
    cycle_id: Optional[UUID] = None
    recorded_at: datetime
    recorded_by: Optional[UUID] = None
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
    
    @field_serializer('id', 'patient_id', 'cycle_id', 'recorded_by')
    def serialize_uuid(self, v):
        if v is None:
            return None
        return str(v)


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
    id: UUID
    patient_id: UUID
    appointment_type: AppointmentType
    scheduled_date: date
    scheduled_time: time
    duration_mins: int
    cycle_id: Optional[UUID] = None
    chair_number: Optional[int] = None
    doctor_id: Optional[UUID] = None
    nurse_id: Optional[UUID] = None
    status: AppointmentStatus
    checked_in_at: Optional[datetime] = None
    checked_out_at: Optional[datetime] = None
    notes: Optional[str] = None
    cancellation_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
    
    @field_serializer('id', 'patient_id', 'cycle_id', 'doctor_id', 'nurse_id')
    def serialize_uuid(self, v):
        if v is None:
            return None
        return str(v)


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
    id: UUID
    user_id: UUID
    type: NotificationType
    title: str
    body: str
    data: Optional[Dict[str, Any]] = None
    is_read: bool
    read_at: Optional[datetime] = None
    created_at: datetime
    
    class Config:
        from_attributes = True
    
    @field_serializer('id', 'user_id')
    def serialize_uuid(self, v):
        if v is None:
            return None
        return str(v)


# Symptom Entry Schemas
class SymptomEntryCreate(BaseModel):
    """Schema for creating a symptom entry."""
    patient_id: Optional[str] = None  # Optional for /symptoms/me endpoint
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

    @field_validator('other_symptoms', 'mood_notes', mode='before')
    @classmethod
    def sanitize_text(cls, v):
        return _strip_tags(v)


class SymptomEntryResponse(BaseModel):
    """Schema for symptom entry response."""
    id: UUID
    patient_id: UUID
    cycle_id: Optional[UUID] = None
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
    
    @field_serializer('id', 'patient_id', 'cycle_id')
    def serialize_uuid(self, v):
        if v is None:
            return None
        return str(v)


class MedicationResponse(BaseModel):
    """Response for a medication/drug administration."""
    id: str
    patient_id: str
    cycle_id: str = ""
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
    """Request to update medication status."""
    status: str = Field(..., description="Status: pending, in_progress, completed, held")


class DashboardStatsResponse(BaseModel):
    """Dashboard statistics for medical staff."""
    total_patients: int
    today_appointments: int
    active_treatments: int
    pending_alerts: int


class PatientDashboardStatsResponse(BaseModel):
    """Dashboard statistics for patients."""
    next_appointment: Optional[str] = None
    days_until_next: int = 0
    completed_sessions: int = 0
    upcoming_sessions: int = 0
    last_vitals_date: Optional[str] = None


# Clinical Notes (Feature 8)
class ClinicalNoteCreate(BaseModel):
    patient_id: str
    cycle_id: Optional[str] = None
    appointment_id: Optional[str] = None
    note_type: str = "clinical"
    content: str
    is_private: bool = False

    @field_validator('content', mode='before')
    @classmethod
    def sanitize_content(cls, v):
        return _strip_tags(v)


class ClinicalNoteUpdate(BaseModel):
    content: Optional[str] = None
    note_type: Optional[str] = None
    is_private: Optional[bool] = None

    @field_validator('content', mode='before')
    @classmethod
    def sanitize_content(cls, v):
        return _strip_tags(v)


class ClinicalNoteResponse(BaseModel):
    id: UUID
    patient_id: UUID
    doctor_id: UUID
    cycle_id: Optional[UUID] = None
    appointment_id: Optional[UUID] = None
    note_type: str
    content: str
    is_private: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Shift Handover (Feature 9)
class ShiftHandoverCreate(BaseModel):
    shift_date: date
    shift_type: str  # "morning", "afternoon", "night"
    patients_summary: List[Dict[str, Any]] = []
    general_notes: Optional[str] = None

    @field_validator('general_notes', mode='before')
    @classmethod
    def sanitize_notes(cls, v):
        return _strip_tags(v)


class ShiftHandoverResponse(BaseModel):
    id: UUID
    shift_date: date
    shift_type: str
    outgoing_nurse_id: Optional[UUID] = None
    incoming_nurse_id: Optional[UUID] = None
    patients_summary: List[Dict[str, Any]] = []
    general_notes: Optional[str] = None
    acknowledged_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


# Lab Results (Feature 7)
class LabUpload(BaseModel):
    patient_id: str
    title: str
    lab_date: Optional[date] = None
    parameters: Dict[str, Any] = {}
    notes: Optional[str] = None

    @field_validator('title', 'notes', mode='before')
    @classmethod
    def sanitize_text_fields(cls, v):
        return _strip_tags(v)


class LabResultResponse(BaseModel):
    id: str
    patient_id: str
    title: str
    lab_date: Optional[date] = None
    parameters: Dict[str, Any] = {}
    source: str  # "upload", "pre_chemo", "clinical_data"
    created_at: datetime

    class Config:
        from_attributes = True


class LabTrendPoint(BaseModel):
    date: date
    value: float
    source: str


class LabTrendResponse(BaseModel):
    parameter: str
    unit: Optional[str] = None
    points: List[LabTrendPoint]


# Photo Documentation (Feature 15)
class PhotoUploadRequest(BaseModel):
    patient_id: str
    category: str = "other"  # "port_site", "skin_reaction", "wound", "other"
    description: Optional[str] = None
    cycle_id: Optional[str] = None

    @field_validator('description', mode='before')
    @classmethod
    def sanitize_description(cls, v):
        return _strip_tags(v)


class PhotoResponse(BaseModel):
    id: str
    patient_id: str
    file_url: str
    category: str
    description: Optional[str] = None
    uploaded_at: datetime
    uploaded_by: Optional[str] = None

    class Config:
        from_attributes = True
