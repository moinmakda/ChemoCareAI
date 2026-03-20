"""
Scheduling API

Endpoints for appointment and treatment scheduling:
- View available slots
- Schedule appointments
- Reschedule/cancel appointments
- View patient schedules
- View daily day care schedule
"""
from datetime import date, time, datetime
from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_db, get_current_user, get_current_doctor
from app.models import User, Patient, Appointment, AppointmentType
from app.services.scheduling import (
    get_available_slots,
    get_chair_availability,
    schedule_appointment,
    schedule_treatment_cycles,
    reschedule_appointment,
    cancel_appointment,
    get_daily_schedule,
    get_patient_schedule,
    schedule_reminders,
    SchedulingResult,
    TreatmentScheduleResult,
)

from app.schemas.scheduling import (
    AvailableSlotsRequest,
    ScheduleAppointmentRequest,
    RescheduleRequest,
    CancelRequest,
    ScheduleTreatmentCyclesRequest,
    TimeSlotResponse,
    ChairAvailabilityResponse,
    DailyScheduleResponse,
    DailyScheduleSlot,
    PatientScheduleResponse,
    MyScheduleResponse,
)

router = APIRouter(prefix="/scheduling", tags=["scheduling"])


# =============================================================================
# AVAILABILITY ENDPOINTS
# =============================================================================

@router.get("/available-slots", response_model=List[TimeSlotResponse])
async def get_available_time_slots(
    target_date: date = Query(..., description="Date to check availability"),
    duration_minutes: int = Query(180, description="Required duration in minutes"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get available time slots for a specific date.
    
    Returns a list of available time slots with chair numbers.
    """
    slots = await get_available_slots(db, target_date, duration_minutes)
    
    return [
        TimeSlotResponse(
            start_time=slot.start_time,
            end_time=slot.end_time,
            chair_number=slot.chair_number,
            is_available=slot.is_available,
        )
        for slot in slots
    ]


@router.get("/chair-availability", response_model=List[ChairAvailabilityResponse])
async def get_all_chair_availability(
    target_date: date = Query(..., description="Date to check"),
    start_time: str = Query("08:00", description="Start time (HH:MM)"),
    end_time: str = Query("18:00", description="End time (HH:MM)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get availability of all chairs for a specific time range.
    
    Useful for the day care dashboard to show chair status.
    """
    start = time.fromisoformat(start_time)
    end = time.fromisoformat(end_time)
    
    availability = await get_chair_availability(db, target_date, start, end)
    
    return [
        ChairAvailabilityResponse(
            chair_number=a.chair_number,
            is_available=a.is_available,
            current_patient_id=a.current_patient_id,
            current_treatment=a.current_treatment,
            available_from=a.available_from,
        )
        for a in availability
    ]


# =============================================================================
# APPOINTMENT SCHEDULING
# =============================================================================

@router.post("/appointments", response_model=SchedulingResult)
async def create_appointment(
    request: ScheduleAppointmentRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Schedule a new appointment.
    
    Finds the best available slot based on preferences and automatically
    assigns a chair if auto_assign_chair is True.
    """
    # Verify patient exists
    patient = await db.get(Patient, request.patient_id)
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found",
        )
    
    # Check authorization for patients
    if current_user.role.value == "patient" and patient.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to schedule for this patient",
        )
    
    # Parse appointment type
    try:
        appointment_type = AppointmentType(request.appointment_type)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid appointment type: {request.appointment_type}",
        )
    
    # Parse preferred time
    preferred_time = None
    if request.preferred_time:
        try:
            preferred_time = time.fromisoformat(request.preferred_time)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid time format. Use HH:MM",
            )
    
    result = await schedule_appointment(
        db=db,
        patient_id=request.patient_id,
        appointment_type=appointment_type,
        preferred_date=request.preferred_date,
        preferred_time=preferred_time,
        duration_minutes=request.duration_minutes,
        notes=request.notes,
        auto_assign_chair=request.auto_assign_chair,
    )
    
    # Schedule reminders if successful
    if result.success and result.appointment_id:
        appointment = await db.get(Appointment, result.appointment_id)
        if appointment:
            await schedule_reminders(db, appointment, patient.user_id)
    
    return result


@router.put("/appointments/{appointment_id}/reschedule", response_model=SchedulingResult)
async def reschedule_existing_appointment(
    appointment_id: UUID,
    request: RescheduleRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Reschedule an existing appointment.
    
    Finds a new available slot and updates the appointment.
    """
    # Verify appointment exists and check authorization
    appointment = await db.get(Appointment, appointment_id)
    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Appointment not found",
        )
    
    # Check authorization for patients
    if current_user.role.value == "patient":
        patient = await db.get(Patient, appointment.patient_id)
        if not patient or patient.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to reschedule this appointment",
            )
    
    # Parse new time
    new_time = None
    if request.new_time:
        try:
            new_time = time.fromisoformat(request.new_time)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid time format. Use HH:MM",
            )
    
    result = await reschedule_appointment(
        db=db,
        appointment_id=appointment_id,
        new_date=request.new_date,
        new_time=new_time,
    )
    
    return result


