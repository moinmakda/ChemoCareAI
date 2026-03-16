"""
Polyfactory Factories for Test Data Generation

These factories generate realistic test data for all models.
Uses SQLAlchemyFactory for SQLAlchemy ORM models.
"""
from datetime import date, datetime, time
from decimal import Decimal
from typing import Any, Dict, List
from uuid import UUID, uuid4

from polyfactory.factories.sqlalchemy_factory import SQLAlchemyFactory
from polyfactory import Use

from app.models.user import User, UserRole
from app.models.patient import Patient
from app.models.staff import Doctor, Nurse
from app.models.clinical import Appointment, Vital, AppointmentType, AppointmentStatus
from app.models.treatment import (
    ProtocolTemplate,
    TreatmentPlan,
    TreatmentCycle,
    DrugAdministration,
    PlanStatus,
    CycleStatus,
    AdminStatus,
)


# ==================== User Factories ====================

class UserFactory(SQLAlchemyFactory):
    """Factory for User model."""
    __model__ = User
    __set_relationships__ = True
    
    id = Use(uuid4)
    email = Use(lambda: f"user_{uuid4().hex[:8]}@test.com")
    password_hash = "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyNiLXCJzFgIWC"  # 'password123'
    full_name = Use(lambda: f"Test User {uuid4().hex[:4]}")
    role = UserRole.PATIENT
    is_active = True
    is_verified = True
    avatar = None


class PatientUserFactory(UserFactory):
    """Factory for patient users."""
    role = UserRole.PATIENT


class DoctorUserFactory(UserFactory):
    """Factory for doctor users."""
    role = UserRole.DOCTOR_DAYCARE
    full_name = Use(lambda: f"Dr. Test {uuid4().hex[:4]}")


class NurseUserFactory(UserFactory):
    """Factory for nurse users."""
    role = UserRole.NURSE
    full_name = Use(lambda: f"Nurse {uuid4().hex[:4]}")


# ==================== Patient Factories ====================

class PatientFactory(SQLAlchemyFactory):
    """Factory for Patient model."""
    __model__ = Patient
    __set_relationships__ = False
    
    id = Use(uuid4)
    user_id = Use(uuid4)
    first_name = Use(lambda: f"Patient{uuid4().hex[:4]}")
    last_name = Use(lambda: f"Test{uuid4().hex[:4]}")
    date_of_birth = date(1980, 5, 15)
    gender = "male"
    blood_group = "O+"
    phone = "+1234567890"
    address = "123 Test Street"
    city = "Test City"
    state = "Test State"
    pincode = "12345"
    
    # Emergency contact
    emergency_contact_name = "Emergency Contact"
    emergency_contact_phone = "+0987654321"
    emergency_contact_relation = "Spouse"
    
    # Physical measurements - use floats for JSON compatibility
    height_cm = 175.00
    weight_kg = 75.50
    bsa = 1.92
    
    # Medical info - explicit JSONB values
    allergies = ["Penicillin"]
    comorbidities = ["Hypertension"]
    current_medications = []
    
    # Cancer details
    cancer_type = "Lung Cancer"
    cancer_stage = "Stage IIIA"
    diagnosis_date = date(2025, 6, 1)
    histopathology_details = "Non-small cell lung carcinoma"
    
    # Nullable fields
    insurance_provider = None
    insurance_policy_number = None
    insurance_validity = None
    profile_photo_url = None


# ==================== Staff Factories ====================

class DoctorFactory(SQLAlchemyFactory):
    """Factory for Doctor model."""
    __model__ = Doctor
    
    id = Use(uuid4)
    user_id = Use(uuid4)
    first_name = "Test"
    last_name = "Doctor"
    specialization = "Medical Oncology"
    qualification = "MD, DM Oncology"
    registration_number = Use(lambda: f"REG{uuid4().hex[:8]}")
    experience_years = 10
    department = "Oncology"


class NurseFactory(SQLAlchemyFactory):
    """Factory for Nurse model."""
    __model__ = Nurse
    
    id = Use(uuid4)
    user_id = Use(uuid4)
    first_name = "Test"
    last_name = "Nurse"
    qualification = "BSc Nursing"
    registration_number = Use(lambda: f"NUR{uuid4().hex[:8]}")
    experience_years = 5
    department = "Day Care"
    shift = "day"


# ==================== Appointment Factories ====================

class AppointmentFactory(SQLAlchemyFactory):
    """Factory for Appointment model."""
    __model__ = Appointment
    __set_relationships__ = False
    
    id = Use(uuid4)
    patient_id = Use(uuid4)
    appointment_type = AppointmentType.DAYCARE_CHEMO
    scheduled_date = Use(lambda: date.today())
    scheduled_time = time(9, 0)
    duration_mins = 180
    status = AppointmentStatus.SCHEDULED
    notes = "Test appointment"
    # Explicitly set nullable fields
    cycle_id = None
    chair_number = None
    doctor_id = None
    nurse_id = None
    checked_in_at = None
    checked_out_at = None
    cancellation_reason = None


