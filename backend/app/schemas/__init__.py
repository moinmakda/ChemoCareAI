"""
Schemas module initialization.
"""
from app.schemas.auth import (
    UserBase,
    UserCreate,
    UserLogin,
    UserResponse,
    TokenResponse,
    TokenRefresh,
    PasswordReset,
    PasswordResetConfirm,
    PasswordChange,
)
from app.schemas.patient import (
    PatientBase,
    PatientCreate,
    PatientUpdate,
    PatientResponse,
    PatientSummary,
)
from app.schemas.treatment import (
    DrugSchema,
    MedicationSchema,
    DoseModificationRule,
    ProtocolTemplateCreate,
    ProtocolTemplateResponse,
    TreatmentPlanCreate,
    TreatmentPlanUpdate,
    TreatmentPlanResponse,
    TreatmentCycleCreate,
    TreatmentCycleUpdate,
    TreatmentCycleResponse,
    DrugAdministrationUpdate,
    DrugAdministrationResponse,
)
from app.schemas.clinical import (
    DocumentCreate,
    DocumentResponse,
    VitalCreate,
    VitalResponse,
    AppointmentCreate,
    AppointmentUpdate,
    AppointmentResponse,
    NotificationCreate,
    NotificationResponse,
    SymptomEntryCreate,
    SymptomEntryResponse,
)

__all__ = [
    # Auth
    "UserBase",
    "UserCreate",
    "UserLogin",
    "UserResponse",
    "TokenResponse",
    "TokenRefresh",
    "PasswordReset",
    "PasswordResetConfirm",
    "PasswordChange",
    # Patient
    "PatientBase",
    "PatientCreate",
    "PatientUpdate",
    "PatientResponse",
    "PatientSummary",
    # Treatment
    "DrugSchema",
    "MedicationSchema",
    "DoseModificationRule",
    "ProtocolTemplateCreate",
    "ProtocolTemplateResponse",
    "TreatmentPlanCreate",
    "TreatmentPlanUpdate",
    "TreatmentPlanResponse",
    "TreatmentCycleCreate",
    "TreatmentCycleUpdate",
    "TreatmentCycleResponse",
    "DrugAdministrationUpdate",
    "DrugAdministrationResponse",
    # Clinical
    "DocumentCreate",
    "DocumentResponse",
    "VitalCreate",
    "VitalResponse",
    "AppointmentCreate",
    "AppointmentUpdate",
    "AppointmentResponse",
    "NotificationCreate",
    "NotificationResponse",
    "SymptomEntryCreate",
    "SymptomEntryResponse",
]
