#!/usr/bin/env python3
"""
Seed script to create consistent test data for ChemoCare development.

Features:
- Atomic transactions (all or nothing)
- Proper cleanup before seeding
- Consistent foreign key relationships
- Idempotent (safe to run multiple times)
- Realistic medical data

Usage:
    python scripts/seed_test_data.py [--clean-only] [--no-clean]
"""
import asyncio
import argparse
import sys
import os
from datetime import date, datetime, time, timedelta
from uuid import uuid4

# Add parent to path to import from app
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text, delete

from app.models import (
    User, Patient, Doctor, Nurse,
    Vital, Appointment, TreatmentPlan, TreatmentCycle, ProtocolTemplate,
    DrugAdministration, Notification, SymptomEntry, Document,
    UserRole, Gender, BloodGroup, AppointmentType, AppointmentStatus, 
    PlanStatus, CycleStatus, AdminStatus
)
from app.core.security import get_password_hash

# Get database URL
DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql+asyncpg://moinmakda:@localhost/chemocare")

engine = create_async_engine(DATABASE_URL, echo=False)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


# ==================== Test Data Constants ====================

TEST_PASSWORD_HASH = get_password_hash("password123")

# Fixed UUIDs for consistent relationships
PATIENT_USER_ID = uuid4()
PATIENT_2_USER_ID = uuid4()
PATIENT_3_USER_ID = uuid4()
DAYCARE_DOCTOR_USER_ID = uuid4()
OPD_DOCTOR_USER_ID = uuid4()
NURSE_USER_ID = uuid4()
NURSE_2_USER_ID = uuid4()

PATIENT_ID = uuid4()
PATIENT_2_ID = uuid4()
PATIENT_3_ID = uuid4()
DOCTOR_ID = uuid4()
OPD_DOCTOR_ID = uuid4()
NURSE_ID = uuid4()
NURSE_2_ID = uuid4()

PROTOCOL_FOLFOX_ID = uuid4()
PROTOCOL_ACT_ID = uuid4()
PROTOCOL_CHOP_ID = uuid4()
PROTOCOL_RCHOP_ID = uuid4()
PROTOCOL_GEMCIS_ID = uuid4()
PROTOCOL_CARBOPAC_ID = uuid4()

TREATMENT_PLAN_1_ID = uuid4()
TREATMENT_PLAN_2_ID = uuid4()

# Cycle IDs for Patient 1 (FOLFOX) - cycles 1-12
FOLFOX_CYCLE_IDS = [uuid4() for _ in range(12)]
# Cycle IDs for Patient 2 (AC-T) - cycles 1-4
ACT_CYCLE_IDS = [uuid4() for _ in range(4)]


async def cleanup_database(session: AsyncSession):
    """
    Clean all seeded data by disabling FK constraints temporarily.
    This ensures a clean slate regardless of existing data.
    """
    print("🧹 Cleaning existing data...")
    
    try:
        # Disable triggers (FK checks) for this session
        await session.execute(text("SET session_replication_role = 'replica'"))
        
        # Order matters: most dependent tables first, then their parents
        tables_to_truncate = [
            # Treatment-related (most dependent)
            "drug_administrations",
            "treatment_cycles",
            "treatment_plans",
            # Clinical data
            "symptom_entries",
            "vitals",
            "documents",
            "notifications",
            "appointments",
            # Protocol-related
            "protocol_templates",
            # Role-specific tables (reference users)
            "patients",
            "doctors",
            "nurses",
            # Core table (parent)
            "users",
        ]
        
        for table in tables_to_truncate:
            try:
                await session.execute(text(f"TRUNCATE TABLE {table} RESTART IDENTITY CASCADE"))
                print(f"   ✓ Truncated {table}")
            except Exception as e:
                error_str = str(e).lower()
                if "does not exist" in error_str or "relation" in error_str:
                    print(f"   ⚠ Table {table} does not exist (skipping)")
                else:
                    # Try DELETE as fallback
                    try:
                        await session.execute(text(f"DELETE FROM {table}"))
                        print(f"   ✓ Deleted from {table} (fallback)")
                    except Exception:
                        print(f"   ⚠ Skipped {table}")
        
        await session.commit()
        
    finally:
        # Re-enable triggers (important!)
        await session.execute(text("SET session_replication_role = 'origin'"))
        await session.commit()
    
    print("✓ Database cleaned\n")


async def create_users(session: AsyncSession) -> dict:
    """Create all test users with fixed IDs."""
    print("👤 Creating users...")
    
    users = [
        User(
            id=PATIENT_USER_ID,
            email="patient@test.com",
            password_hash=TEST_PASSWORD_HASH,
            full_name="Rajesh Kumar",
            role=UserRole.PATIENT,
            is_active=True,
            is_verified=True,
        ),
        User(
            id=PATIENT_2_USER_ID,
            email="patient2@test.com",
            password_hash=TEST_PASSWORD_HASH,
            full_name="Priya Sharma",
            role=UserRole.PATIENT,
            is_active=True,
            is_verified=True,
        ),
        User(
            id=PATIENT_3_USER_ID,
            email="patient3@test.com",
            password_hash=TEST_PASSWORD_HASH,
            full_name="Amit Patel",
            role=UserRole.PATIENT,
            is_active=True,
            is_verified=True,
        ),
        User(
            id=DAYCARE_DOCTOR_USER_ID,
            email="doctor@test.com",
            password_hash=TEST_PASSWORD_HASH,
            full_name="Dr. Arun Mehta",
            role=UserRole.DOCTOR_DAYCARE,
            is_active=True,
            is_verified=True,
        ),
        User(
            id=OPD_DOCTOR_USER_ID,
            email="opd.doctor@test.com",
            password_hash=TEST_PASSWORD_HASH,
            full_name="Dr. Sunita Reddy",
            role=UserRole.DOCTOR_OPD,
            is_active=True,
            is_verified=True,
        ),
        User(
            id=NURSE_USER_ID,
            email="nurse@test.com",
            password_hash=TEST_PASSWORD_HASH,
            full_name="Sister Mary Thomas",
            role=UserRole.NURSE,
            is_active=True,
            is_verified=True,
        ),
        User(
            id=NURSE_2_USER_ID,
            email="nurse2@test.com",
            password_hash=TEST_PASSWORD_HASH,
            full_name="Sister Lakshmi Nair",
            role=UserRole.NURSE,
            is_active=True,
            is_verified=True,
        ),
    ]
    
    for user in users:
        session.add(user)
    
    await session.flush()
    print(f"   ✓ Created {len(users)} users")
    
    return {u.email: u for u in users}


