"""Nurse Shift Handover API endpoints."""
from typing import List
from uuid import UUID
from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models import User, Nurse, Appointment, AppointmentStatus, TreatmentCycle, DrugAdministration, Patient
from app.models.clinical import ShiftHandover
from app.schemas.clinical import ShiftHandoverCreate, ShiftHandoverResponse
from app.api.deps import get_current_user, allow_nurses

router = APIRouter(prefix="/shift-handover", tags=["Shift Handover"])


@router.post("", response_model=ShiftHandoverResponse, status_code=status.HTTP_201_CREATED)
async def create_handover(
    data: ShiftHandoverCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(allow_nurses),
):
    """Create a shift handover report."""
    result = await db.execute(select(Nurse).where(Nurse.user_id == current_user.id))
    nurse = result.scalar_one_or_none()

    handover = ShiftHandover(
        shift_date=data.shift_date,
        shift_type=data.shift_type,
        outgoing_nurse_id=nurse.id if nurse else None,
        patients_summary=data.patients_summary,
        general_notes=data.general_notes,
    )
    db.add(handover)
    await db.commit()
    await db.refresh(handover)
    return handover


@router.get("/latest", response_model=ShiftHandoverResponse)
async def get_latest_handover(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(allow_nurses),
):
    """Get the most recent handover."""
    result = await db.execute(
        select(ShiftHandover).order_by(ShiftHandover.created_at.desc()).limit(1)
    )
    handover = result.scalar_one_or_none()
    if not handover:
        raise HTTPException(status_code=404, detail="No handover reports found")
    return handover


@router.post("/{handover_id}/acknowledge", response_model=ShiftHandoverResponse)
async def acknowledge_handover(
    handover_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(allow_nurses),
):
    """Acknowledge a handover as incoming nurse."""
    result = await db.execute(select(ShiftHandover).where(ShiftHandover.id == handover_id))
    handover = result.scalar_one_or_none()
    if not handover:
        raise HTTPException(status_code=404, detail="Handover not found")

    result = await db.execute(select(Nurse).where(Nurse.user_id == current_user.id))
    nurse = result.scalar_one_or_none()

    handover.incoming_nurse_id = nurse.id if nurse else None
    handover.acknowledged_at = datetime.utcnow()
    await db.commit()
    await db.refresh(handover)
    return handover


@router.get("/auto-populate")
async def auto_populate_handover(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(allow_nurses),
):
    """Auto-populate handover with today's active patients and their status."""
    today = date.today()

    # Get today's appointments that are active
    result = await db.execute(
        select(Appointment).where(
            Appointment.scheduled_date == today,
            Appointment.status.in_([
                AppointmentStatus.CHECKED_IN,
                AppointmentStatus.IN_PROGRESS,
                AppointmentStatus.SCHEDULED,
                AppointmentStatus.CONFIRMED,
            ])
        )
    )
    appointments = result.scalars().all()

    patients_summary = []
    for apt in appointments:
        # Get patient name
        pat_result = await db.execute(select(Patient).where(Patient.id == apt.patient_id))
        patient = pat_result.scalar_one_or_none()

        summary = {
            "patient_id": str(apt.patient_id),
            "patient_name": f"{patient.first_name} {patient.last_name}" if patient else "Unknown",
            "appointment_status": apt.status.value if hasattr(apt.status, 'value') else str(apt.status),
            "appointment_type": apt.appointment_type.value if hasattr(apt.appointment_type, 'value') else str(apt.appointment_type),
        }

        # If there's a cycle, get drug admin status
        if apt.cycle_id:
            cycle_result = await db.execute(select(TreatmentCycle).where(TreatmentCycle.id == apt.cycle_id))
            cycle = cycle_result.scalar_one_or_none()
            if cycle:
                summary["cycle_number"] = cycle.cycle_number
                summary["cycle_status"] = cycle.status.value if hasattr(cycle.status, 'value') else str(cycle.status)

                drugs_result = await db.execute(
                    select(DrugAdministration).where(DrugAdministration.cycle_id == apt.cycle_id)
                )
                drugs = drugs_result.scalars().all()
                completed = sum(1 for d in drugs if str(d.status) == 'completed' or (hasattr(d.status, 'value') and d.status.value == 'completed'))
                summary["drugs_completed"] = completed
                summary["drugs_total"] = len(drugs)

        patients_summary.append(summary)

    return {
        "shift_date": str(today),
        "patients_summary": patients_summary,
        "total_patients": len(patients_summary),
    }