class OPDAppointmentFactory(AppointmentFactory):
    """Factory for OPD appointments."""
    appointment_type = AppointmentType.OPD_CONSULTATION
    duration_mins = 30


class ChemoAppointmentFactory(AppointmentFactory):
    """Factory for chemotherapy appointments."""
    appointment_type = AppointmentType.DAYCARE_CHEMO
    duration_mins = 180


# ==================== Vitals Factories ====================

class VitalFactory(SQLAlchemyFactory):
    """Factory for Vital model."""
    __model__ = Vital
    __set_relationships__ = False
    
    id = Use(uuid4)
    patient_id = Use(uuid4)
    blood_pressure_systolic = 120
    blood_pressure_diastolic = 80
    heart_rate = 72
    temperature = 36.80
    oxygen_saturation = 98
    respiratory_rate = 16
    weight_kg = 75.50
    recorded_at = Use(datetime.utcnow)
    timing = "pre_chemo"
    notes = None
    # Explicitly set JSONB fields to avoid auto-generated datetime values
    ai_alerts = []
    # Explicitly set nullable fields
    cycle_id = None
    recorded_by = None
    temperature_f = None
    pulse_bpm = None
    pain_score = None
    pain_location = None
    blood_sugar = None


class AbnormalVitalFactory(VitalFactory):
    """Factory for abnormal vital signs."""
    blood_pressure_systolic = 160
    blood_pressure_diastolic = 100
    heart_rate = 110
    temperature = 38.50
    oxygen_saturation = 92


# ==================== Protocol Factories ====================

class ProtocolTemplateFactory(SQLAlchemyFactory):
    """Factory for ProtocolTemplate model."""
    __model__ = ProtocolTemplate
    __set_relationships__ = False
    
    id = Use(uuid4)
    name = "CHOP"
    full_name = "Cyclophosphamide, Doxorubicin, Vincristine, Prednisone"
    cancer_types = ["Non-Hodgkin Lymphoma"]
    cycle_days = 21
    total_cycles = 6
    # Explicit JSONB fields
    drugs = [
        {
            "name": "Cyclophosphamide",
            "dose": 750,
            "unit": "mg/m²",
            "route": "IV",
            "day": 1,
            "duration_mins": 30,
        },
        {
            "name": "Doxorubicin",
            "dose": 50,
            "unit": "mg/m²",
            "route": "IV Push",
            "day": 1,
            "duration_mins": 5,
        },
        {
            "name": "Vincristine",
            "dose": 1.4,
            "unit": "mg/m²",
            "route": "IV Push",
            "day": 1,
            "duration_mins": 5,
            "max_dose": 2,
        },
        {
            "name": "Prednisone",
            "dose": 100,
            "unit": "mg",
            "route": "PO",
            "days": "1-5",
        },
    ]
    pre_medications = [
        {"name": "Ondansetron", "dose": 8, "unit": "mg", "route": "IV"},
    ]
    post_medications = []
    required_labs = []
    monitoring_parameters = []
    dose_modification_rules = []
    # ARRAY fields
    common_side_effects = None
    serious_side_effects = None
    # Other fields
    reference_guidelines = None
    is_active = True


# ==================== Treatment Plan Factories ====================

class TreatmentPlanFactory(SQLAlchemyFactory):
    """Factory for TreatmentPlan model."""
    __model__ = TreatmentPlan
    __set_relationships__ = False
    
    id = Use(uuid4)
    patient_id = Use(uuid4)
    protocol_template_id = None
    protocol_name = "CHOP"
    # Explicit JSONB field
    custom_protocol = [
        {"name": "Cyclophosphamide", "dose": 750, "unit": "mg/m²"},
        {"name": "Doxorubicin", "dose": 50, "unit": "mg/m²"},
    ]
    start_date = Use(lambda: date.today())
    planned_cycles = 6
    completed_cycles = 0
    status = PlanStatus.APPROVED
    # Explicitly set JSONB fields to avoid random datetime generation
    ai_recommendations = None
    ai_risk_assessment = None
    ai_confidence_score = 0.85
    # Nullable fields
    created_by_doctor_id = None
    opd_approved_by = None
    opd_approved_at = None
    opd_notes = None
    daycare_approved_by = None
    daycare_approved_at = None
    daycare_notes = None


class DraftTreatmentPlanFactory(TreatmentPlanFactory):
    """Factory for draft treatment plans."""
    status = PlanStatus.DRAFT


class ActiveTreatmentPlanFactory(TreatmentPlanFactory):
    """Factory for active treatment plans."""
    status = PlanStatus.ACTIVE
    completed_cycles = 2


