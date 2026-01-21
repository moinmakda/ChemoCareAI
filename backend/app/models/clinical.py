"""
SQLAlchemy models for documents, vitals, appointments, and notifications.
"""
import uuid
from datetime import datetime
from enum import Enum as PyEnum
from sqlalchemy import Column, String, Boolean, DateTime, Date, Time, Text, ForeignKey, Integer, Numeric, Enum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base


class DocumentType(str, PyEnum):
    """Document type options."""
    PRESCRIPTION = "prescription"
    LAB_REPORT = "lab_report"
    PATHOLOGY = "pathology"
    RADIOLOGY = "radiology"
    DISCHARGE_SUMMARY = "discharge_summary"
    INSURANCE = "insurance"
    CONSENT_FORM = "consent_form"
    OTHER = "other"


class AppointmentType(str, PyEnum):
    """Appointment type options."""
    OPD_CONSULTATION = "opd_consultation"
    DAYCARE_CHEMO = "daycare_chemo"
    FOLLOW_UP = "follow_up"
    LAB_WORK = "lab_work"
    IMAGING = "imaging"
    OTHER = "other"


class AppointmentStatus(str, PyEnum):
    """Appointment status options."""
    SCHEDULED = "scheduled"
    CONFIRMED = "confirmed"
    CHECKED_IN = "checked_in"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"
    RESCHEDULED = "rescheduled"


class NotificationType(str, PyEnum):
    """Notification type options."""
    APPOINTMENT_REMINDER = "appointment_reminder"
    LAB_REMINDER = "lab_reminder"
    APPROVAL_REQUEST = "approval_request"
    APPROVAL_RECEIVED = "approval_received"
    CYCLE_COMPLETED = "cycle_completed"
    VITALS_ALERT = "vitals_alert"
    REACTION_ALERT = "reaction_alert"
    DOCUMENT_UPLOADED = "document_uploaded"
    MESSAGE = "message"
    SYSTEM = "system"


class Document(Base):
    """Patient documents model."""
    
    __tablename__ = "documents"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    
    document_type = Column(Enum(DocumentType), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    file_url = Column(Text, nullable=False)
    file_type = Column(String(50), nullable=True)
    file_size_bytes = Column(Integer, nullable=True)
    
    # AI Extracted Data
    extracted_text = Column(Text, nullable=True)
    extracted_data = Column(JSONB, nullable=True)
    
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    
    is_verified = Column(Boolean, default=False)
    verified_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    verified_at = Column(DateTime, nullable=True)
    
    # Relationships
    patient = relationship("Patient", backref="documents")
    
    def __repr__(self):
        return f"<Document {self.title}>"


class Vital(Base):
    """Patient vitals monitoring model."""
    
    __tablename__ = "vitals"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    cycle_id = Column(UUID(as_uuid=True), ForeignKey("treatment_cycles.id"), nullable=True)
    
    recorded_at = Column(DateTime, default=datetime.utcnow)
    recorded_by = Column(UUID(as_uuid=True), ForeignKey("nurses.id"), nullable=True)
    
    # Vitals
    temperature_f = Column(Numeric(4, 1), nullable=True)
    pulse_bpm = Column(Integer, nullable=True)
    blood_pressure_systolic = Column(Integer, nullable=True)
    blood_pressure_diastolic = Column(Integer, nullable=True)
    respiratory_rate = Column(Integer, nullable=True)
    oxygen_saturation = Column(Integer, nullable=True)
    
    # Pain Assessment
    pain_score = Column(Integer, nullable=True)
    pain_location = Column(String(200), nullable=True)
    
    # Additional
    blood_sugar = Column(Numeric(5, 1), nullable=True)
    weight_kg = Column(Numeric(5, 2), nullable=True)
    
    notes = Column(Text, nullable=True)
    timing = Column(String(50), nullable=True)  # 'pre_chemo', 'during_infusion', etc.
    
    # AI Alerts
    ai_alerts = Column(JSONB, default=list)
    
    # Relationships
    patient = relationship("Patient", backref="vitals")
    
    def __repr__(self):
        return f"<Vital for Patient {self.patient_id} at {self.recorded_at}>"


class Appointment(Base):
    """Appointment model."""
    
    __tablename__ = "appointments"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    
    appointment_type = Column(Enum(AppointmentType), nullable=False)
    scheduled_date = Column(Date, nullable=False)
    scheduled_time = Column(Time, nullable=False)
    duration_mins = Column(Integer, default=30)
    
    # For chemo appointments
    cycle_id = Column(UUID(as_uuid=True), ForeignKey("treatment_cycles.id"), nullable=True)
    chair_number = Column(Integer, nullable=True)
    
    # Staff assigned
    doctor_id = Column(UUID(as_uuid=True), ForeignKey("doctors.id"), nullable=True)
    nurse_id = Column(UUID(as_uuid=True), ForeignKey("nurses.id"), nullable=True)
    
    status = Column(Enum(AppointmentStatus), default=AppointmentStatus.SCHEDULED)
    
    # Check-in/out
    checked_in_at = Column(DateTime, nullable=True)
    checked_out_at = Column(DateTime, nullable=True)
    
    notes = Column(Text, nullable=True)
    cancellation_reason = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    patient = relationship("Patient", backref="appointments")
    
    def __repr__(self):
        return f"<Appointment {self.appointment_type} on {self.scheduled_date}>"


class Notification(Base):
    """User notifications model."""
    
    __tablename__ = "notifications"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    type = Column(Enum(NotificationType), nullable=False)
    title = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    data = Column(JSONB, nullable=True)
    
    is_read = Column(Boolean, default=False)
    read_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User", backref="notifications")
    
    def __repr__(self):
        return f"<Notification {self.title}>"


class SymptomEntry(Base):
    """Patient symptom diary entries."""
    
    __tablename__ = "symptom_entries"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    cycle_id = Column(UUID(as_uuid=True), ForeignKey("treatment_cycles.id"), nullable=True)
    
    recorded_at = Column(DateTime, default=datetime.utcnow)
    
    # Common chemo symptoms (0-10 scale)
    nausea_score = Column(Integer, nullable=True)
    vomiting_count = Column(Integer, nullable=True)
    fatigue_score = Column(Integer, nullable=True)
    appetite_score = Column(Integer, nullable=True)
    pain_score = Column(Integer, nullable=True)
    
    # Specific symptoms
    has_fever = Column(Boolean, default=False)
    has_mouth_sores = Column(Boolean, default=False)
    has_diarrhea = Column(Boolean, default=False)
    has_constipation = Column(Boolean, default=False)
    has_numbness = Column(Boolean, default=False)
    has_hair_loss = Column(Boolean, default=False)
    has_skin_changes = Column(Boolean, default=False)
    
    # Free text
    other_symptoms = Column(Text, nullable=True)
    mood_notes = Column(Text, nullable=True)
    
    # AI Analysis
    ai_severity_score = Column(Numeric(3, 2), nullable=True)
    ai_recommendations = Column(Text, nullable=True)
    ai_alert_level = Column(String(20), nullable=True)  # 'normal', 'monitor', 'urgent'
    
    # Relationships
    patient = relationship("Patient", backref="symptom_entries")
    
    def __repr__(self):
        return f"<SymptomEntry for Patient {self.patient_id} at {self.recorded_at}>"
