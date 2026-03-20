"""
Patient API endpoints.
"""
from typing import List, Optional
from uuid import UUID
from datetime import date, datetime, time
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models import Patient, User, UserRole
from app.models import Appointment, AppointmentType, AppointmentStatus
from app.schemas import (
    PatientCreate,
    PatientUpdate,
    PatientResponse,
    PatientSummary,
)
from app.schemas.treatment import PatientRegistrationWithPlan, PatientRegistrationResponse
from app.api.deps import get_current_user, allow_medical_staff

router = APIRouter(prefix="/patients", tags=["Patients"])


@router.get("", response_model=List[PatientSummary])
async def list_patients(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=1000),
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(allow_medical_staff),
):
    """List all patients (staff only)."""
    query = select(Patient)
    
    if search:
        search_term = f"%{search}%"
        query = query.where(
            (Patient.first_name.ilike(search_term)) |
            (Patient.last_name.ilike(search_term)) |
            (Patient.cancer_type.ilike(search_term))
        )
    
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    patients = result.scalars().all()
    
    return patients


@router.post("", response_model=PatientResponse, status_code=status.HTTP_201_CREATED)
async def create_patient(
    patient_data: PatientCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new patient profile."""
    # If patient role, link to current user
    user_id = None
    if current_user.role == UserRole.PATIENT:
        # Check if user already has a patient profile
        result = await db.execute(select(Patient).where(Patient.user_id == current_user.id))
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Patient profile already exists for this user",
            )
        user_id = current_user.id
    
    patient = Patient(
        user_id=user_id,
        **patient_data.model_dump(),
    )
    db.add(patient)
    await db.commit()
    await db.refresh(patient)
    
    return patient


@router.get("/me", response_model=PatientResponse)
async def get_my_profile(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get current patient's profile."""
    if current_user.role != UserRole.PATIENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only patients can access this endpoint",
        )
    
    result = await db.execute(select(Patient).where(Patient.user_id == current_user.id))
    patient = result.scalar_one_or_none()
    
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient profile not found",
        )
    
    return patient


@router.put("/me", response_model=PatientResponse)
async def update_my_profile(
    patient_data: PatientUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update current patient's profile."""
    if current_user.role != UserRole.PATIENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only patients can access this endpoint",
        )
    
    result = await db.execute(select(Patient).where(Patient.user_id == current_user.id))
    patient = result.scalar_one_or_none()
    
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient profile not found",
        )
    
    # Update fields
    update_data = patient_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(patient, field, value)
    
    await db.commit()
    await db.refresh(patient)
    
    return patient


@router.get("/{patient_id}", response_model=PatientResponse)
async def get_patient(
    patient_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get patient by ID."""
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found",
        )
    
    # Patients can only view their own profile
    if current_user.role == UserRole.PATIENT and patient.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )
    
    return patient


@router.put("/{patient_id}", response_model=PatientResponse)
async def update_patient(
    patient_id: UUID,
    patient_data: PatientUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update patient profile."""
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found",
        )
    
    # Patients can only update their own profile
    if current_user.role == UserRole.PATIENT and patient.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )
    
    # Update fields
    update_data = patient_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(patient, field, value)
    
    await db.commit()
    await db.refresh(patient)
    
    return patient


