#!/usr/bin/env python3
"""
Seed script to create test data for ChemoCare development.
This creates:
- Patient profiles linked to the test patient user
- Sample appointments
- Sample vitals
- Sample treatment plans
"""
import asyncio
import uuid
from datetime import date, datetime, time, timedelta
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, text
import os
import sys

# Add parent to path to import from app
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from app.models import (
    User, Patient, Doctor, Nurse,
    Vital, Appointment, TreatmentPlan, TreatmentCycle,
    UserRole, Gender, BloodGroup, AppointmentType, AppointmentStatus, PlanStatus, CycleStatus
)

# Get database URL
DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql+asyncpg://moinmakda:@localhost/chemocare")

engine = create_async_engine(DATABASE_URL, echo=True)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_or_create_patient(session: AsyncSession, user: User) -> Patient:
    """Get or create a patient profile for a user."""
    result = await session.execute(select(Patient).where(Patient.user_id == user.id))
    patient = result.scalar_one_or_none()
    
    if patient:
        print(f"Patient profile already exists: {patient.first_name} {patient.last_name}")
        return patient
    
    # Create patient profile
    patient = Patient(
        user_id=user.id,
        first_name="Test",
        last_name="Patient",
        date_of_birth=date(1985, 5, 15),
        gender=Gender.MALE,
        blood_group=BloodGroup.O_POS,
        address="123 Main Street",
        city="Mumbai",
        state="Maharashtra",
        pincode="400001",
        emergency_contact_name="Emergency Contact",
        emergency_contact_phone="+91 9876543210",
        emergency_contact_relation="Spouse",
        height_cm=175.0,
        weight_kg=70.0,
        allergies=["Penicillin"],
        comorbidities=["Hypertension"],
        current_medications=[
            {"name": "Metformin", "dose": "500mg", "frequency": "twice daily"}
        ],
        cancer_type="Breast Cancer",
        cancer_stage="Stage II",
        diagnosis_date=date(2024, 1, 15),
        histopathology_details="Invasive ductal carcinoma, ER+/PR+/HER2-",
        insurance_provider="Health Insurance Co",
        insurance_policy_number="HI-123456789",
        insurance_validity=date(2025, 12, 31),
    )
    session.add(patient)
    await session.flush()
    print(f"Created patient profile: {patient.first_name} {patient.last_name}")
    return patient


async def get_or_create_doctor(session: AsyncSession, user: User) -> Doctor:
    """Get or create a doctor profile for a user."""
    result = await session.execute(select(Doctor).where(Doctor.user_id == user.id))
    doctor = result.scalar_one_or_none()
    
    if doctor:
        print(f"Doctor profile already exists: {doctor.first_name} {doctor.last_name}")
        return doctor
    
    is_daycare = user.role == UserRole.DOCTOR_DAYCARE
    
    doctor = Doctor(
        user_id=user.id,
        first_name="Dr. Test",
        last_name="Doctor",
        specialization="Medical Oncology" if is_daycare else "Surgical Oncology",
        qualification="MD, DM (Medical Oncology)" if is_daycare else "MS, MCh (Surgical Oncology)",
        registration_number=f"MCI-{str(uuid.uuid4())[:8]}",
        experience_years=15,
        is_opd_doctor=not is_daycare,
        is_daycare_doctor=is_daycare,
    )
    session.add(doctor)
    await session.flush()
    print(f"Created doctor profile: {doctor.first_name} {doctor.last_name}")
    return doctor


async def get_or_create_nurse(session: AsyncSession, user: User) -> Nurse:
    """Get or create a nurse profile for a user."""
    result = await session.execute(select(Nurse).where(Nurse.user_id == user.id))
    nurse = result.scalar_one_or_none()
    
    if nurse:
        print(f"Nurse profile already exists: {nurse.first_name} {nurse.last_name}")
        return nurse
    
    nurse = Nurse(
        user_id=user.id,
        first_name="Test",
        last_name="Nurse",
        qualification="B.Sc Nursing",
        registration_number=f"RN-{str(uuid.uuid4())[:8]}",
        experience_years=8,
        chemo_certified=True,
        certification_date=date(2020, 6, 15),
    )
    session.add(nurse)
    await session.flush()
    print(f"Created nurse profile: {nurse.first_name} {nurse.last_name}")
    return nurse


