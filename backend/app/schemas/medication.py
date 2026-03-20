"""Pydantic schemas for take-home medication adherence."""
from datetime import date, datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel


class TakeHomeMedicationResponse(BaseModel):
    id: UUID
    cycle_id: Optional[UUID] = None
    patient_id: UUID
    drug_name: str
    dose: Optional[str] = None
    unit: Optional[str] = None
    route: Optional[str] = None
    frequency: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    instructions: Optional[str] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class MedicationLogCreate(BaseModel):
    taken_at: Optional[datetime] = None
    skipped: bool = False
    skip_reason: Optional[str] = None
    notes: Optional[str] = None


class MedicationLogResponse(BaseModel):
    id: UUID
    medication_id: UUID
    patient_id: UUID
    scheduled_date: Optional[date] = None
    scheduled_time: Optional[str] = None
    taken_at: Optional[datetime] = None
    skipped: bool
    skip_reason: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AdherenceResponse(BaseModel):
    total_doses: int
    taken: int
    skipped: int
    missed: int
    adherence_rate: float
    medications: List[TakeHomeMedicationResponse]