@router.post("/register-with-plan")
async def register_patient_with_plan(
    data: PatientRegistrationWithPlan,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(allow_medical_staff),
):
    """
    OPD Doctor registers a new patient with a treatment plan in one atomic step.
    Creates: User → Patient → TreatmentPlan → TreatmentCycles.
    Returns login credentials for the patient.
    """
    from app.models import TreatmentPlan, TreatmentCycle, Doctor, DrugAdministration
    from app.models.treatment import PlanStatus, CycleStatus, AdminStatus
    from app.core.security import get_password_hash
    from datetime import timedelta
    import secrets
    import string
    import math

    # Generate credentials
    password = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(8))

    # Use patient's real email if provided, otherwise generate a system email
    if data.patient_email and data.patient_email.strip():
        email = data.patient_email.strip().lower()
        existing = await db.execute(select(User).where(User.email == email))
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"A user with email {email} already exists",
            )
    else:
        clean_first = data.first_name.lower().strip().replace(" ", "")
        clean_last = data.last_name.lower().strip().replace(" ", "")
        suffix = ''.join(secrets.choice(string.digits) for _ in range(4))
        email = f"{clean_first}.{clean_last}.{suffix}@chemocare.patient"
        existing = await db.execute(select(User).where(User.email == email))
        if existing.scalar_one_or_none():
            suffix = ''.join(secrets.choice(string.digits) for _ in range(6))
            email = f"{clean_first}.{clean_last}.{suffix}@chemocare.patient"

    try:
        # 1. Create User
        user = User(
            email=email,
            password_hash=get_password_hash(password),
            full_name=f"{data.first_name} {data.last_name}",
            role=UserRole.PATIENT,
            is_active=True,
        )
        db.add(user)
        await db.flush()

        # 2. Create Patient
        patient = Patient(
            user_id=user.id,
            first_name=data.first_name,
            last_name=data.last_name,
            date_of_birth=data.date_of_birth,
            gender=data.gender,
            cancer_type=data.cancer_type,
            cancer_stage=data.cancer_stage,
            height_cm=data.height_cm,
            weight_kg=data.weight_kg,
        )
        db.add(patient)
        await db.flush()

        # 3. Get doctor ID
        doc_result = await db.execute(select(Doctor).where(Doctor.user_id == current_user.id))
        doctor = doc_result.scalar_one_or_none()

        # 4. Generate protocol if protocol_code provided
        custom_protocol = data.custom_protocol
        if data.protocol_code and not custom_protocol:
            try:
                from app.services.sophia import generate_protocol_from_clinical_data
                sophia_result = generate_protocol_from_clinical_data(
                    protocol_code=data.protocol_code,
                    clinical_data={
                        "weight_kg": data.weight_kg or 70,
                        "height_cm": data.height_cm or 170,
                        "performance_status": "0",
                        "neutrophils": 2.5,
                        "platelets": 150,
                        "hemoglobin": 12.0,
                        "bilirubin": 15,
                        "gfr": 80,
                    },
                    patient_age=None,
                    cycle_number=1,
                )
                custom_protocol = sophia_result
            except Exception:
                custom_protocol = {"protocol_code": data.protocol_code}

        # 5. Create Treatment Plan
        plan = TreatmentPlan(
            patient_id=patient.id,
            protocol_name=data.protocol_name,
            custom_protocol=custom_protocol,
            start_date=data.start_date,
            planned_cycles=data.planned_cycles,
            completed_cycles=0,
            status=PlanStatus.APPROVED,
            created_by_doctor_id=doctor.id if doctor else None,
            opd_approved_by=doctor.id if doctor else None,
            opd_notes=data.opd_notes,
        )
        db.add(plan)
        await db.flush()

        # 6. Create Treatment Cycles + Appointments
        cycle_length = data.cycle_length_days
        for i in range(1, data.planned_cycles + 1):
            cycle_date = data.start_date + timedelta(days=(i - 1) * cycle_length)
            cycle = TreatmentCycle(
                treatment_plan_id=plan.id,
                cycle_number=i,
                scheduled_date=cycle_date,
                status=CycleStatus.APPROVED,
                daycare_doctor_id=doctor.id if doctor else None,
                approved_at=datetime.utcnow(),
            )
            db.add(cycle)
            await db.flush()

            # Create appointment linked to this cycle
            appointment = Appointment(
                patient_id=patient.id,
                appointment_type=AppointmentType.DAYCARE_CHEMO,
                scheduled_date=cycle_date,
                scheduled_time=time(9, 0),
                duration_mins=180,
                cycle_id=cycle.id,
                doctor_id=str(doctor.id) if doctor else None,
                status=AppointmentStatus.SCHEDULED,
            )
            db.add(appointment)

            # Create drug administration records from protocol
            if custom_protocol:
                drugs = (
                    custom_protocol.get("chemotherapy_drugs")
                    or custom_protocol.get("drugs")
                    or []
                )
                for drug in drugs:
                    drug_admin = DrugAdministration(
                        cycle_id=cycle.id,
                        drug_name=drug.get("drug_name") or drug.get("drugName", ""),
                        planned_dose=drug.get("calculated_dose") or drug.get("calculatedDose") or drug.get("dose", 0),
                        unit=drug.get("calculated_dose_unit") or drug.get("calculatedDoseUnit") or drug.get("unit", "mg"),
                        route=drug.get("route", "IV"),
                        status=AdminStatus.PENDING,
                    )
                    db.add(drug_admin)

        await db.commit()

        # Send credentials email inline (not fire-and-forget)
        recipient_email = getattr(data, "patient_email", None)
        if recipient_email:
            import logging
            _email_logger = logging.getLogger(__name__)
            try:
                from app.services.email_service import send_patient_credentials_email
                success = await send_patient_credentials_email(
                    to_email=recipient_email,
                    patient_name=f"{data.first_name} {data.last_name}",
                    login_email=email,
                    login_password=password,
                    protocol_name=data.protocol_name,
                    start_date=data.start_date.strftime("%B %d, %Y"),
                    doctor_name=current_user.full_name or "Your Doctor",
                )
                if success:
                    _email_logger.info(f"Credentials email sent to {recipient_email}")
                else:
                    _email_logger.warning(f"Credentials email failed for {recipient_email}")
            except Exception as email_err:
                import logging
                logging.getLogger(__name__).error(f"Email send error: {email_err}")

        # Compute next treatment date
        next_treatment = data.start_date if data.start_date >= date.today() else None
        if not next_treatment:
            for i in range(1, data.planned_cycles + 1):
                cd = data.start_date + timedelta(days=(i - 1) * cycle_length)
                if cd >= date.today():
                    next_treatment = cd
                    break

        return PatientRegistrationResponse(
            patient_id=patient.id,
            patient_name=f"{data.first_name} {data.last_name}",
            treatment_plan_id=plan.id,
            protocol_name=data.protocol_name,
            cycles_created=data.planned_cycles,
            login_email=email,
            login_password=password,
            start_date=data.start_date,
            next_treatment_date=next_treatment,
            email_sent_to=recipient_email,
        )

    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Registration failed")


@router.delete("/{patient_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_patient(
    patient_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(allow_medical_staff),
):
    """Delete patient (staff only)."""
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found",
        )
    
    await db.delete(patient)
    await db.commit()
