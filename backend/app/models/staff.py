"""
SQLAlchemy models for medical staff (doctors and nurses).
"""
import uuid
from datetime import datetime, date
from sqlalchemy import Column, String, Boolean, DateTime, Date, Text, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class Doctor(Base):
    """Doctor model."""
    
    __tablename__ = "doctors"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    specialization = Column(String(200), nullable=True)
    qualification = Column(String(500), nullable=True)
    registration_number = Column(String(100), unique=True, nullable=False)
    experience_years = Column(Integer, nullable=True)
    
    # Department
    is_opd_doctor = Column(Boolean, default=False)
    is_daycare_doctor = Column(Boolean, default=False)
    
    profile_photo_url = Column(Text, nullable=True)
    signature_url = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", backref="doctor_profile")
    
    @property
    def full_name(self) -> str:
        """Get full name with title."""
        return f"Dr. {self.first_name} {self.last_name}"
    
    def __repr__(self):
        return f"<Doctor {self.full_name}>"


class Nurse(Base):
    """Nurse model."""
    
    __tablename__ = "nurses"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    qualification = Column(String(500), nullable=True)
    registration_number = Column(String(100), unique=True, nullable=False)
    experience_years = Column(Integer, nullable=True)
    
    # Certifications
    chemo_certified = Column(Boolean, default=False)
    certification_date = Column(Date, nullable=True)
    
    profile_photo_url = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", backref="nurse_profile")
    
    @property
    def full_name(self) -> str:
        """Get full name."""
        return f"{self.first_name} {self.last_name}"
    
    def __repr__(self):
        return f"<Nurse {self.full_name}>"