async def create_patients(session: AsyncSession) -> dict:
    """Create patient profiles linked to users."""
    print("🏥 Creating patient profiles...")
    
    patients = [
        Patient(
            id=PATIENT_ID,
            user_id=PATIENT_USER_ID,
            first_name="Rajesh",
            last_name="Kumar",
            date_of_birth=date(1965, 3, 15),
            gender=Gender.MALE,
            blood_group=BloodGroup.B_POS,
            address="45 MG Road, Bandra West",
            city="Mumbai",
            state="Maharashtra",
            pincode="400050",
            emergency_contact_name="Sunita Kumar",
            emergency_contact_phone="+91 9876543211",
            emergency_contact_relation="Wife",
            height_cm=172.0,
            weight_kg=78.5,
            allergies=["Sulfa drugs"],
            comorbidities=["Type 2 Diabetes", "Hypertension"],
            current_medications=[
                {"name": "Metformin", "dose": "500mg", "frequency": "twice daily"},
                {"name": "Amlodipine", "dose": "5mg", "frequency": "once daily"},
            ],
            cancer_type="Colorectal Cancer",
            cancer_stage="Stage III",
            diagnosis_date=date(2025, 10, 15),
            histopathology_details="Moderately differentiated adenocarcinoma, T3N1M0",
            insurance_provider="Star Health Insurance",
            insurance_policy_number="STH-2024-876543",
            insurance_validity=date(2027, 3, 31),
        ),
        Patient(
            id=PATIENT_2_ID,
            user_id=PATIENT_2_USER_ID,
            first_name="Priya",
            last_name="Sharma",
            date_of_birth=date(1978, 8, 22),
            gender=Gender.FEMALE,
            blood_group=BloodGroup.A_POS,
            address="12 Palm Beach Road",
            city="Mumbai",
            state="Maharashtra",
            pincode="400614",
            emergency_contact_name="Vikram Sharma",
            emergency_contact_phone="+91 9123456780",
            emergency_contact_relation="Husband",
            height_cm=162.0,
            weight_kg=58.0,
            allergies=["Penicillin"],
            comorbidities=[],
            current_medications=[],
            cancer_type="Breast Cancer",
            cancer_stage="Stage II",
            diagnosis_date=date(2025, 11, 1),
            histopathology_details="Invasive ductal carcinoma, ER+/PR+/HER2-, Grade 2",
            insurance_provider="HDFC Ergo",
            insurance_policy_number="HDF-2025-123456",
            insurance_validity=date(2026, 10, 31),
        ),
        Patient(
            id=PATIENT_3_ID,
            user_id=PATIENT_3_USER_ID,
            first_name="Amit",
            last_name="Patel",
            date_of_birth=date(1955, 12, 5),
            gender=Gender.MALE,
            blood_group=BloodGroup.O_POS,
            address="78 Juhu Scheme",
            city="Mumbai",
            state="Maharashtra",
            pincode="400049",
            emergency_contact_name="Neeta Patel",
            emergency_contact_phone="+91 9988776656",
            emergency_contact_relation="Daughter",
            height_cm=168.0,
            weight_kg=72.0,
            allergies=[],
            comorbidities=["COPD", "Hyperlipidemia"],
            current_medications=[
                {"name": "Atorvastatin", "dose": "20mg", "frequency": "once daily"},
            ],
            cancer_type="Non-Hodgkin Lymphoma",
            cancer_stage="Stage II",
            diagnosis_date=date(2025, 9, 20),
            histopathology_details="Diffuse large B-cell lymphoma (DLBCL), GCB subtype",
            insurance_provider=None,
            insurance_policy_number=None,
            insurance_validity=None,
        ),
    ]
    
    for patient in patients:
        session.add(patient)
    
    await session.flush()
    print(f"   ✓ Created {len(patients)} patient profiles")
    
    return {p.id: p for p in patients}


async def create_doctors(session: AsyncSession) -> dict:
    """Create doctor profiles."""
    print("👨‍⚕️ Creating doctor profiles...")
    
    doctors = [
        Doctor(
            id=DOCTOR_ID,
            user_id=DAYCARE_DOCTOR_USER_ID,
            first_name="Arun",
            last_name="Mehta",
            specialization="Medical Oncology",
            qualification="MD, DM (Medical Oncology), AIIMS Delhi",
            registration_number="MCI-DEL-45678",
            experience_years=18,
            is_opd_doctor=False,
            is_daycare_doctor=True,
        ),
        Doctor(
            id=OPD_DOCTOR_ID,
            user_id=OPD_DOCTOR_USER_ID,
            first_name="Sunita",
            last_name="Reddy",
            specialization="Surgical Oncology",
            qualification="MS, MCh (Surgical Oncology), TMH Mumbai",
            registration_number="MCI-MH-12345",
            experience_years=22,
            is_opd_doctor=True,
            is_daycare_doctor=False,
        ),
    ]
    
    for doctor in doctors:
        session.add(doctor)
    
    await session.flush()
    print(f"   ✓ Created {len(doctors)} doctor profiles")
    
    return {d.id: d for d in doctors}


