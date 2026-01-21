"""
Models module initialization.
"""
from app.models.user import User, UserRole
from app.models.patient import Patient, Gender, BloodGroup
from app.models.staff import Doctor, Nurse
from app.models.treatment import (
    ProtocolTemplate,
    TreatmentPlan,
    TreatmentCycle,
    DrugAdministration,
    PlanStatus,
    CycleStatus,
    AdminStatus,
)
from app.models.clinical import (
    Document,
    Vital,
    Appointment,
    Notification,
    SymptomEntry,
    DocumentType,
    AppointmentType,
    AppointmentStatus,
    NotificationType,
)

__all__ = [
    # User
    "User",
    "UserRole",
    # Patient
    "Patient",
    "Gender",
    "BloodGroup",
    # Staff
    "Doctor",
    "Nurse",
    # Treatment
    "ProtocolTemplate",
    "TreatmentPlan",
    "TreatmentCycle",
    "DrugAdministration",
    "PlanStatus",
    "CycleStatus",
    "AdminStatus",
    # Clinical
    "Document",
    "Vital",
    "Appointment",
    "Notification",
    "SymptomEntry",
    "DocumentType",
    "AppointmentType",
    "AppointmentStatus",
    "NotificationType",
]