# ==================== Treatment Cycle Factories ====================

class TreatmentCycleFactory(SQLAlchemyFactory):
    """Factory for TreatmentCycle model."""
    __model__ = TreatmentCycle
    __set_relationships__ = False
    
    id = Use(uuid4)
    treatment_plan_id = Use(uuid4)
    cycle_number = 1
    scheduled_date = Use(lambda: date.today())
    actual_date = None
    status = CycleStatus.SCHEDULED
    # Use floats for Numeric fields to avoid JSON serialization issues
    patient_weight_kg = 75.50
    calculated_bsa = 1.92
    # Explicitly set JSONB fields to None to avoid auto-generated datetime values
    pre_chemo_labs = None
    pre_chemo_vitals = None
    dose_modifications = None
    immediate_reactions = None
    # Explicitly set nullable fields
    daycare_doctor_id = None
    approved_at = None
    approval_notes = None
    started_at = None
    completed_at = None
    administered_by = None
    discharge_notes = None
    follow_up_instructions = None
    modification_reason = None


class InProgressCycleFactory(TreatmentCycleFactory):
    """Factory for in-progress cycles."""
    status = CycleStatus.IN_PROGRESS
    actual_date = Use(lambda: date.today())
    started_at = Use(datetime.utcnow)


class CompletedCycleFactory(TreatmentCycleFactory):
    """Factory for completed cycles."""
    status = CycleStatus.COMPLETED
    actual_date = Use(lambda: date.today())
    started_at = Use(datetime.utcnow)
    completed_at = Use(datetime.utcnow)


# ==================== Drug Administration Factories ====================

class DrugAdministrationFactory(SQLAlchemyFactory):
    """Factory for DrugAdministration model."""
    __model__ = DrugAdministration
    __set_relationships__ = False
    
    id = Use(uuid4)
    cycle_id = Use(uuid4)
    drug_name = "Cyclophosphamide"
    planned_dose = 1440.00  # 750 mg/m² × 1.92 BSA
    actual_dose = None
    unit = "mg"
    route = "IV"
    planned_duration_mins = 30
    actual_duration_mins = None
    status = AdminStatus.PENDING
    scheduled_time = time(9, 0)
    # Explicitly set JSONB fields to avoid auto-generated datetime values
    reactions = []
    notes = None
    # Explicitly set nullable fields
    prepared_by = None
    prepared_at = None
    batch_number = None
    expiry_date = None
    verified_by = None
    verified_at = None
    started_at = None
    completed_at = None
    administered_by = None
    iv_site = None
    flow_rate = None


class StartedDrugAdminFactory(DrugAdministrationFactory):
    """Factory for started drug administrations."""
    status = AdminStatus.STARTED
    started_at = Use(datetime.utcnow)


class CompletedDrugAdminFactory(DrugAdministrationFactory):
    """Factory for completed drug administrations."""
    status = AdminStatus.COMPLETED
    started_at = Use(datetime.utcnow)
    completed_at = Use(datetime.utcnow)
    actual_dose = 1440.00


# ==================== Batch Creation Helpers ====================

def create_patient_with_treatment(
    patient_factory: PatientFactory = None,
    plan_factory: TreatmentPlanFactory = None,
) -> Dict[str, Any]:
    """Create a patient with associated treatment plan and cycles."""
    patient = (patient_factory or PatientFactory).build()
    plan = (plan_factory or TreatmentPlanFactory).build(patient_id=patient.id)
    
    cycles = [
        TreatmentCycleFactory.build(
            treatment_plan_id=plan.id,
            cycle_number=i + 1,
            scheduled_date=date.today().replace(day=date.today().day + (i * 21)),
        )
        for i in range(plan.planned_cycles)
    ]
    
    return {
        "patient": patient,
        "treatment_plan": plan,
        "cycles": cycles,
    }


def create_active_session() -> Dict[str, Any]:
    """Create a complete active chemo session."""
    patient = PatientFactory.build()
    plan = ActiveTreatmentPlanFactory.build(patient_id=patient.id)
    cycle = InProgressCycleFactory.build(treatment_plan_id=plan.id)
    
    drugs = [
        DrugAdministrationFactory.build(cycle_id=cycle.id, drug_name="Cyclophosphamide"),
        DrugAdministrationFactory.build(cycle_id=cycle.id, drug_name="Doxorubicin"),
        DrugAdministrationFactory.build(cycle_id=cycle.id, drug_name="Vincristine"),
    ]
    
    appointment = ChemoAppointmentFactory.build(
        patient_id=patient.id,
        cycle_id=cycle.id,
        status=AppointmentStatus.IN_PROGRESS,
    )
    
    return {
        "patient": patient,
        "treatment_plan": plan,
        "cycle": cycle,
        "drugs": drugs,
        "appointment": appointment,
    }
