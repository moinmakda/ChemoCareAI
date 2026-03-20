"""Clinical Notes API endpoints."""
from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models import User, UserRole, Doctor
from app.models.clinical import ClinicalNote
from app.schemas.clinical import ClinicalNoteCreate, ClinicalNoteUpdate, ClinicalNoteResponse
from app.api.deps import get_current_user, allow_doctors, allow_medical_staff

router = APIRouter(prefix="/clinical-notes", tags=["Clinical Notes"])


@router.post("", response_model=ClinicalNoteResponse, status_code=status.HTTP_201_CREATED)
async def create_note(
    note_data: ClinicalNoteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(allow_doctors),
):
    """Create a clinical note. Doctors only."""
    result = await db.execute(select(Doctor).where(Doctor.user_id == current_user.id))
    doctor = result.scalar_one_or_none()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor profile not found")

    note = ClinicalNote(
        patient_id=note_data.patient_id,
        doctor_id=doctor.id,
        cycle_id=note_data.cycle_id if note_data.cycle_id else None,
        appointment_id=note_data.appointment_id if note_data.appointment_id else None,
        note_type=note_data.note_type,
        content=note_data.content,
        is_private=note_data.is_private,
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return note


@router.get("", response_model=List[ClinicalNoteResponse])
async def list_notes(
    patient_id: UUID,
    cycle_id: Optional[UUID] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(allow_medical_staff),
):
    """List clinical notes for a patient. Nurses see non-private notes only."""
    query = select(ClinicalNote).where(ClinicalNote.patient_id == patient_id)

    if current_user.role == UserRole.NURSE:
        query = query.where(ClinicalNote.is_private == False)

    if cycle_id:
        query = query.where(ClinicalNote.cycle_id == cycle_id)

    query = query.order_by(ClinicalNote.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.put("/{note_id}", response_model=ClinicalNoteResponse)
async def update_note(
    note_id: UUID,
    note_data: ClinicalNoteUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(allow_doctors),
):
    """Update a clinical note. Only the authoring doctor can update."""
    result = await db.execute(select(ClinicalNote).where(ClinicalNote.id == note_id))
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    result = await db.execute(select(Doctor).where(Doctor.user_id == current_user.id))
    doctor = result.scalar_one_or_none()
    if not doctor or note.doctor_id != doctor.id:
        raise HTTPException(status_code=403, detail="Only the authoring doctor can update this note")

    update_data = note_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(note, field, value)

    await db.commit()
    await db.refresh(note)
    return note


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(
    note_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(allow_doctors),
):
    """Delete a clinical note. Only the authoring doctor can delete."""
    result = await db.execute(select(ClinicalNote).where(ClinicalNote.id == note_id))
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    result = await db.execute(select(Doctor).where(Doctor.user_id == current_user.id))
    doctor = result.scalar_one_or_none()
    if not doctor or note.doctor_id != doctor.id:
        raise HTTPException(status_code=403, detail="Only the authoring doctor can delete this note")

    await db.delete(note)
    await db.commit()