async def create_nurses(session: AsyncSession) -> dict:
    """Create nurse profiles."""
    print("👩‍⚕️ Creating nurse profiles...")
    
    nurses = [
        Nurse(
            id=NURSE_ID,
            user_id=NURSE_USER_ID,
            first_name="Mary",
            last_name="Thomas",
            qualification="M.Sc Nursing (Oncology)",
            registration_number="RN-MH-2018-4567",
            experience_years=12,
            chemo_certified=True,
            certification_date=date(2015, 6, 15),
        ),
        Nurse(
            id=NURSE_2_ID,
            user_id=NURSE_2_USER_ID,
            first_name="Lakshmi",
            last_name="Nair",
            qualification="B.Sc Nursing",
            registration_number="RN-MH-2020-8901",
            experience_years=6,
            chemo_certified=True,
            certification_date=date(2021, 3, 10),
        ),
    ]
    
    for nurse in nurses:
        session.add(nurse)
    
    await session.flush()
    print(f"   ✓ Created {len(nurses)} nurse profiles")
    
    return {n.id: n for n in nurses}


async def create_protocol_templates(session: AsyncSession) -> list:
    """Create standard chemotherapy protocol templates."""
    print("📋 Creating protocol templates...")
    
    templates = [
        ProtocolTemplate(
            id=PROTOCOL_FOLFOX_ID,
            name="FOLFOX",
            full_name="5-Fluorouracil, Leucovorin, Oxaliplatin",
            cancer_types=["Colorectal Cancer", "Colon Cancer", "Rectal Cancer"],
            drugs=[
                {"name": "Oxaliplatin", "dose_per_m2": 85, "unit": "mg", "infusion_time_mins": 120, "day": 1},
                {"name": "Leucovorin", "dose_per_m2": 400, "unit": "mg", "infusion_time_mins": 120, "day": 1},
                {"name": "5-Fluorouracil (Bolus)", "dose_per_m2": 400, "unit": "mg", "infusion_time_mins": 5, "day": 1},
                {"name": "5-Fluorouracil (Infusion)", "dose_per_m2": 2400, "unit": "mg", "infusion_time_mins": 2880, "day": 1},
            ],
            pre_medications=[
                {"name": "Ondansetron", "dose": "8mg", "route": "IV"},
                {"name": "Dexamethasone", "dose": "8mg", "route": "IV"},
            ],
            post_medications=[],
            cycle_days=14,
            total_cycles=12,
            required_labs=["CBC", "CMP", "Liver Function Tests", "CEA"],
            monitoring_parameters=["Peripheral neuropathy", "Cold sensitivity", "Mucositis"],
            common_side_effects=["Nausea", "Fatigue", "Diarrhea", "Neuropathy"],
            serious_side_effects=["Severe peripheral neuropathy", "Neutropenia"],
            reference_guidelines="NCCN Colon Cancer Guidelines v2.2025",
            is_active=True,
        ),
        ProtocolTemplate(
            id=PROTOCOL_ACT_ID,
            name="AC-T",
            full_name="Doxorubicin, Cyclophosphamide, followed by Paclitaxel",
            cancer_types=["Breast Cancer"],
            drugs=[
                {"name": "Doxorubicin", "dose_per_m2": 60, "unit": "mg", "infusion_time_mins": 30, "day": 1},
                {"name": "Cyclophosphamide", "dose_per_m2": 600, "unit": "mg", "infusion_time_mins": 60, "day": 1},
            ],
            pre_medications=[
                {"name": "Ondansetron", "dose": "8mg", "route": "IV"},
                {"name": "Dexamethasone", "dose": "12mg", "route": "IV"},
            ],
            post_medications=[
                {"name": "Pegfilgrastim", "dose": "6mg", "route": "SC", "timing": "24h post"},
            ],
            cycle_days=21,
            total_cycles=4,
            required_labs=["CBC", "CMP", "ECHO/MUGA"],
            monitoring_parameters=["Cardiac function (LVEF)", "Bone marrow suppression"],
            common_side_effects=["Hair loss", "Nausea", "Fatigue"],
            serious_side_effects=["Cardiomyopathy", "Febrile neutropenia"],
            reference_guidelines="NCCN Breast Cancer Guidelines v1.2025",
            is_active=True,
        ),
        ProtocolTemplate(
            id=PROTOCOL_CHOP_ID,
            name="CHOP",
            full_name="Cyclophosphamide, Doxorubicin, Vincristine, Prednisone",
            cancer_types=["Non-Hodgkin Lymphoma"],
            drugs=[
                {"name": "Cyclophosphamide", "dose_per_m2": 750, "unit": "mg", "infusion_time_mins": 60, "day": 1},
                {"name": "Doxorubicin", "dose_per_m2": 50, "unit": "mg", "infusion_time_mins": 30, "day": 1},
                {"name": "Vincristine", "dose_per_m2": 1.4, "unit": "mg", "infusion_time_mins": 15, "day": 1, "max_dose": 2},
                {"name": "Prednisone", "dose_per_m2": 100, "unit": "mg", "route": "PO", "days": "1-5"},
            ],
            pre_medications=[
                {"name": "Ondansetron", "dose": "8mg", "route": "IV"},
            ],
            post_medications=[],
            cycle_days=21,
            total_cycles=6,
            required_labs=["CBC", "CMP", "LDH"],
            monitoring_parameters=["Cardiac function", "Neuropathy"],
            common_side_effects=["Hair loss", "Nausea", "Constipation"],
            serious_side_effects=["Cardiomyopathy", "Febrile neutropenia"],
            reference_guidelines="NCCN B-cell Lymphoma Guidelines v3.2025",
            is_active=True,
        ),
        ProtocolTemplate(
            id=PROTOCOL_RCHOP_ID,
            name="R-CHOP",
            full_name="Rituximab, Cyclophosphamide, Doxorubicin, Vincristine, Prednisone",
            cancer_types=["B-cell Lymphoma", "DLBCL"],
            drugs=[
                {"name": "Rituximab", "dose_per_m2": 375, "unit": "mg", "infusion_time_mins": 240, "day": 1},
                {"name": "Cyclophosphamide", "dose_per_m2": 750, "unit": "mg", "infusion_time_mins": 60, "day": 1},
                {"name": "Doxorubicin", "dose_per_m2": 50, "unit": "mg", "infusion_time_mins": 30, "day": 1},
                {"name": "Vincristine", "dose_per_m2": 1.4, "unit": "mg", "infusion_time_mins": 15, "day": 1, "max_dose": 2},
                {"name": "Prednisone", "dose_per_m2": 100, "unit": "mg", "route": "PO", "days": "1-5"},
            ],
            pre_medications=[
                {"name": "Acetaminophen", "dose": "650mg", "route": "PO"},
                {"name": "Diphenhydramine", "dose": "50mg", "route": "IV"},
                {"name": "Ondansetron", "dose": "8mg", "route": "IV"},
            ],
            post_medications=[],
            cycle_days=21,
            total_cycles=6,
            required_labs=["CBC", "CMP", "LDH", "Hepatitis B serology"],
            monitoring_parameters=["Infusion reactions", "Cardiac function"],
            common_side_effects=["Hair loss", "Fatigue", "Infusion reactions"],
            serious_side_effects=["Severe infusion reactions", "Hepatitis B reactivation"],
            reference_guidelines="NCCN B-cell Lymphoma Guidelines v3.2025",
            is_active=True,
        ),
        ProtocolTemplate(
            id=PROTOCOL_GEMCIS_ID,
            name="Gemcitabine/Cisplatin",
            full_name="Gemcitabine and Cisplatin",
            cancer_types=["Bladder Cancer", "NSCLC"],
            drugs=[
                {"name": "Gemcitabine", "dose_per_m2": 1000, "unit": "mg", "infusion_time_mins": 30, "days": [1, 8]},
                {"name": "Cisplatin", "dose_per_m2": 70, "unit": "mg", "infusion_time_mins": 60, "day": 1},
            ],
            pre_medications=[
                {"name": "Ondansetron", "dose": "16mg", "route": "IV"},
                {"name": "Dexamethasone", "dose": "12mg", "route": "IV"},
            ],
            post_medications=[
                {"name": "IV Hydration", "dose": "1000mL NS", "route": "IV"},
            ],
            cycle_days=21,
            total_cycles=4,
            required_labs=["CBC", "CMP", "Creatinine Clearance", "Magnesium"],
            monitoring_parameters=["Renal function", "Hearing", "Hydration"],
            common_side_effects=["Nausea", "Fatigue", "Myelosuppression"],
            serious_side_effects=["Nephrotoxicity", "Ototoxicity"],
            reference_guidelines="NCCN Bladder Cancer Guidelines v2.2025",
            is_active=True,
        ),
        ProtocolTemplate(
            id=PROTOCOL_CARBOPAC_ID,
            name="Carboplatin/Paclitaxel",
            full_name="Carboplatin and Paclitaxel",
            cancer_types=["Ovarian Cancer", "NSCLC", "Endometrial Cancer"],
            drugs=[
                {"name": "Paclitaxel", "dose_per_m2": 175, "unit": "mg", "infusion_time_mins": 180, "day": 1},
                {"name": "Carboplatin", "dose": "AUC 5-6", "unit": "mg", "infusion_time_mins": 60, "day": 1},
            ],
            pre_medications=[
                {"name": "Dexamethasone", "dose": "20mg", "route": "PO", "timing": "12h and 6h before"},
                {"name": "Diphenhydramine", "dose": "50mg", "route": "IV"},
                {"name": "Famotidine", "dose": "20mg", "route": "IV"},
            ],
            post_medications=[],
            cycle_days=21,
            total_cycles=6,
            required_labs=["CBC", "CMP"],
            monitoring_parameters=["Hypersensitivity", "Neuropathy"],
            common_side_effects=["Hair loss", "Neuropathy", "Fatigue"],
            serious_side_effects=["Severe hypersensitivity", "Anaphylaxis"],
            reference_guidelines="NCCN Ovarian Cancer Guidelines v1.2025",
            is_active=True,
        ),
    ]
    
    for template in templates:
        session.add(template)
    
    await session.flush()
    print(f"   ✓ Created {len(templates)} protocol templates")
    
    return templates


