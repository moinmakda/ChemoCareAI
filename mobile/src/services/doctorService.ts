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
    const response = await apiClient.get('/patients/', { params });
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
  async getPatientVitals(patientId: string, days?: number): Promise<VitalAPI[]> {
    const response = await apiClient.get('/vitals/', { 
      params: { patient_id: patientId, days }
    });
    return response.data;
  },

  /**
   * Get today's appointments
   */
  async getTodayAppointments(): Promise<AppointmentAPI[]> {
    const today = new Date().toISOString().split('T')[0];
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
    const today = new Date().toISOString().split('T')[0];
    const response = await apiClient.get('/appointments', {
      params: { scheduled_date: today }
    });
    // Filter for active statuses
    const activeStatuses = ['checked_in', 'in_progress', 'scheduled', 'confirmed'];
    return response.data.filter((apt: AppointmentAPI) => activeStatuses.includes(apt.status));
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
  async getPatientSymptoms(patientId: string, limit?: number): Promise<any[]> {
    const response = await apiClient.get('/symptoms/', {
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
    const response = await apiClient.post('/vitals/', {
      patient_id: patientId,
      ...vitals
    });
    return response.data;
  },

  /**
   * Get dashboard statistics
   */
  async getDashboardStats(): Promise<DashboardStats> {
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
        pendingAlerts: 0, // TODO: implement alerts API
      };
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      return {
        totalPatients: 0,
        todayAppointments: 0,
        activeTreatments: 0,
        pendingAlerts: 0,
      };
    }
  },
};