async def create_treatment_plan(session: AsyncSession, patient: Patient, doctor: Doctor) -> TreatmentPlan:
    """Create a treatment plan for the patient."""
    # Check if already exists
    result = await session.execute(
        select(TreatmentPlan).where(TreatmentPlan.patient_id == patient.id)
    )
    existing = result.scalar_one_or_none()
    if existing:
        print(f"Treatment plan already exists: {existing.protocol_name}")
        return existing
    
    plan = TreatmentPlan(
        patient_id=patient.id,
        protocol_name="AC-T (Doxorubicin + Cyclophosphamide, then Paclitaxel)",
        custom_protocol={
            "drugs": [
                {"name": "Doxorubicin", "dose": "60 mg/m²", "schedule": "Day 1"},
                {"name": "Cyclophosphamide", "dose": "600 mg/m²", "schedule": "Day 1"},
            ],
            "cycle_duration": 21,
        },
        start_date=date.today() - timedelta(days=42),  # Started 6 weeks ago
        planned_cycles=6,
        completed_cycles=2,
        status=PlanStatus.ACTIVE,
        ai_recommendations="Standard AC-T regimen for ER+/PR+/HER2- breast cancer. Consider G-CSF support.",
        ai_risk_assessment={
            "cardiotoxicity_risk": "moderate",
            "neutropenia_risk": "high",
        },
        ai_confidence_score=0.92,
        created_by_doctor_id=doctor.id,
        opd_approved_by=str(doctor.id),
        opd_approved_at=datetime.utcnow() - timedelta(days=45),
        daycare_approved_by=str(doctor.id),
        daycare_approved_at=datetime.utcnow() - timedelta(days=44),
    )
    session.add(plan)
    await session.flush()
    print(f"Created treatment plan: {plan.protocol_name}")
    return plan


async def create_treatment_cycles(session: AsyncSession, plan: TreatmentPlan, doctor: Doctor, nurse: Nurse):
    """Create treatment cycles for the plan."""
    # Check if cycles exist
    result = await session.execute(
        select(TreatmentCycle).where(TreatmentCycle.treatment_plan_id == plan.id)
    )
    existing = result.scalars().all()
    if existing:
        print(f"Treatment cycles already exist: {len(existing)} cycles")
        return existing
    
    cycles = []
    start_date = plan.start_date
    
    for i in range(plan.planned_cycles):
        cycle_date = start_date + timedelta(days=21 * i)
        status = CycleStatus.COMPLETED if i < plan.completed_cycles else (
            CycleStatus.SCHEDULED if i > plan.completed_cycles else CycleStatus.APPROVED
        )
        
        cycle = TreatmentCycle(
            treatment_plan_id=plan.id,
            cycle_number=i + 1,
            scheduled_date=cycle_date,
            actual_date=cycle_date if status == CycleStatus.COMPLETED else None,
            status=status,
            pre_chemo_labs={
                "WBC": 5500 + (i * 200),
                "Hemoglobin": 12.5 - (i * 0.3),
                "Platelets": 220000 - (i * 10000),
                "Creatinine": 0.9,
            },
            pre_chemo_vitals={
                "temperature": 98.6,
                "bp_systolic": 120,
                "bp_diastolic": 80,
                "pulse": 72,
            },
            patient_weight_kg=70 - (i * 0.5),
            calculated_bsa=1.85,
            daycare_doctor_id=doctor.id,
            approved_at=datetime.combine(cycle_date, time(8, 0)) if status in [CycleStatus.COMPLETED, CycleStatus.APPROVED] else None,
            started_at=datetime.combine(cycle_date, time(9, 0)) if status == CycleStatus.COMPLETED else None,
            completed_at=datetime.combine(cycle_date, time(14, 0)) if status == CycleStatus.COMPLETED else None,
            administered_by=nurse.id if status == CycleStatus.COMPLETED else None,
            discharge_notes="Tolerated well. Mild nausea managed with ondansetron." if status == CycleStatus.COMPLETED else None,
            follow_up_instructions="Return in 21 days. Watch for fever, bleeding, or severe fatigue." if status == CycleStatus.COMPLETED else None,
        )
        cycles.append(cycle)
        session.add(cycle)
    
    await session.flush()
    print(f"Created {len(cycles)} treatment cycles")
    return cycles


async def create_appointments(session: AsyncSession, patient: Patient, doctor: Doctor, nurse: Nurse):
    """Create sample appointments."""
    # Check if appointments exist
    result = await session.execute(
        select(Appointment).where(Appointment.patient_id == patient.id)
    )
    existing = result.scalars().all()
    if existing:
        print(f"Appointments already exist: {len(existing)} appointments")
        return existing
    
    appointments = []
    
    # Past appointment (completed)
    past_apt = Appointment(
        patient_id=patient.id,
        appointment_type=AppointmentType.DAYCARE_CHEMO,
        scheduled_date=date.today() - timedelta(days=7),
        scheduled_time=time(10, 0),
        duration_mins=240,
        chair_number=3,
        doctor_id=doctor.id,
        nurse_id=nurse.id,
        status=AppointmentStatus.COMPLETED,
        checked_in_at=datetime.combine(date.today() - timedelta(days=7), time(9, 45)),
        checked_out_at=datetime.combine(date.today() - timedelta(days=7), time(14, 30)),
        notes="Cycle 2 completed successfully",
    )
    appointments.append(past_apt)
    
    # Today's appointment
    today_apt = Appointment(
        patient_id=patient.id,
        appointment_type=AppointmentType.FOLLOW_UP,
        scheduled_date=date.today(),
        scheduled_time=time(14, 30),
        duration_mins=30,
        doctor_id=doctor.id,
        status=AppointmentStatus.SCHEDULED,
        notes="Post-cycle 2 follow-up",
    )
    appointments.append(today_apt)
    
    # Tomorrow's chemotherapy
    tomorrow_apt = Appointment(
        patient_id=patient.id,
        appointment_type=AppointmentType.DAYCARE_CHEMO,
        scheduled_date=date.today() + timedelta(days=1),
        scheduled_time=time(9, 0),
        duration_mins=300,
        chair_number=5,
        doctor_id=doctor.id,
        nurse_id=nurse.id,
        status=AppointmentStatus.CONFIRMED,
        notes="Cycle 3 - AC regimen",
    )
    appointments.append(tomorrow_apt)
    
    # Lab work appointment
    lab_apt = Appointment(
        patient_id=patient.id,
        appointment_type=AppointmentType.LAB_WORK,
        scheduled_date=date.today() + timedelta(days=5),
        scheduled_time=time(8, 0),
        duration_mins=30,
        status=AppointmentStatus.SCHEDULED,
        notes="Pre-cycle 4 blood work (CBC, LFT, RFT)",
    )
    appointments.append(lab_apt)
    
    for apt in appointments:
        session.add(apt)
    
    await session.flush()
    print(f"Created {len(appointments)} appointments")
    return appointments


