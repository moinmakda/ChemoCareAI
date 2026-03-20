"""
Pydantic schemas for scheduling.
"""
from datetime import date, datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field


class AvailableSlotsRequest(BaseModel):
    """Request for available slots."""
    date: date
    duration_minutes: int = 180


class ScheduleAppointmentRequest(BaseModel):
    """Request to schedule an appointment."""
    patient_id: UUID
    appointment_type: str = Field(..., description="Type: treatment, consultation, follow_up, lab")
    preferred_date: date
    preferred_time: Optional[str] = Field(None, description="Time in HH:MM format")
    duration_minutes: Optional[int] = None
    notes: Optional[str] = None
    auto_assign_chair: bool = True


class RescheduleRequest(BaseModel):
    """Request to reschedule an appointment."""
    new_date: date
    new_time: Optional[str] = Field(None, description="Time in HH:MM format")


class CancelRequest(BaseModel):
    """Request to cancel an appointment."""
    reason: Optional[str] = None


class ScheduleTreatmentCyclesRequest(BaseModel):
    """Request to schedule treatment cycles."""
    treatment_plan_id: UUID
    start_date: date
    interval_days: int = 21
    num_cycles: int = 6


class TimeSlotResponse(BaseModel):
    """Time slot in response."""
    start_time: datetime
    end_time: datetime
    chair_number: Optional[int] = None
    is_available: bool = True


class ChairAvailabilityResponse(BaseModel):
    """Chair availability response."""
    chair_number: int
    is_available: bool
    current_patient_id: Optional[str] = None
    current_treatment: Optional[str] = None
    available_from: Optional[datetime] = None


class DailyScheduleSlot(BaseModel):
    """A slot in the daily schedule."""
    start_time: str
    end_time: str
    chair_number: Optional[int] = None


class DailyScheduleResponse(BaseModel):
    """Daily schedule for the day care unit."""
    date: str
    total_appointments: int
    total_treatments: int
    chair_utilization: float
    available_slots: List[DailyScheduleSlot] = []


class PatientScheduleResponse(BaseModel):
    """Patient appointment schedule response."""
    patient_id: UUID
    appointments: List[dict]
    total: int


class MyScheduleResponse(BaseModel):
    """Current user's schedule response."""
    date: Optional[str] = None
    appointments: Optional[List[dict]] = None
    total: Optional[int] = None
    total_appointments: Optional[int] = None
    total_treatments: Optional[int] = None
    chair_utilization: Optional[float] = None
