"""
Pydantic schemas for patients.
"""
from datetime import date, datetime
from typing import Optional, List, Any
from pydantic import BaseModel, Field
from app.models.patient import Gender, BloodGroup


class PatientBase(BaseModel):
    """Base patient schema."""
    first_name: str = Field(..., max_length=100)
    last_name: str = Field(..., max_length=100)
    date_of_birth: date
    gender: Gender
    blood_group: Optional[BloodGroup] = None


class PatientCreate(PatientBase):
    """Schema for creating a patient."""
    # Contact
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relation: Optional[str] = None
    
    # Physical
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    
    # Medical
    allergies: List[str] = []
    comorbidities: List[str] = []
    current_medications: List[Any] = []
    
    # Cancer
    cancer_type: Optional[str] = None
    cancer_stage: Optional[str] = None
    diagnosis_date: Optional[date] = None
    histopathology_details: Optional[str] = None
    
    # Insurance
    insurance_provider: Optional[str] = None
    insurance_policy_number: Optional[str] = None
    insurance_validity: Optional[date] = None


class PatientUpdate(BaseModel):
    """Schema for updating a patient."""
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[Gender] = None
    blood_group: Optional[BloodGroup] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relation: Optional[str] = None
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    allergies: Optional[List[str]] = None
    comorbidities: Optional[List[str]] = None
    current_medications: Optional[List[Any]] = None
    cancer_type: Optional[str] = None
    cancer_stage: Optional[str] = None
    diagnosis_date: Optional[date] = None
    histopathology_details: Optional[str] = None
    insurance_provider: Optional[str] = None
    insurance_policy_number: Optional[str] = None
    insurance_validity: Optional[date] = None
    profile_photo_url: Optional[str] = None


class PatientResponse(PatientBase):
    """Schema for patient response."""
    id: str
    user_id: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relation: Optional[str] = None
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    bsa: float
    age: int
    allergies: List[str] = []
    comorbidities: List[str] = []
    current_medications: List[Any] = []
    cancer_type: Optional[str] = None
    cancer_stage: Optional[str] = None
    diagnosis_date: Optional[date] = None
    histopathology_details: Optional[str] = None
    insurance_provider: Optional[str] = None
    insurance_policy_number: Optional[str] = None
    insurance_validity: Optional[date] = None
    profile_photo_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class PatientSummary(BaseModel):
    """Simplified patient summary for lists."""
    id: str
    first_name: str
    last_name: str
    cancer_type: Optional[str] = None
    cancer_stage: Optional[str] = None
    profile_photo_url: Optional[str] = None
    
    class Config:
        from_attributes = True
