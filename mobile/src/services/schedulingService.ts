/**
 * Scheduling Service
 * 
 * Handles appointment scheduling, rescheduling, cancellation,
 * and viewing schedules.
 */
import { apiClient } from './api';

// Types
export interface TimeSlot {
  startTime: string;
  endTime: string;
  chairNumber?: number;
  isAvailable: boolean;
}

export interface ChairAvailability {
  chairNumber: number;
  isAvailable: boolean;
  currentPatientId?: number;
  currentTreatment?: string;
  availableFrom?: string;
}

export interface SchedulingResult {
  success: boolean;
  appointmentId?: number;
  scheduledTime?: string;
  chairNumber?: number;
  conflicts: string[];
  message: string;
}

export interface TreatmentScheduleResult {
  success: boolean;
  scheduledCycles: Array<{
    cycleNumber: number;
    scheduledDate: string;
    scheduledTime: string;
    chairNumber?: number;
  }>;
  conflicts: string[];
  message: string;
}

export interface DailySchedule {
  date: string;
  totalAppointments: number;
  totalTreatments: number;
  chairUtilization: Record<number, Array<{
    appointmentId: string;
    patientId: string;
    startTime: string;
    endTime: string;
    type: string;
    status: string;
  }>>;
  availableSlots: TimeSlot[];
}

export interface PatientAppointment {
  id: string;
  type: string;
  date: string;
  time: string;
  durationMinutes?: number;
  chairNumber?: number;
  status: string;
  notes?: string;
}

// API Functions

/**
 * Get available time slots for a specific date
 */
export const getAvailableSlots = async (
  targetDate: string,
  durationMinutes: number = 180
): Promise<TimeSlot[]> => {
  const response = await apiClient.get('/scheduling/available-slots', {
    params: {
      target_date: targetDate,
      duration_minutes: durationMinutes,
    },
  });
  return response.data;
};

/**
 * Get chair availability for a time range
 */
export const getChairAvailability = async (
  targetDate: string,
  startTime: string = '08:00',
  endTime: string = '18:00'
): Promise<ChairAvailability[]> => {
  const response = await apiClient.get('/scheduling/chair-availability', {
    params: {
      target_date: targetDate,
      start_time: startTime,
      end_time: endTime,
    },
  });
  return response.data;
};

/**
 * Schedule a new appointment
 */
export const scheduleAppointment = async (data: {
  patientId: number;
  appointmentType: 'treatment' | 'consultation' | 'follow_up' | 'lab';
  preferredDate: string;
  preferredTime?: string;
  durationMinutes?: number;
  notes?: string;
  autoAssignChair?: boolean;
}): Promise<SchedulingResult> => {
  const response = await apiClient.post('/scheduling/appointments', {
    patient_id: data.patientId,
    appointment_type: data.appointmentType,
    preferred_date: data.preferredDate,
    preferred_time: data.preferredTime,
    duration_minutes: data.durationMinutes,
    notes: data.notes,
    auto_assign_chair: data.autoAssignChair ?? true,
  });
  return response.data;
};

/**
 * Reschedule an existing appointment
 */
export const rescheduleAppointment = async (
  appointmentId: string,
  newDate: string,
  newTime?: string
): Promise<SchedulingResult> => {
  const response = await apiClient.put(`/scheduling/appointments/${appointmentId}/reschedule`, {
    new_date: newDate,
    new_time: newTime,
  });
  return response.data;
};

/**
 * Cancel an appointment
 */
export const cancelAppointment = async (
  appointmentId: string,
  reason?: string
): Promise<SchedulingResult> => {
  const response = await apiClient.delete(`/scheduling/appointments/${appointmentId}`, {
    params: { reason },
  });
  return response.data;
};

/**
 * Schedule treatment cycles for a treatment plan
 */
export const scheduleTreatmentCycles = async (data: {
  treatmentPlanId: number;
  startDate: string;
  intervalDays?: number;
  numCycles?: number;
}): Promise<TreatmentScheduleResult> => {
  const response = await apiClient.post('/scheduling/treatment-cycles', {
    treatment_plan_id: data.treatmentPlanId,
    start_date: data.startDate,
    interval_days: data.intervalDays ?? 21,
    num_cycles: data.numCycles ?? 6,
  });
  return response.data;
};

/**
 * Get daily schedule for the day care
 */
export const getDailySchedule = async (targetDate: string): Promise<DailySchedule> => {
  const response = await apiClient.get('/scheduling/daily-schedule', {
    params: { target_date: targetDate },
  });
  return response.data;
};

/**
 * Get schedule for a specific patient
 */
export const getPatientSchedule = async (
  patientId: number,
  startDate?: string,
  endDate?: string
): Promise<{ patientId: number; appointments: PatientAppointment[]; total: number }> => {
  const response = await apiClient.get(`/scheduling/patient/${patientId}/schedule`, {
    params: {
      start_date: startDate,
      end_date: endDate,
    },
  });
  return response.data;
};

/**
 * Get the current user's schedule
 */
export const getMySchedule = async (
  startDate?: string,
  endDate?: string
): Promise<{
  appointments?: PatientAppointment[];
  total?: number;
  date?: string;
  totalAppointments?: number;
  totalTreatments?: number;
}> => {
  const response = await apiClient.get('/scheduling/my-schedule', {
    params: {
      start_date: startDate,
      end_date: endDate,
    },
  });
  return response.data;
};