async def create_treatment_plans(session: AsyncSession) -> list:
    """Create treatment plans for patients."""
    print("📝 Creating treatment plans...")
    
    today = date.today()
    
    plans = [
        # Patient 1: Colorectal cancer on FOLFOX - active treatment
        TreatmentPlan(
            id=TREATMENT_PLAN_1_ID,
            patient_id=PATIENT_ID,
            protocol_template_id=PROTOCOL_FOLFOX_ID,
            protocol_name="FOLFOX",
            custom_protocol={},
            start_date=today - timedelta(days=56),  # Started 8 weeks ago
            planned_cycles=12,
            completed_cycles=4,
            status=PlanStatus.ACTIVE,
            ai_recommendations="Standard FOLFOX regimen for Stage III colorectal cancer. Monitor for neuropathy.",
            ai_risk_assessment={
                "neuropathy_risk": "moderate",
                "neutropenia_risk": "moderate",
                "overall_toxicity": "manageable",
            },
            ai_confidence_score=0.91,
            created_by_doctor_id=OPD_DOCTOR_ID,
            opd_approved_by=str(OPD_DOCTOR_ID),
            opd_approved_at=datetime.now() - timedelta(days=60),
            opd_notes="Patient fit for full-dose FOLFOX. Monitor diabetes control.",
            daycare_approved_by=str(DOCTOR_ID),
            daycare_approved_at=datetime.now() - timedelta(days=58),
            daycare_notes="Cleared for day care chemotherapy. Chair 5 preferred.",
        ),
        # Patient 2: Breast cancer on AC-T - just started
        TreatmentPlan(
            id=TREATMENT_PLAN_2_ID,
            patient_id=PATIENT_2_ID,
            protocol_template_id=PROTOCOL_ACT_ID,
            protocol_name="AC-T",
            custom_protocol={},
            start_date=today - timedelta(days=7),  # Started 1 week ago
            planned_cycles=4,
            completed_cycles=1,
            status=PlanStatus.ACTIVE,
            ai_recommendations="Dose-dense AC followed by weekly paclitaxel. Add G-CSF support.",
            ai_risk_assessment={
                "cardiotoxicity_risk": "low",
                "neutropenia_risk": "high",
                "alopecia_risk": "high",
            },
            ai_confidence_score=0.94,
            created_by_doctor_id=OPD_DOCTOR_ID,
            opd_approved_by=str(OPD_DOCTOR_ID),
            opd_approved_at=datetime.now() - timedelta(days=14),
            opd_notes="Young patient, good performance status. Proceed with dose-dense.",
            daycare_approved_by=str(DOCTOR_ID),
            daycare_approved_at=datetime.now() - timedelta(days=12),
            daycare_notes="Pre-treatment cardiac echo normal (LVEF 62%).",
        ),
    ]
    
    for plan in plans:
        session.add(plan)
    
    await session.flush()
    print(f"   ✓ Created {len(plans)} treatment plans")
    
    return plans


