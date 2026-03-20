/**
 * Doctor Service - API calls for doctor-specific functionality
 */
import { apiClient } from './api';
import type { Patient, Vital, Appointment, SymptomEntry } from '../types';

// API response types (now converted to camelCase by API interceptor)
export interface PatientSummaryAPI {
  id: string;
  firstName: string;
  lastName: string;
  cancerType?: string;
  cancerStage?: string;
  profilePhotoUrl?: string;
}

export interface PatientDetailAPI {
  id: string;
  userId?: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  bloodGroup?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  heightCm?: number;
  weightKg?: number;
  bsa: number;
  age: number;
  allergies: string[];
  comorbidities: string[];
  currentMedications: any[];
  cancerType?: string;
  cancerStage?: string;
  diagnosisDate?: string;
  histopathologyDetails?: string;
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  insuranceValidity?: string;
  profilePhotoUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VitalAPI {
  id: string;
  patientId: string;
  cycleId?: string;
  temperatureF?: number;
  pulseBpm?: number;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  weightKg?: number;
  painScore?: number;
  notes?: string;
  recordedBy?: string;
  recordedAt: string;
  createdAt: string;
}

export interface AppointmentAPI {
  id: string;
  patientId: string;
  appointmentType: string;
  scheduledDate: string;
  scheduledTime: string;
  durationMins: number;
  cycleId?: string;
  chairNumber?: number;
  doctorId?: string;
  nurseId?: string;
  status: string;
  checkedInAt?: string;
  checkedOutAt?: string;
  notes?: string;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  totalPatients: number;
  todayAppointments: number;
  activeTreatments: number;
  pendingAlerts: number;
}

export const doctorService = {
  /**
   * Get all patients (for staff)
   */
  async getPatients(params?: { search?: string; skip?: number; limit?: number }): Promise<PatientSummaryAPI[]> {
    const response = await apiClient.get('/patients', { params });
    return response.data;
  },

  /**
   * Get patient details by ID
   */
  async getPatientById(patientId: string): Promise<PatientDetailAPI> {
    const response = await apiClient.get(`/patients/${patientId}`);
    return response.data;
  },

  /**
   * Get patient vitals
   */
  async getPatientVitals(patientId: string, limit = 20): Promise<VitalAPI[]> {
    const response = await apiClient.get('/vitals', {
      params: { patient_id: patientId, limit }
    });
    return response.data;
  },

  /**
   * Get today's appointments
   */
  async getTodayAppointments(): Promise<AppointmentAPI[]> {
    const d = new Date();
    // Create 'YYYY-MM-DD' in local timezone
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const response = await apiClient.get('/appointments', {
      params: { scheduled_date: today }
    });
    return response.data;
  },

  /**
   * Get all appointments
   */
  async getAppointments(params?: {
    patient_id?: string;
    scheduled_date?: string;
    status?: string;
  }): Promise<AppointmentAPI[]> {
    const response = await apiClient.get('/appointments', { params });
    return response.data;
  },

  /**
   * Get active (in-progress) appointments for day care
   */
  async getActiveAppointments(): Promise<AppointmentAPI[]> {
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const response = await apiClient.get('/appointments', {
      params: { scheduled_date: today }
    });
    // Filter for active statuses
    const activeStatuses = ['checked_in', 'in_progress', 'scheduled', 'confirmed'];
    return response.data.filter((apt: AppointmentAPI) => activeStatuses.includes(apt.status));
  },

  /**
   * Get active treatments - combines appointments and today's treatment cycles
   */
  async getActiveTreatments(): Promise<AppointmentAPI[]> {
    // Get today's appointments (which should be linked to cycles)
    const appointments = await this.getActiveAppointments();
    return appointments;
  },

  /**
   * Update appointment status
   */
  async updateAppointmentStatus(appointmentId: string, status: string, notes?: string): Promise<AppointmentAPI> {
    const response = await apiClient.put(`/appointments/${appointmentId}`, { status, notes });
    return response.data;
  },

  /**
   * Check in a patient for their appointment
   */
  async checkInPatient(appointmentId: string): Promise<AppointmentAPI> {
    const response = await apiClient.post(`/appointments/${appointmentId}/checkin`);
    return response.data;
  },

  /**
   * Check out a patient from their appointment
   */
  async checkOutPatient(appointmentId: string): Promise<AppointmentAPI> {
    const response = await apiClient.post(`/appointments/${appointmentId}/checkout`);
    return response.data;
  },

  /**
   * Get patient symptoms
   */
  async getPatientSymptoms(patientId: string, limit = 20): Promise<any[]> {
    const response = await apiClient.get('/symptoms', {
      params: { patient_id: patientId, limit }
    });
    return response.data;
  },

  /**
   * Record vitals for a patient
   */
  async recordVitals(patientId: string, vitals: {
    temperature_f?: number;
    pulse_bpm?: number;
    blood_pressure_systolic?: number;
    blood_pressure_diastolic?: number;
    respiratory_rate?: number;
    oxygen_saturation?: number;
    weight_kg?: number;
    pain_score?: number;
    notes?: string;
  }): Promise<VitalAPI> {
    const response = await apiClient.post('/vitals', {
      patient_id: patientId,
      ...vitals,
    });
    return response.data;
  },

  /**
   * Get dashboard statistics
   */
  async getDashboardStats(): Promise<DashboardStats> {
    try {
      const response = await apiClient.get('/dashboard/stats');
      return {
        totalPatients: response.data.totalPatients,
        todayAppointments: response.data.todayAppointments,
        activeTreatments: response.data.activeTreatments,
        pendingAlerts: response.data.pendingAlerts,
      };
    } catch (error) {
      // Fallback to client-side calculation if endpoint fails
      try {
        const [patients, todayAppts] = await Promise.all([
          this.getPatients({ limit: 1000 }),
          this.getTodayAppointments(),
        ]);

        const activeTreatments = todayAppts.filter(
          apt => apt.status === 'in_progress' || apt.status === 'checked_in'
        ).length;

        return {
          totalPatients: patients.length,
          todayAppointments: todayAppts.length,
          activeTreatments,
          pendingAlerts: 0,
        };
      } catch {
        return {
          totalPatients: 0,
          todayAppointments: 0,
          activeTreatments: 0,
          pendingAlerts: 0,
        };
      }
    }
  },

  /**
   * Get treatment plans (all or for specific patient)
   */
  async getTreatmentPlans(patientId?: string): Promise<any[]> {
    const params = patientId ? { patient_id: patientId } : {};
    const response = await apiClient.get('/treatment-plans', { params });
    return response.data;
  },

  /**
   * Get patient alerts (symptom/vital alerts for medical staff)
   */
  async getPatientAlerts(limit: number = 20): Promise<any[]> {
    const response = await apiClient.get('/patient-alerts', { params: { limit } });
    return response.data;
  },

  // Feature 8: Clinical Notes
  async createNote(data: { patientId: string; content: string; noteType?: string; isPrivate?: boolean; cycleId?: string }): Promise<any> {
    const response = await apiClient.post('/clinical-notes', {
      patient_id: data.patientId,
      content: data.content,
      note_type: data.noteType || 'clinical',
      is_private: data.isPrivate || false,
      cycle_id: data.cycleId,
    });
    return response.data;
  },

  async getNotes(patientId: string, cycleId?: string): Promise<any[]> {
    const params: any = { patient_id: patientId };
    if (cycleId) params.cycle_id = cycleId;
    const response = await apiClient.get('/clinical-notes', { params });
    return response.data;
  },

  async updateNote(noteId: string, data: { content?: string; noteType?: string; isPrivate?: boolean }): Promise<any> {
    const response = await apiClient.put(`/clinical-notes/${noteId}`, {
      content: data.content,
      note_type: data.noteType,
      is_private: data.isPrivate,
    });
    return response.data;
  },

  async deleteNote(noteId: string): Promise<void> {
    await apiClient.delete(`/clinical-notes/${noteId}`);
  },
};
