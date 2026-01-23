/**
 * Nurse Service - API calls for nurse-specific functionality
 * Reuses doctorService for shared endpoints
 */
import { apiClient } from './api';
import { doctorService, type PatientSummaryAPI, type AppointmentAPI, type VitalAPI } from './doctorService';

export interface NurseTaskType {
  id: string;
  type: 'vitals' | 'medication' | 'documentation' | 'preparation';
  title: string;
  patientId?: string;
  patientName?: string;
  priority: 'high' | 'medium' | 'low';
  dueTime: string;
  completed: boolean;
}

export interface NurseDashboardStats {
  assignedPatients: number;
  pendingVitals: number;
  pendingMedications: number;
  completedToday: number;
}

export const nurseService = {
  /**
   * Get all patients (staff can view all)
   */
  getPatients: doctorService.getPatients,

  /**
   * Get patient details by ID
   */
  getPatientById: doctorService.getPatientById,

  /**
   * Get patient vitals
   */
  getPatientVitals: doctorService.getPatientVitals,

  /**
   * Get today's appointments
   */
  getTodayAppointments: doctorService.getTodayAppointments,

  /**
   * Get appointments with filters
   */
  getAppointments: doctorService.getAppointments,

  /**
   * Record vitals for a patient
   */
  recordVitals: doctorService.recordVitals,

  /**
   * Check in a patient
   */
  checkInPatient: doctorService.checkInPatient,

  /**
   * Check out a patient
   */
  checkOutPatient: doctorService.checkOutPatient,

  /**
   * Get nurse dashboard stats
   */
  async getDashboardStats(): Promise<NurseDashboardStats> {
    try {
      const todayAppts = await doctorService.getTodayAppointments();
      
      const assignedPatients = todayAppts.filter(
        apt => apt.status === 'checked_in' || apt.status === 'in_progress' || apt.status === 'scheduled'
      ).length;
      
      const completedToday = todayAppts.filter(apt => apt.status === 'completed').length;
      
      return {
        assignedPatients,
        pendingVitals: 0, // TODO: implement vitals tracking
        pendingMedications: 0, // TODO: implement medication tracking
        completedToday,
      };
    } catch (error) {
      console.error('Error fetching nurse stats:', error);
      return {
        assignedPatients: 0,
        pendingVitals: 0,
        pendingMedications: 0,
        completedToday: 0,
      };
    }
  },

  /**
   * Get active patients currently in treatment
   */
  async getActivePatients(): Promise<AppointmentAPI[]> {
    const todayAppts = await doctorService.getTodayAppointments();
    return todayAppts.filter(
      apt => apt.status === 'checked_in' || apt.status === 'in_progress'
    );
  },

  /**
   * Get patients awaiting check-in
   */
  async getAwaitingPatients(): Promise<AppointmentAPI[]> {
    const todayAppts = await doctorService.getTodayAppointments();
    return todayAppts.filter(
      apt => apt.status === 'scheduled' || apt.status === 'confirmed'
    );
  },

  /**
   * Update appointment status
   */
  async updateAppointmentStatus(appointmentId: string, status: string): Promise<AppointmentAPI> {
    const response = await apiClient.put(`/appointments/${appointmentId}`, { status });
    return response.data;
  },
};

export type { PatientSummaryAPI, AppointmentAPI, VitalAPI };
