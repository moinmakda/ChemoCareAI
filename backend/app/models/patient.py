"""
SQLAlchemy models for patients.
"""
import uuid
from datetime import datetime, date
from enum import Enum as PyEnum
from sqlalchemy import Column, String, Boolean, DateTime, Date, Text, ForeignKey, Numeric, Enum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base


class Gender(str, PyEnum):
    """Gender options."""
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"


class BloodGroup(str, PyEnum):
    """Blood group options."""
    A_POS = "A+"
    A_NEG = "A-"
    B_POS = "B+"
    B_NEG = "B-"
    AB_POS = "AB+"
    AB_NEG = "AB-"
    O_POS = "O+"
    O_NEG = "O-"


class Patient(Base):
    """Patient model."""
    
    __tablename__ = "patients"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    
    # Basic Info
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    date_of_birth = Column(Date, nullable=False)
    gender = Column(Enum(Gender), nullable=False)
    blood_group = Column(Enum(BloodGroup), nullable=True)
    
    # Contact
    address = Column(Text, nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    pincode = Column(String(10), nullable=True)
    emergency_contact_name = Column(String(200), nullable=True)
    emergency_contact_phone = Column(String(20), nullable=True)
    emergency_contact_relation = Column(String(50), nullable=True)
    
    # Physical measurements
    height_cm = Column(Numeric(5, 2), nullable=True)
    weight_kg = Column(Numeric(5, 2), nullable=True)
    
    # Allergies & Comorbidities
    allergies = Column(JSONB, default=list)
    comorbidities = Column(JSONB, default=list)
    current_medications = Column(JSONB, default=list)
    
    # Cancer Info
    cancer_type = Column(String(200), nullable=True)
    cancer_stage = Column(String(50), nullable=True)
    diagnosis_date = Column(Date, nullable=True)
    histopathology_details = Column(Text, nullable=True)
    
    # Insurance
    insurance_provider = Column(String(200), nullable=True)
    insurance_policy_number = Column(String(100), nullable=True)
    insurance_validity = Column(Date, nullable=True)
    
    # Profile
    profile_photo_url = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", backref="patient_profile")
    
    @property
    def bsa(self) -> float:
        """Calculate Body Surface Area using Mosteller formula."""
        if self.height_cm and self.weight_kg:
            return round(((float(self.height_cm) * float(self.weight_kg)) / 3600) ** 0.5, 2)
        return 0.0
    
    @property
    def age(self) -> int:
        """Calculate age from date of birth."""
        if self.date_of_birth:
            today = date.today()
            return today.year - self.date_of_birth.year - (
                (today.month, today.day) < (self.date_of_birth.month, self.date_of_birth.day)
            )
        return 0
    
    @property
    def full_name(self) -> str:
        """Get full name."""
        return f"{self.first_name} {self.last_name}"
    
    def __repr__(self):
        return f"<Patient {self.full_name}>"
