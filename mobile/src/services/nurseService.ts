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

// All fields camelCase — api.ts interceptor converts all snake_case responses to camelCase
export interface MedicationAPI {
  id: string;
  cycleId: string;
  drugName: string;
  plannedDose: number;
  actualDose?: number;
  unit: string;
  route: string;
  status: 'pending' | 'prepared' | 'verified' | 'started' | 'completed' | 'paused' | 'cancelled';
  sequenceNumber: number;
  startedAt?: string;
  completedAt?: string;
  administeredById?: string;
  verifiedById?: string;
  notes?: string;
  patientName?: string;
  patientId?: string;
  chairNumber?: string;
  createdAt: string;
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
      const [todayAppts, todayMeds] = await Promise.all([
        doctorService.getTodayAppointments(),
        this.getTodayMedications()
      ]);

      const assignedPatients = todayAppts.filter(
        apt => apt.status === 'checked_in' || apt.status === 'in_progress' || apt.status === 'scheduled'
      ).length;

      const completedToday = todayAppts.filter(apt => apt.status === 'completed').length;

      const pendingMedications = todayMeds.filter(
        med => med.status === 'pending' || med.status === 'prepared' || med.status === 'verified'
      ).length;

      // Patients checked in or in_progress who have no vitals recorded today
      const activeAppts = todayAppts.filter(
        apt => apt.status === 'checked_in' || apt.status === 'in_progress'
      );
      const today = new Date().toISOString().split('T')[0];
      const vitalsChecks = await Promise.all(
        activeAppts.map(apt =>
          doctorService.getPatientVitals(apt.patientId, 5).then(vitals =>
            vitals.some(v => v.recordedAt.startsWith(today)) ? 0 : 1
          ).catch(() => 0)
        )
      );
      const pendingVitals = vitalsChecks.reduce((sum, n) => sum + n, 0);

      return {
        assignedPatients,
        pendingVitals,
        pendingMedications,
        completedToday,
      };
    } catch (error) {
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

  /**
   * Get today's medications for all patients
   */
  async getTodayMedications(): Promise<MedicationAPI[]> {
    try {
      const response = await apiClient.get('/medications/today');
      return response.data;
    } catch (error) {
      return [];
    }
  },

  /**
   * Update medication status
   */
  async updateMedicationStatus(
    medicationId: string,
    status: MedicationAPI['status'],
    actualDose?: number,
    notes?: string
  ): Promise<MedicationAPI> {
    const response = await apiClient.put(`/medications/${medicationId}/status`, {
      status,
      actual_dose: actualDose,
      notes,
    });
    return response.data;
  },

  /**
   * Start a medication administration
   */
  async startMedication(medicationId: string): Promise<MedicationAPI> {
    return this.updateMedicationStatus(medicationId, 'started');
  },

  /**
   * Complete a medication administration
   */
  async completeMedication(medicationId: string, actualDose?: number, notes?: string): Promise<MedicationAPI> {
    return this.updateMedicationStatus(medicationId, 'completed', actualDose, notes);
  },

  /**
   * Pause a medication
   */
  async pauseMedication(medicationId: string, notes?: string): Promise<MedicationAPI> {
    return this.updateMedicationStatus(medicationId, 'paused', undefined, notes);
  },
};

export type { PatientSummaryAPI, AppointmentAPI, VitalAPI };