@router.delete("/appointments/{appointment_id}", response_model=SchedulingResult)
async def cancel_existing_appointment(
    appointment_id: UUID,
    reason: Optional[str] = Query(None, description="Cancellation reason"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cancel an appointment."""
    # Verify appointment exists
    appointment = await db.get(Appointment, appointment_id)
    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Appointment not found",
        )
    
    # Check authorization for patients
    if current_user.role.value == "patient":
        patient = await db.get(Patient, appointment.patient_id)
        if not patient or patient.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to cancel this appointment",
            )
    
    result = await cancel_appointment(
        db=db,
        appointment_id=appointment_id,
        cancellation_reason=reason,
    )
    
    return result


# =============================================================================
# TREATMENT CYCLE SCHEDULING
# =============================================================================

@router.post("/treatment-cycles", response_model=TreatmentScheduleResult)
async def schedule_all_treatment_cycles(
    request: ScheduleTreatmentCyclesRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_doctor),
):
    """
    Schedule all treatment cycles for a treatment plan.
    
    Only doctors can schedule treatment cycles.
    """
    result = await schedule_treatment_cycles(
        db=db,
        treatment_plan_id=request.treatment_plan_id,
        start_date=request.start_date,
        interval_days=request.interval_days,
        num_cycles=request.num_cycles,
    )
    
    return result


# =============================================================================
# SCHEDULE VIEWS
# =============================================================================

@router.get("/daily-schedule", response_model=DailyScheduleResponse)
async def get_daily_daycare_schedule(
    target_date: date = Query(..., description="Date to view"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get the complete daily schedule for the day care.
    
    Shows all appointments and chair utilization for the day.
    """
    # Only staff can view full daily schedule
    if current_user.role.value == "patient":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Patients cannot view the full daily schedule",
        )
    
    schedule = await get_daily_schedule(db, target_date)
    
    return DailyScheduleResponse(
        date=schedule.date.isoformat(),
        total_appointments=schedule.total_appointments,
        total_treatments=schedule.total_treatments,
        chair_utilization=schedule.chair_utilization,
        available_slots=[
            DailyScheduleSlot(
                start_time=slot.start_time.isoformat(),
                end_time=slot.end_time.isoformat(),
                chair_number=slot.chair_number,
            )
            for slot in schedule.available_slots
        ],
    )


@router.get("/patient/{patient_id}/schedule", response_model=PatientScheduleResponse)
async def get_patient_appointment_schedule(
    patient_id: UUID,
    start_date: Optional[date] = Query(None, description="Start date filter"),
    end_date: Optional[date] = Query(None, description="End date filter"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get all scheduled appointments for a patient.
    """
    # Check authorization
    patient = await db.get(Patient, patient_id)
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found",
        )
    
    if current_user.role.value == "patient" and patient.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this patient's schedule",
        )
    
    schedule = await get_patient_schedule(db, patient_id, start_date, end_date)

    return PatientScheduleResponse(
        patient_id=patient_id,
        appointments=schedule,
        total=len(schedule),
    )


@router.get("/my-schedule", response_model=MyScheduleResponse)
async def get_my_schedule(
    start_date: Optional[date] = Query(None, description="Start date filter"),
    end_date: Optional[date] = Query(None, description="End date filter"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get the current user's appointment schedule.
    
    For patients, returns their appointments.
    For staff, returns appointments they're involved in.
    """
    if current_user.role.value == "patient":
        # Get patient record
        from sqlalchemy import select
        result = await db.execute(
            select(Patient).where(Patient.user_id == current_user.id)
        )
        patient = result.scalar_one_or_none()
        
        if not patient:
            return MyScheduleResponse(appointments=[], total=0)

        schedule = await get_patient_schedule(db, patient.id, start_date, end_date)
        return MyScheduleResponse(
            appointments=schedule,
            total=len(schedule),
        )
    else:
        # For staff, return their assigned appointments for today or date range
        today = date.today()
        target = start_date or today
        schedule = await get_daily_schedule(db, target)

        return MyScheduleResponse(
            date=target.isoformat(),
            total_appointments=schedule.total_appointments,
            total_treatments=schedule.total_treatments,
            chair_utilization=schedule.chair_utilization,
        )
