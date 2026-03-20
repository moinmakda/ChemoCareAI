"""SQLAlchemy models for take-home medications and adherence tracking."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Date, Text, ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class TakeHomeMedication(Base):
    """Take-home medications prescribed after chemo cycles."""
    __tablename__ = "take_home_medications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cycle_id = Column(UUID(as_uuid=True), ForeignKey("treatment_cycles.id"), nullable=True)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    drug_name = Column(String(200), nullable=False)
    dose = Column(String(100), nullable=True)
    unit = Column(String(20), nullable=True)
    route = Column(String(50), nullable=True)
    frequency = Column(String(100), nullable=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    instructions = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("Patient", backref="take_home_medications")
    logs = relationship("MedicationLog", back_populates="medication", cascade="all, delete-orphan")


class MedicationLog(Base):
    """Log of take-home medication adherence."""
    __tablename__ = "medication_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    medication_id = Column(UUID(as_uuid=True), ForeignKey("take_home_medications.id"), nullable=False)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    scheduled_date = Column(Date, nullable=True)
    scheduled_time = Column(String(20), nullable=True)
    taken_at = Column(DateTime, nullable=True)
    skipped = Column(Boolean, default=False)
    skip_reason = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    medication = relationship("TakeHomeMedication", back_populates="logs")
    patient = relationship("Patient", backref="medication_logs")