async def create_vitals(session: AsyncSession, patient: Patient, nurse: Nurse):
    """Create sample vital records."""
    # Check if vitals exist
    result = await session.execute(
        select(Vital).where(Vital.patient_id == patient.id)
    )
    existing = result.scalars().all()
    if existing:
        print(f"Vitals already exist: {len(existing)} records")
        return existing
    
    vitals = []
    
    # Create vitals for past few days
    for days_ago in range(7, -1, -1):
        record_date = datetime.now() - timedelta(days=days_ago)
        
        vital = Vital(
            patient_id=patient.id,
            recorded_at=record_date,
            recorded_by=nurse.id,
            temperature_f=98.4 + (0.2 if days_ago == 3 else 0),  # Slight fever on day 3
            pulse_bpm=72 + (days_ago % 5),
            blood_pressure_systolic=118 + (days_ago % 8),
            blood_pressure_diastolic=78 + (days_ago % 5),
            respiratory_rate=16,
            oxygen_saturation=98 - (1 if days_ago == 3 else 0),
            pain_score=2 if days_ago in [1, 2, 3] else 1,
            blood_sugar=110 + (days_ago * 2),
            weight_kg=70 - (days_ago * 0.1),
            notes="Morning vitals" if days_ago % 2 == 0 else "Evening vitals",
            timing="pre_chemo" if days_ago == 7 else "routine",
            ai_alerts=[] if days_ago != 3 else [
                {"type": "mild_fever", "message": "Temperature slightly elevated", "severity": "low"}
            ],
        )
        vitals.append(vital)
        session.add(vital)
    
    await session.flush()
    print(f"Created {len(vitals)} vital records")
    return vitals


async def main():
    """Main function to seed the database."""
    async with async_session() as session:
        try:
            print("\n" + "="*60)
            print("ChemoCare Database Seed Script")
            print("="*60 + "\n")
            
            # Get test users
            result = await session.execute(
                select(User).where(User.email == "patient@test.com")
            )
            patient_user = result.scalar_one_or_none()
            
            result = await session.execute(
                select(User).where(User.email == "doctor@test.com")
            )
            daycare_doctor_user = result.scalar_one_or_none()
            
            result = await session.execute(
                select(User).where(User.email == "nurse@test.com")
            )
            nurse_user = result.scalar_one_or_none()
            
            if not all([patient_user, daycare_doctor_user, nurse_user]):
                print("❌ Test users not found! Please run create_test_users.py first.")
                print(f"   patient@test.com: {'✓' if patient_user else '✗'}")
                print(f"   doctor@test.com: {'✓' if daycare_doctor_user else '✗'}")
                print(f"   nurse@test.com: {'✓' if nurse_user else '✗'}")
                return
            
            print("✓ Found test users\n")
            
            # Create profiles
            patient = await get_or_create_patient(session, patient_user)
            doctor = await get_or_create_doctor(session, daycare_doctor_user)
            nurse = await get_or_create_nurse(session, nurse_user)
            
            print()
            
            # Create treatment plan and cycles
            plan = await create_treatment_plan(session, patient, doctor)
            cycles = await create_treatment_cycles(session, plan, doctor, nurse)
            
            print()
            
            # Create appointments
            appointments = await create_appointments(session, patient, doctor, nurse)
            
            print()
            
            # Create vitals
            vitals = await create_vitals(session, patient, nurse)
            
            await session.commit()
            
            print("\n" + "="*60)
            print("✅ Database seeded successfully!")
            print("="*60)
            print("\nCreated:")
            print(f"  • 1 Patient profile (ID: {patient.id})")
            print(f"  • 1 Doctor profile (ID: {doctor.id})")
            print(f"  • 1 Nurse profile (ID: {nurse.id})")
            print(f"  • 1 Treatment plan with {len(cycles)} cycles")
            print(f"  • {len(appointments)} Appointments")
            print(f"  • {len(vitals)} Vital records")
            print("\nYou can now test the mobile app with real data!")
            
        except Exception as e:
            print(f"\n❌ Error: {e}")
            await session.rollback()
            raise


if __name__ == "__main__":
    asyncio.run(main())