async def create_treatment_cycles(session: AsyncSession) -> list:
    """Create treatment cycles for active plans."""
    print("🔄 Creating treatment cycles...")
    
    today = date.today()
    cycles = []
    
    # Patient 1 (FOLFOX) - Cycles 1-4 completed, 5 scheduled for today, 6-12 future
    folfox_start = today - timedelta(days=56)
    for i in range(12):
        cycle_date = folfox_start + timedelta(days=14 * i)

        if i < 4:  # Completed
            status = CycleStatus.COMPLETED
        elif i == 4:  # Today - active
            status = CycleStatus.IN_PROGRESS
        else:  # Future
            status = CycleStatus.SCHEDULED

        cycle = TreatmentCycle(
            id=FOLFOX_CYCLE_IDS[i],
            treatment_plan_id=TREATMENT_PLAN_1_ID,
            cycle_number=i + 1,
            scheduled_date=cycle_date,
            actual_date=cycle_date if status == CycleStatus.COMPLETED else None,
            status=status,
            pre_chemo_labs={
                "WBC": 5800 - (i * 150) if i < 5 else None,
                "Hemoglobin": 12.8 - (i * 0.2) if i < 5 else None,
                "Platelets": 245000 - (i * 8000) if i < 5 else None,
                "Creatinine": 0.95 if i < 5 else None,
                "ALT": 28 if i < 5 else None,
                "AST": 25 if i < 5 else None,
            } if i < 5 else None,
            pre_chemo_vitals={
                "temperature": 98.4,
                "bp_systolic": 132,
                "bp_diastolic": 84,
                "pulse": 76,
                "spo2": 98,
            } if i < 5 else None,
            patient_weight_kg=78.5 - (i * 0.3),
            calculated_bsa=1.92,
            daycare_doctor_id=DOCTOR_ID,
            approved_at=datetime.combine(cycle_date, time(8, 0)) if status in [CycleStatus.COMPLETED, CycleStatus.APPROVED, CycleStatus.IN_PROGRESS] else None,
            approval_notes="Labs acceptable. Proceed with standard dosing." if status in [CycleStatus.COMPLETED, CycleStatus.APPROVED, CycleStatus.IN_PROGRESS] else None,
            started_at=datetime.combine(cycle_date, time(9, 0)) if status in [CycleStatus.COMPLETED, CycleStatus.IN_PROGRESS] else None,
            completed_at=datetime.combine(cycle_date, time(15, 0)) if status == CycleStatus.COMPLETED else None,
            administered_by=NURSE_ID if status in [CycleStatus.COMPLETED, CycleStatus.IN_PROGRESS] else None,
            discharge_notes="Tolerated well. Mild nausea controlled with ondansetron." if status == CycleStatus.COMPLETED else None,
            follow_up_instructions="Return in 14 days. Monitor for cold sensitivity and neuropathy." if status == CycleStatus.COMPLETED else None,
        )
        cycles.append(cycle)
        session.add(cycle)
    
    # Patient 2 (AC-T) - Cycle 1 completed, Cycle 2 scheduled
    act_start = today - timedelta(days=7)
    for i in range(4):
        cycle_date = act_start + timedelta(days=21 * i)

        if i == 0:  # Completed
            status = CycleStatus.COMPLETED
        else:  # Future
            status = CycleStatus.SCHEDULED

        cycle = TreatmentCycle(
            id=ACT_CYCLE_IDS[i],
            treatment_plan_id=TREATMENT_PLAN_2_ID,
            cycle_number=i + 1,
            scheduled_date=cycle_date,
            actual_date=cycle_date if status == CycleStatus.COMPLETED else None,
            status=status,
            pre_chemo_labs={
                "WBC": 6200,
                "Hemoglobin": 13.5,
                "Platelets": 280000,
                "Creatinine": 0.72,
            } if i == 0 else None,
            pre_chemo_vitals={
                "temperature": 98.2,
                "bp_systolic": 118,
                "bp_diastolic": 76,
                "pulse": 68,
                "spo2": 99,
            } if i == 0 else None,
            patient_weight_kg=58.0,
            calculated_bsa=1.61,
            daycare_doctor_id=DOCTOR_ID,
            approved_at=datetime.combine(cycle_date, time(8, 30)) if status == CycleStatus.COMPLETED else None,
            started_at=datetime.combine(cycle_date, time(9, 30)) if status == CycleStatus.COMPLETED else None,
            completed_at=datetime.combine(cycle_date, time(12, 30)) if status == CycleStatus.COMPLETED else None,
            administered_by=NURSE_ID if status == CycleStatus.COMPLETED else None,
            discharge_notes="Tolerated AC regimen well. G-CSF started at 24h." if status == CycleStatus.COMPLETED else None,
            follow_up_instructions="Return in 21 days. Watch for fever (call if >38°C)." if status == CycleStatus.COMPLETED else None,
        )
        cycles.append(cycle)
        session.add(cycle)
    
    await session.flush()

    # Add drug administrations for active/completed cycles
    drug_count = 0
    # FOLFOX drugs for cycles 1-5
    for i in range(5):
        cycle_id = FOLFOX_CYCLE_IDS[i]
        cycle_status = CycleStatus.COMPLETED if i < 4 else CycleStatus.IN_PROGRESS
        drugs_data = [
            ("Oxaliplatin", 163.2, "mg", "IV", 120),
            ("Leucovorin", 768.0, "mg", "IV", 120),
            ("5-Fluorouracil (Bolus)", 768.0, "mg", "IV", 5),
            ("5-Fluorouracil (Infusion)", 4608.0, "mg", "IV", 2880),
        ]
        for j, (name, dose, unit, route, duration) in enumerate(drugs_data):
            if cycle_status == CycleStatus.COMPLETED:
                drug_status = AdminStatus.COMPLETED
            elif j == 0:
                drug_status = AdminStatus.STARTED
            else:
                drug_status = AdminStatus.PENDING
            drug = DrugAdministration(
                id=uuid4(),
                cycle_id=cycle_id,
                drug_name=name,
                planned_dose=dose,
                unit=unit,
                route=route,
                planned_duration_mins=duration,
                status=drug_status,
                started_at=datetime.combine(folfox_start + timedelta(days=14 * i), time(9, 15)) if drug_status in [AdminStatus.STARTED, AdminStatus.COMPLETED] else None,
                completed_at=datetime.combine(folfox_start + timedelta(days=14 * i), time(14, 30)) if drug_status == AdminStatus.COMPLETED else None,
                administered_by=NURSE_ID if drug_status in [AdminStatus.STARTED, AdminStatus.COMPLETED] else None,
            )
            session.add(drug)
            drug_count += 1

    # AC-T drugs for cycle 1 (completed)
    act_drugs = [
        ("Doxorubicin", 96.6, "mg", "IV", 30),
        ("Cyclophosphamide", 966.0, "mg", "IV", 60),
    ]
    for name, dose, unit, route, duration in act_drugs:
        drug = DrugAdministration(
            id=uuid4(),
            cycle_id=ACT_CYCLE_IDS[0],
            drug_name=name,
            planned_dose=dose,
            unit=unit,
            route=route,
            planned_duration_mins=duration,
            status=AdminStatus.COMPLETED,
            started_at=datetime.combine(today - timedelta(days=7), time(9, 45)),
            completed_at=datetime.combine(today - timedelta(days=7), time(12, 0)),
            administered_by=NURSE_ID,
        )
        session.add(drug)
        drug_count += 1

    await session.flush()
    print(f"   ✓ Created {drug_count} drug administrations")

    print(f"   ✓ Created {len(cycles)} treatment cycles")

    return cycles


