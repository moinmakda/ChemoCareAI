"""
Scheduling Service

Intelligent appointment and treatment scheduling system that:
- Schedules treatment cycles based on protocol intervals
- Manages chair allocation in the day care
- Handles appointment conflicts
- Sends reminder notifications
- Supports rescheduling with conflict detection
"""
from datetime import datetime, date, time, timedelta
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Appointment,
    AppointmentType,
    AppointmentStatus,
    TreatmentPlan,
    TreatmentCycle,
    Notification,
    NotificationType,
)


# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class TimeSlot(BaseModel):
    """Available time slot."""
    start_time: datetime
    end_time: datetime
    chair_number: Optional[int] = None
    is_available: bool = True


class SchedulingResult(BaseModel):
    """Result of a scheduling operation."""
    success: bool
    appointment_id: Optional[int] = None
    scheduled_time: Optional[datetime] = None
    chair_number: Optional[int] = None
    conflicts: List[str] = Field(default=[])
    message: str


class TreatmentScheduleResult(BaseModel):
    """Result of scheduling a treatment plan."""
    success: bool
    scheduled_cycles: List[Dict[str, Any]] = Field(default=[])
    conflicts: List[str] = Field(default=[])
    message: str


class ChairAvailability(BaseModel):
    """Chair availability for a specific time."""
    chair_number: int
    is_available: bool
    current_patient_id: Optional[str] = None  # UUID as string
    current_treatment: Optional[str] = None
    available_from: Optional[datetime] = None


class DailySchedule(BaseModel):
    """Daily schedule summary."""
    date: date
    total_appointments: int
    total_treatments: int
    chair_utilization: Dict[int, List[Dict[str, Any]]] = Field(default={})
    available_slots: List[TimeSlot] = Field(default=[])


# =============================================================================
# CONSTANTS
# =============================================================================

# Day care operational hours
DAYCARE_OPEN_TIME = time(8, 0)  # 8:00 AM
DAYCARE_CLOSE_TIME = time(18, 0)  # 6:00 PM

# Number of chairs in day care
TOTAL_CHAIRS = 20

# Default treatment durations (in minutes)
DEFAULT_TREATMENT_DURATIONS = {
    "chemotherapy": 180,  # 3 hours
    "immunotherapy": 120,  # 2 hours
    "blood_transfusion": 240,  # 4 hours
    "consultation": 30,
    "vitals_check": 15,
    "lab_draw": 15,
}

# Appointment reminder times (hours before)
REMINDER_HOURS = [24, 2]  # 24 hours and 2 hours before


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

async def get_chair_availability(
    db: AsyncSession,
    target_date: date,
    start_time: time,
    end_time: time,
) -> List[ChairAvailability]:
    """Get availability of all chairs for a specific time range."""
    
    start_datetime = datetime.combine(target_date, start_time)
    end_datetime = datetime.combine(target_date, end_time)
    
    # Get all appointments for the date
    result = await db.execute(
        select(Appointment).where(
            and_(
                Appointment.scheduled_date == target_date,
                Appointment.status.in_([
                    AppointmentStatus.SCHEDULED,
                    AppointmentStatus.CONFIRMED,
                    AppointmentStatus.IN_PROGRESS,
                ]),
            )
        )
    )
    appointments = result.scalars().all()
    
    # Build chair availability map by checking overlap in Python
    occupied_chairs = {}
    for apt in appointments:
        if apt.chair_number and apt.scheduled_time:
            apt_start = datetime.combine(target_date, apt.scheduled_time)
            apt_end = apt_start + timedelta(minutes=apt.duration_mins or 180)
            
            # Check if this appointment overlaps with our time range
            if apt_start < end_datetime and apt_end > start_datetime:
                occupied_chairs[apt.chair_number] = {
                    "patient_id": str(apt.patient_id),  # Convert UUID to string
                    "treatment": apt.appointment_type.value if apt.appointment_type else "unknown",
                    "end_time": apt_end,
                }
    
    # Generate availability for all chairs
    availability = []
    for chair in range(1, TOTAL_CHAIRS + 1):
        if chair in occupied_chairs:
            availability.append(ChairAvailability(
                chair_number=chair,
                is_available=False,
                current_patient_id=occupied_chairs[chair]["patient_id"],
                current_treatment=occupied_chairs[chair]["treatment"],
                available_from=occupied_chairs[chair]["end_time"],
            ))
        else:
            availability.append(ChairAvailability(
                chair_number=chair,
                is_available=True,
            ))
    
    return availability


