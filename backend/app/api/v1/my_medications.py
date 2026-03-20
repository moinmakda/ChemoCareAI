"""Take-home Medication Adherence API endpoints."""
from typing import List
from uuid import UUID
from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.models import User, UserRole, Patient
from app.models.medication import TakeHomeMedication, MedicationLog
from app.schemas.medication import TakeHomeMedicationResponse, MedicationLogCreate, MedicationLogResponse, AdherenceResponse
from app.api.deps import get_current_user, allow_patients, allow_all

router = APIRouter(prefix="/my-medications", tags=["Take-home Medications"])


@router.get("", response_model=List[TakeHomeMedicationResponse])
async def list_medications(
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List take-home medications. Patients see only their own."""
    # Get patient ID
    result = await db.execute(select(Patient).where(Patient.user_id == current_user.id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")

    query = select(TakeHomeMedication).where(TakeHomeMedication.patient_id == patient.id)
    if active_only:
        query = query.where(TakeHomeMedication.is_active == True)

    query = query.order_by(TakeHomeMedication.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/{med_id}/log", response_model=MedicationLogResponse, status_code=status.HTTP_201_CREATED)
async def log_medication(
    med_id: UUID,
    log_data: MedicationLogCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Log medication taken/skipped."""
    result = await db.execute(select(Patient).where(Patient.user_id == current_user.id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")

    # Verify medication belongs to this patient
    result = await db.execute(select(TakeHomeMedication).where(TakeHomeMedication.id == med_id))
    med = result.scalar_one_or_none()
    if not med or med.patient_id != patient.id:
        raise HTTPException(status_code=404, detail="Medication not found")

    log = MedicationLog(
        medication_id=med_id,
        patient_id=patient.id,
        scheduled_date=date.today(),
        taken_at=log_data.taken_at or (datetime.utcnow() if not log_data.skipped else None),
        skipped=log_data.skipped,
        skip_reason=log_data.skip_reason,
        notes=log_data.notes,
    )
    db.add(log)
    await db.commit()
    await db.refresh(log)
    return log


@router.get("/adherence", response_model=AdherenceResponse)
async def get_adherence(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get medication adherence summary."""
    result = await db.execute(select(Patient).where(Patient.user_id == current_user.id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")

    # Get all active medications
    meds_result = await db.execute(
        select(TakeHomeMedication).where(
            TakeHomeMedication.patient_id == patient.id,
            TakeHomeMedication.is_active == True,
        )
    )
    medications = meds_result.scalars().all()

    # Get all logs
    logs_result = await db.execute(
        select(MedicationLog).where(MedicationLog.patient_id == patient.id)
    )
    logs = logs_result.scalars().all()

    taken = sum(1 for l in logs if l.taken_at and not l.skipped)
    skipped = sum(1 for l in logs if l.skipped)
    total = len(logs)
    missed = total - taken - skipped

    adherence_rate = (taken / total * 100) if total > 0 else 100.0

    return AdherenceResponse(
        total_doses=total,
        taken=taken,
        skipped=skipped,
        missed=max(0, missed),
        adherence_rate=round(adherence_rate, 1),
        medications=medications,
    )