async def create_appointments(session: AsyncSession) -> list:
    """Create appointments for patients."""
    print("📅 Creating appointments...")
    
    today = date.today()
    appointments = []
    
    # Patient 1 appointments
    patient1_appointments = [
        # Past completed chemo - Cycle 4
        Appointment(
            id=uuid4(),
            patient_id=PATIENT_ID,
            cycle_id=FOLFOX_CYCLE_IDS[3],
            appointment_type=AppointmentType.DAYCARE_CHEMO,
            scheduled_date=today - timedelta(days=14),
            scheduled_time=time(9, 0),
            duration_mins=360,
            chair_number=5,
            doctor_id=DOCTOR_ID,
            nurse_id=NURSE_ID,
            status=AppointmentStatus.COMPLETED,
            checked_in_at=datetime.combine(today - timedelta(days=14), time(8, 45)),
            checked_out_at=datetime.combine(today - timedelta(days=14), time(15, 30)),
            notes="Cycle 4 FOLFOX completed successfully",
        ),
        # Today's chemo - Cycle 5
        Appointment(
            id=uuid4(),
            patient_id=PATIENT_ID,
            cycle_id=FOLFOX_CYCLE_IDS[4],
            appointment_type=AppointmentType.DAYCARE_CHEMO,
            scheduled_date=today,
            scheduled_time=time(9, 0),
            duration_mins=360,
            chair_number=5,
            doctor_id=DOCTOR_ID,
            nurse_id=NURSE_ID,
            status=AppointmentStatus.IN_PROGRESS,
            checked_in_at=datetime.now() - timedelta(minutes=135),
            notes="Cycle 5 FOLFOX in progress",
        ),
        # Future follow-up
        Appointment(
            id=uuid4(),
            patient_id=PATIENT_ID,
            appointment_type=AppointmentType.FOLLOW_UP,
            scheduled_date=today + timedelta(days=7),
            scheduled_time=time(11, 0),
            duration_mins=30,
            doctor_id=OPD_DOCTOR_ID,
            status=AppointmentStatus.SCHEDULED,
            notes="Mid-treatment review with oncologist",
        ),
        # Lab work
        Appointment(
            id=uuid4(),
            patient_id=PATIENT_ID,
            appointment_type=AppointmentType.LAB_WORK,
            scheduled_date=today + timedelta(days=12),
            scheduled_time=time(8, 0),
            duration_mins=30,
            status=AppointmentStatus.SCHEDULED,
            notes="Pre-cycle 6 labs (CBC, LFT, RFT)",
        ),
    ]
    
    # Patient 2 appointments
    patient2_appointments = [
        # Past chemo - Cycle 1
        Appointment(
            id=uuid4(),
            patient_id=PATIENT_2_ID,
            cycle_id=ACT_CYCLE_IDS[0],
            appointment_type=AppointmentType.DAYCARE_CHEMO,
            scheduled_date=today - timedelta(days=7),
            scheduled_time=time(10, 0),
            duration_mins=180,
            chair_number=3,
            doctor_id=DOCTOR_ID,
            nurse_id=NURSE_ID,
            status=AppointmentStatus.COMPLETED,
            checked_in_at=datetime.combine(today - timedelta(days=7), time(9, 45)),
            checked_out_at=datetime.combine(today - timedelta(days=7), time(13, 0)),
            notes="Cycle 1 AC completed",
        ),
        # Next chemo - Cycle 2
        Appointment(
            id=uuid4(),
            patient_id=PATIENT_2_ID,
            cycle_id=ACT_CYCLE_IDS[1],
            appointment_type=AppointmentType.DAYCARE_CHEMO,
            scheduled_date=today + timedelta(days=14),
            scheduled_time=time(10, 0),
            duration_mins=180,
            chair_number=3,
            doctor_id=DOCTOR_ID,
            nurse_id=NURSE_2_ID,
            status=AppointmentStatus.CONFIRMED,
            notes="Cycle 2 AC scheduled",
        ),
    ]
    
    # Patient 3 - new patient, only OPD consultation
    patient3_appointments = [
        Appointment(
            id=uuid4(),
            patient_id=PATIENT_3_ID,
            appointment_type=AppointmentType.OPD_CONSULTATION,
            scheduled_date=today + timedelta(days=2),
            scheduled_time=time(14, 0),
            duration_mins=45,
            doctor_id=OPD_DOCTOR_ID,
            status=AppointmentStatus.SCHEDULED,
            notes="Initial oncology consultation - DLBCL staging",
        ),
    ]
    
    all_appointments = patient1_appointments + patient2_appointments + patient3_appointments
    for apt in all_appointments:
        session.add(apt)
        appointments.append(apt)
    
    await session.flush()
    print(f"   ✓ Created {len(appointments)} appointments")
    
    return appointments