async def find_next_available_slot(
    db: AsyncSession,
    start_date: date,
    duration_minutes: int = 180,
    preferred_time: Optional[time] = None,
    max_days_ahead: int = 30,
) -> Optional[TimeSlot]:
    """Find the next available time slot for a treatment."""
    
    current_date = start_date
    end_date = start_date + timedelta(days=max_days_ahead)
    
    while current_date <= end_date:
        # Skip weekends (optional - can be configured)
        if current_date.weekday() >= 5:  # Saturday = 5, Sunday = 6
            current_date += timedelta(days=1)
            continue
        
        # Get available slots for this date
        slots = await get_available_slots(db, current_date, duration_minutes)
        
        if slots:
            # If preferred time specified, try to find closest slot
            if preferred_time:
                preferred_datetime = datetime.combine(current_date, preferred_time)
                slots.sort(key=lambda s: abs((s.start_time - preferred_datetime).total_seconds()))
            
            return slots[0]
        
        current_date += timedelta(days=1)
    
    return None


async def get_available_slots(
    db: AsyncSession,
    target_date: date,
    duration_minutes: int = 180,
    slot_interval: int = 30,  # Check slots every 30 minutes
) -> List[TimeSlot]:
    """Get all available time slots for a given date."""
    
    available_slots = []
    
    # Generate time slots throughout the day
    current_time = datetime.combine(target_date, DAYCARE_OPEN_TIME)
    end_of_day = datetime.combine(target_date, DAYCARE_CLOSE_TIME)
    
    while current_time + timedelta(minutes=duration_minutes) <= end_of_day:
        slot_end = current_time + timedelta(minutes=duration_minutes)
        
        # Check chair availability for this slot
        chairs = await get_chair_availability(
            db,
            target_date,
            current_time.time(),
            slot_end.time(),
        )
        
        available_chairs = [c for c in chairs if c.is_available]
        
        if available_chairs:
            available_slots.append(TimeSlot(
                start_time=current_time,
                end_time=slot_end,
                chair_number=available_chairs[0].chair_number,
                is_available=True,
            ))
        
        current_time += timedelta(minutes=slot_interval)
    
    return available_slots


# =============================================================================
# SCHEDULING FUNCTIONS
# =============================================================================

async def schedule_appointment(
    db: AsyncSession,
    patient_id: int,
    appointment_type: AppointmentType,
    preferred_date: date,
    preferred_time: Optional[time] = None,
    duration_minutes: Optional[int] = None,
    notes: Optional[str] = None,
    auto_assign_chair: bool = True,
) -> SchedulingResult:
    """
    Schedule a single appointment.
    
    Args:
        db: Database session
        patient_id: Patient ID
        appointment_type: Type of appointment
        preferred_date: Preferred date
        preferred_time: Preferred time (optional)
        duration_minutes: Duration (uses default if not specified)
        notes: Optional notes
        auto_assign_chair: Whether to auto-assign a chair
    
    Returns:
        SchedulingResult with success status and details
    """
    # Get duration
    if duration_minutes is None:
        duration_minutes = DEFAULT_TREATMENT_DURATIONS.get(
            appointment_type.value, 60
        )
    
    # Find available slot
    slot = await find_next_available_slot(
        db,
        preferred_date,
        duration_minutes,
        preferred_time,
    )
    
    if not slot:
        return SchedulingResult(
            success=False,
            message="No available slots found within the next 30 days",
            conflicts=["All chairs are fully booked"],
        )
    
    # Create appointment
    appointment = Appointment(
        patient_id=patient_id,
        appointment_type=appointment_type,
        scheduled_date=slot.start_time.date(),
        scheduled_time=slot.start_time.time(),
        duration_mins=duration_minutes,
        chair_number=slot.chair_number if auto_assign_chair else None,
        status=AppointmentStatus.SCHEDULED,
        notes=notes,
    )
    
    db.add(appointment)
    await db.commit()
    await db.refresh(appointment)
    
    return SchedulingResult(
        success=True,
        appointment_id=appointment.id,
        scheduled_time=slot.start_time,
        chair_number=slot.chair_number,
        message=f"Appointment scheduled for {slot.start_time.strftime('%B %d, %Y at %I:%M %p')}",
    )


async def schedule_treatment_cycles(
    db: AsyncSession,
    treatment_plan_id: int,
    start_date: date,
    interval_days: int = 21,  # Default 3-week cycle
    num_cycles: int = 6,
) -> TreatmentScheduleResult:
    """
    Schedule all treatment cycles for a treatment plan.
    
    Args:
        db: Database session
        treatment_plan_id: Treatment plan ID
        start_date: Start date for first cycle
        interval_days: Days between cycles
        num_cycles: Number of cycles to schedule
    
    Returns:
        TreatmentScheduleResult with scheduled cycles
    """
    # Get treatment plan
    plan = await db.get(TreatmentPlan, treatment_plan_id)
    if not plan:
        return TreatmentScheduleResult(
            success=False,
            message="Treatment plan not found",
        )
    
    scheduled_cycles = []
    conflicts = []
    current_date = start_date
    
    for cycle_num in range(1, num_cycles + 1):
        # Find slot for this cycle
        slot = await find_next_available_slot(
            db,
            current_date,
            duration_minutes=180,  # Standard chemo duration
        )
        
        if not slot:
            conflicts.append(f"Could not schedule cycle {cycle_num} - no availability")
            current_date += timedelta(days=interval_days)
            continue
        
        # Create treatment cycle
        cycle = TreatmentCycle(
            treatment_plan_id=treatment_plan_id,
            cycle_number=cycle_num,
            scheduled_date=slot.start_time.date(),
            status="scheduled",
        )
        db.add(cycle)
        
        # Create appointment for the cycle
        appointment = Appointment(
            patient_id=plan.patient_id,
            appointment_type=AppointmentType.DAYCARE_CHEMO,
            scheduled_date=slot.start_time.date(),
            scheduled_time=slot.start_time.time(),
            duration_mins=180,
            chair_number=slot.chair_number,
            status=AppointmentStatus.SCHEDULED,
            notes=f"Cycle {cycle_num} of treatment plan #{treatment_plan_id}",
        )
        db.add(appointment)
        
        scheduled_cycles.append({
            "cycle_number": cycle_num,
            "scheduled_date": slot.start_time.date().isoformat(),
            "scheduled_time": slot.start_time.isoformat(),
            "chair_number": slot.chair_number,
        })
        
        # Move to next cycle date
        current_date = slot.start_time.date() + timedelta(days=interval_days)
    
    await db.commit()
    
    return TreatmentScheduleResult(
        success=len(scheduled_cycles) > 0,
        scheduled_cycles=scheduled_cycles,
        conflicts=conflicts,
        message=f"Scheduled {len(scheduled_cycles)} of {num_cycles} cycles",
    )


async def reschedule_appointment(
    db: AsyncSession,
    appointment_id: int,
    new_date: date,
    new_time: Optional[time] = None,
) -> SchedulingResult:
    """
    Reschedule an existing appointment.
    
    Args:
        db: Database session
        appointment_id: Appointment to reschedule
        new_date: New date
        new_time: New time (optional)
    
    Returns:
        SchedulingResult with success status
    """
    # Get appointment
    appointment = await db.get(Appointment, appointment_id)
    if not appointment:
        return SchedulingResult(
            success=False,
            message="Appointment not found",
        )
    
    if appointment.status in [AppointmentStatus.COMPLETED, AppointmentStatus.IN_PROGRESS]:
        return SchedulingResult(
            success=False,
            message="Cannot reschedule completed or in-progress appointments",
        )
    
    # Find new slot
    duration = appointment.duration_mins or 180
    slot = await find_next_available_slot(
        db,
        new_date,
        duration,
        new_time,
    )
    
    if not slot:
        return SchedulingResult(
            success=False,
            message="No available slots on the requested date",
        )
    
    # Update appointment
    old_time = appointment.scheduled_time
    appointment.scheduled_date = slot.start_time.date()
    appointment.scheduled_time = slot.start_time.time()
    appointment.chair_number = slot.chair_number
    appointment.status = AppointmentStatus.RESCHEDULED
    
    await db.commit()
    
    return SchedulingResult(
        success=True,
        appointment_id=appointment.id,
        scheduled_time=slot.start_time,
        chair_number=slot.chair_number,
        message=f"Rescheduled from {old_time.strftime('%B %d')} to {slot.start_time.strftime('%B %d, %Y at %I:%M %p')}",
    )


async def cancel_appointment(
    db: AsyncSession,
    appointment_id: int,
    cancellation_reason: Optional[str] = None,
) -> SchedulingResult:
    """Cancel an appointment."""
    appointment = await db.get(Appointment, appointment_id)
    if not appointment:
        return SchedulingResult(
            success=False,
            message="Appointment not found",
        )
    
    if appointment.status in [AppointmentStatus.COMPLETED, AppointmentStatus.IN_PROGRESS]:
        return SchedulingResult(
            success=False,
            message="Cannot cancel completed or in-progress appointments",
        )
    
    appointment.status = AppointmentStatus.CANCELLED
    if cancellation_reason:
        appointment.notes = f"{appointment.notes or ''}\nCancelled: {cancellation_reason}".strip()
    
    await db.commit()
    
    return SchedulingResult(
        success=True,
        appointment_id=appointment.id,
        message="Appointment cancelled successfully",
    )


# =============================================================================
# DAILY SCHEDULE & REPORTS
# =============================================================================