async def create_vitals(session: AsyncSession) -> list:
    """Create vital records for patients."""
    print("💓 Creating vital records...")
    
    vitals = []
    
    # Patient 1 vitals - last 14 days (regular monitoring during treatment)
    for days_ago in range(14, -1, -1):
        if days_ago % 2 == 0:  # Every other day
            record_time = datetime.now() - timedelta(days=days_ago, hours=8)
            vital = Vital(
                id=uuid4(),
                patient_id=PATIENT_ID,
                recorded_at=record_time,
                recorded_by=NURSE_ID if days_ago <= 7 else None,  # Nurse recorded recent ones
                blood_pressure_systolic=130 + (days_ago % 6),
                blood_pressure_diastolic=82 + (days_ago % 4),
                pulse_bpm=74 + (days_ago % 5),
                temperature_f=97.9 + (0.2 if days_ago == 4 else 0),
                oxygen_saturation=97 + (days_ago % 2),
                respiratory_rate=16,
                weight_kg=78.2 - (days_ago * 0.05),
                pain_score=2 if days_ago in [1, 2] else 1,
                blood_sugar=125 + (days_ago * 2),
                timing="pre_chemo" if days_ago in [0, 14] else "routine",
                notes="Morning vitals" if days_ago % 2 == 0 else None,
                ai_alerts=[{"type": "blood_sugar_elevated", "severity": "low"}] if days_ago == 0 else [],
            )
            vitals.append(vital)
            session.add(vital)
    
    # Patient 2 vitals - less history (newer patient)
    for days_ago in [7, 5, 3, 1, 0]:
        record_time = datetime.now() - timedelta(days=days_ago, hours=9)
        vital = Vital(
            id=uuid4(),
            patient_id=PATIENT_2_ID,
            recorded_at=record_time,
            recorded_by=NURSE_ID if days_ago <= 3 else None,
            blood_pressure_systolic=116 + (days_ago % 4),
            blood_pressure_diastolic=74 + (days_ago % 3),
            pulse_bpm=68 + (days_ago % 4),
            temperature_f=97.7,
            oxygen_saturation=99,
            respiratory_rate=14,
            weight_kg=58.0,
            pain_score=1,
            timing="pre_chemo" if days_ago == 7 else "routine",
            notes=None,
            ai_alerts=[],
        )
        vitals.append(vital)
        session.add(vital)
    
    await session.flush()
    print(f"   ✓ Created {len(vitals)} vital records")
    
    return vitals


async def create_notifications(session: AsyncSession) -> list:
    """Create sample notifications."""
    print("🔔 Creating notifications...")
    
    from app.models.clinical import NotificationType
    
    notifications = [
        Notification(
            id=uuid4(),
            user_id=PATIENT_USER_ID,
            title="Appointment Reminder",
            body="Your chemotherapy session is scheduled for tomorrow at 9:00 AM. Please arrive 15 minutes early.",
            type=NotificationType.APPOINTMENT_REMINDER,
            is_read=False,
        ),
        Notification(
            id=uuid4(),
            user_id=PATIENT_USER_ID,
            title="Lab Results Available",
            body="Your pre-cycle blood work results are now available. All values are within acceptable range.",
            type=NotificationType.LAB_REMINDER,
            is_read=True,
            created_at=datetime.now() - timedelta(days=1),
        ),
        Notification(
            id=uuid4(),
            user_id=PATIENT_2_USER_ID,
            title="Treatment Update",
            body="Your first AC cycle was completed successfully. Remember to take your anti-nausea medication as prescribed.",
            type=NotificationType.CYCLE_COMPLETED,
            is_read=True,
            created_at=datetime.now() - timedelta(days=6),
        ),
        Notification(
            id=uuid4(),
            user_id=NURSE_USER_ID,
            title="New Patient Assignment",
            body="You have been assigned to Patient Rajesh Kumar for today's FOLFOX session (Chair 5).",
            type=NotificationType.SYSTEM,
            is_read=False,
        ),
    ]
    
    for notif in notifications:
        session.add(notif)
    
    await session.flush()
    print(f"   ✓ Created {len(notifications)} notifications")
    
    return notifications


async def main():
    """Main seed function with proper transaction handling."""
    parser = argparse.ArgumentParser(description="Seed ChemoCare database with test data")
    parser.add_argument("--clean-only", action="store_true", help="Only clean the database, don't seed")
    parser.add_argument("--no-clean", action="store_true", help="Skip cleanup, just add data")
    args = parser.parse_args()
    
    async with async_session() as session:
        try:
            print("\n" + "=" * 60)
            print("🏥 ChemoCare Database Seed Script")
            print("=" * 60 + "\n")
            
            # Cleanup phase
            if not args.no_clean:
                await cleanup_database(session)
            
            if args.clean_only:
                print("✅ Database cleaned. Exiting (--clean-only mode).")
                return
            
            # Seed phase - all in one transaction
            print("📦 Seeding database...\n")
            
            users = await create_users(session)
            patients = await create_patients(session)
            doctors = await create_doctors(session)
            nurses = await create_nurses(session)
            protocols = await create_protocol_templates(session)
            plans = await create_treatment_plans(session)
            cycles = await create_treatment_cycles(session)
            appointments = await create_appointments(session)
            vitals = await create_vitals(session)
            notifications = await create_notifications(session)
            
            # Commit everything atomically
            await session.commit()
            
            print("\n" + "=" * 60)
            print("✅ Database seeded successfully!")
            print("=" * 60)
            print("\n📊 Summary:")
            print(f"   • {len(users)} Users (3 patients, 2 doctors, 2 nurses)")
            print(f"   • {len(patients)} Patient profiles")
            print(f"   • {len(doctors)} Doctor profiles")
            print(f"   • {len(nurses)} Nurse profiles")
            print(f"   • {len(protocols)} Protocol templates")
            print(f"   • {len(plans)} Treatment plans")
            print(f"   • {len(cycles)} Treatment cycles")
            print(f"   • {len(appointments)} Appointments")
            print(f"   • {len(vitals)} Vital records")
            print(f"   • {len(notifications)} Notifications")
            
            print("\n🔐 Test Credentials:")
            print("   Patient:      patient@test.com / password123")
            print("   Patient 2:    patient2@test.com / password123")
            print("   Patient 3:    patient3@test.com / password123")
            print("   Daycare Dr:   doctor@test.com / password123")
            print("   OPD Doctor:   opd.doctor@test.com / password123")
            print("   Nurse:        nurse@test.com / password123")
            print("   Nurse 2:      nurse2@test.com / password123")
            
            print("\n🎯 Test Scenarios:")
            print("   • Patient 1 (Rajesh): Active FOLFOX treatment, Cycle 5 today")
            print("   • Patient 2 (Priya): AC-T just started, 1 cycle done")
            print("   • Patient 3 (Amit): New patient, pending treatment plan")
            print()
            
        except Exception as e:
            print(f"\n❌ Error: {e}")
            await session.rollback()
            import traceback
            traceback.print_exc()
            raise


if __name__ == "__main__":
    asyncio.run(main())