async def get_daily_schedule(
    db: AsyncSession,
    target_date: date,
) -> DailySchedule:
    """Get the complete daily schedule."""
    
    # Get all appointments for the date
    result = await db.execute(
        select(Appointment).where(
            and_(
                Appointment.scheduled_date == target_date,
                Appointment.status.in_([
                    AppointmentStatus.SCHEDULED,
                    AppointmentStatus.CONFIRMED,
                    AppointmentStatus.IN_PROGRESS,
                ]),
            )
        ).order_by(Appointment.scheduled_time)
    )
    appointments = result.scalars().all()
    
    # Organize by chair
    chair_utilization = {}
    for chair in range(1, TOTAL_CHAIRS + 1):
        chair_utilization[chair] = []
    
    treatment_count = 0
    for apt in appointments:
        if apt.chair_number:
            # Combine date and time for calculations
            start_dt = datetime.combine(apt.scheduled_date, apt.scheduled_time) if apt.scheduled_time else None
            end_dt = start_dt + timedelta(minutes=apt.duration_mins or 180) if start_dt else None
            
            chair_utilization[apt.chair_number].append({
                "appointment_id": apt.id,
                "patient_id": apt.patient_id,
                "start_time": start_dt.isoformat() if start_dt else None,
                "end_time": end_dt.isoformat() if end_dt else None,
                "type": apt.appointment_type.value if apt.appointment_type else "unknown",
                "status": apt.status.value if apt.status else "unknown",
            })
        
        if apt.appointment_type == AppointmentType.DAYCARE_CHEMO:
            treatment_count += 1
    
    # Get available slots
    available_slots = await get_available_slots(db, target_date)
    
    return DailySchedule(
        date=target_date,
        total_appointments=len(appointments),
        total_treatments=treatment_count,
        chair_utilization=chair_utilization,
        available_slots=available_slots[:10],  # Return first 10 slots
    )


async def get_patient_schedule(
    db: AsyncSession,
    patient_id: int,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> List[Dict[str, Any]]:
    """Get all scheduled appointments for a patient."""
    
    query = select(Appointment).where(
        and_(
            Appointment.patient_id == patient_id,
            Appointment.status.in_([
                AppointmentStatus.SCHEDULED,
                AppointmentStatus.CONFIRMED,
                AppointmentStatus.RESCHEDULED,
            ]),
        )
    )
    
    if start_date:
        query = query.where(Appointment.scheduled_date >= start_date)
    if end_date:
        query = query.where(Appointment.scheduled_date <= end_date)
    
    query = query.order_by(Appointment.scheduled_date, Appointment.scheduled_time)
    
    result = await db.execute(query)
    appointments = result.scalars().all()
    
    return [
        {
            "id": apt.id,
            "type": apt.appointment_type.value if apt.appointment_type else "unknown",
            "date": apt.scheduled_date.isoformat() if apt.scheduled_date else None,
            "time": apt.scheduled_time.isoformat() if apt.scheduled_time else None,
            "duration_minutes": apt.duration_mins,
            "chair_number": apt.chair_number,
            "status": apt.status.value if apt.status else "unknown",
            "notes": apt.notes,
        }
        for apt in appointments
    ]


# =============================================================================
# REMINDER SCHEDULING
# =============================================================================

async def schedule_reminders(
    db: AsyncSession,
    appointment: Appointment,
    patient_user_id: int,
) -> List[Notification]:
    """Create reminder notifications for an appointment."""
    
    reminders = []
    
    if not appointment.scheduled_time or not appointment.scheduled_date:
        return reminders
    
    # Combine date and time to get the full datetime
    appointment_datetime = datetime.combine(appointment.scheduled_date, appointment.scheduled_time)
    
    for hours_before in REMINDER_HOURS:
        reminder_time = appointment_datetime - timedelta(hours=hours_before)
        
        # Don't schedule reminders in the past
        if reminder_time <= datetime.utcnow():
            continue
        
        # Format reminder message
        if hours_before >= 24:
            time_text = f"{hours_before // 24} day(s)"
        else:
            time_text = f"{hours_before} hour(s)"
        
        notification = Notification(
            user_id=patient_user_id,
            title="Appointment Reminder",
            body=f"You have an appointment in {time_text}",
            type=NotificationType.APPOINTMENT_REMINDER,
            data={
                "appointment_id": str(appointment.id),
                "appointment_time": appointment_datetime.isoformat(),
            },
        )
        db.add(notification)
        reminders.append(notification)
    
    await db.commit()
    return reminders


async def get_pending_reminders(
    db: AsyncSession,
    before_time: Optional[datetime] = None,
) -> List[Notification]:
    """Get all reminders that need to be sent."""
    
    if before_time is None:
        before_time = datetime.utcnow()
    
    result = await db.execute(
        select(Notification).where(
            and_(
                Notification.type == NotificationType.APPOINTMENT_REMINDER,
                Notification.is_read == False,  # noqa: E712
            )
        )
    )
    
    return list(result.scalars().all())
