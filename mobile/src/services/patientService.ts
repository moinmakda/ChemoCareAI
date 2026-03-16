/**
 * Patient Service - API calls for patient operations
 */
import { apiClient } from './api';
import type { Patient, Document, TreatmentPlan, Vital, SymptomEntry, Appointment } from '../types';

export const patientService = {
  /**
   * Get all patients (staff only)
   */
  async listPatients(params?: { skip?: number; limit?: number; search?: string }): Promise<Patient[]> {
    const response = await apiClient.get('/patients', { params });
    return response.data;
  },

  /**
   * Get current patient profile (for patient users)
   */
  async getMyProfile(): Promise<Patient> {
    const response = await apiClient.get('/patients/me');
    return response.data;
  },

  /**
   * Get patient by ID
   */
  async getPatient(patientId: string): Promise<Patient> {
    const response = await apiClient.get(`/patients/${patientId}`);
    return response.data;
  },

  /**
   * Create a new patient
   * Backend expects snake_case field names.
   */
  async createPatient(data: Partial<Patient>): Promise<Patient> {
    const body = {
      first_name: data.firstName,
      last_name: data.lastName,
      date_of_birth: data.dateOfBirth,
      gender: data.gender,
      blood_group: data.bloodGroup,
      cancer_type: data.cancerType,
      cancer_stage: data.cancerStage,
      diagnosis_date: data.diagnosisDate,
      allergies: data.allergies ?? [],
      comorbidities: data.comorbidities ?? [],
      emergency_contact_name: data.emergencyContactName,
      emergency_contact_phone: data.emergencyContactPhone,
      emergency_contact_relation: data.emergencyContactRelation,
      height_cm: data.heightCm,
      weight_kg: data.weightKg,
    };
    const response = await apiClient.post('/patients', body);
    return response.data;
  },

  /**
   * Update patient profile (staff use - requires patient ID)
   */
  async updatePatient(patientId: string, data: Partial<Patient>): Promise<Patient> {
    const response = await apiClient.put(`/patients/${patientId}`, data);
    return response.data;
  },

  /**
   * Update my profile (patient self-service)
   * Backend expects snake_case field names; only defined fields are sent.
   */
  async updateMyProfile(data: Partial<Patient>): Promise<Patient> {
    const body: Record<string, unknown> = {
      first_name: data.firstName,
      last_name: data.lastName,
      date_of_birth: data.dateOfBirth,
      gender: data.gender,
      blood_group: data.bloodGroup,
      cancer_type: data.cancerType,
      cancer_stage: data.cancerStage,
      diagnosis_date: data.diagnosisDate,
      allergies: data.allergies,
      comorbidities: data.comorbidities,
      emergency_contact_name: data.emergencyContactName,
      emergency_contact_phone: data.emergencyContactPhone,
      emergency_contact_relation: data.emergencyContactRelation,
      height_cm: data.heightCm,
      weight_kg: data.weightKg,
      address: data.address,
      city: data.city,
      state: data.state,
      pincode: data.pincode,
    };
    const response = await apiClient.put('/patients/me', Object.fromEntries(
      Object.entries(body).filter(([, v]) => v !== undefined)
    ));
    return response.data;
  },

  /**
   * Get patient documents
   */
  async getDocuments(patientId: string): Promise<Document[]> {
    const response = await apiClient.get(`/patients/${patientId}/documents`);
    return response.data;
  },

  /**
   * Upload a document
   */
  async uploadDocument(patientId: string, document: FormData): Promise<Document> {
    const response = await apiClient.post(`/patients/${patientId}/documents`, document, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  /**
   * Get patient treatment plans
   */
  async getTreatmentPlans(patientId: string): Promise<TreatmentPlan[]> {
    const response = await apiClient.get('/treatment-plans', { params: { patient_id: patientId } });
    return response.data;
  },

  /**
   * Get my vitals history (patient self-service)
   * Backend resolves patient from JWT — no patient_id needed.
   */
  async getVitals(limit?: number): Promise<Vital[]> {
    const response = await apiClient.get('/vitals', { params: { limit } });
    return response.data;
  },

  /**
   * Get my symptom diary (patient self-service)
   * Backend resolves patient from JWT — no patient_id needed.
   */
  async getSymptomEntries(limit?: number): Promise<SymptomEntry[]> {
    const response = await apiClient.get('/symptoms', { params: { limit } });
    return response.data;
  },

  /**
   * Log my symptoms (patient self-service)
   * Backend resolves patient from JWT — no patient_id needed.
   */
  async logSymptoms(symptoms: Partial<SymptomEntry>): Promise<SymptomEntry> {
    const response = await apiClient.post('/symptoms', symptoms);
    return response.data;
  },

  /**
   * Get my appointments (patient self-service — backend auto-filters by logged-in patient)
   */
  async getAppointments(_patientId: string): Promise<Appointment[]> {
    const response = await apiClient.get('/appointments');
    return response.data;
  },

  /**
   * Get patient dashboard stats
   */
  async getDashboardStats(): Promise<{
    nextAppointment: string | null;
    daysUntilNext: number;
    completedSessions: number;
    upcomingSessions: number;
    lastVitalsDate: string | null;
  }> {
    try {
      const response = await apiClient.get('/dashboard/patient-stats');
      return response.data;
    } catch (error) {
      // Return defaults if endpoint not available
      return {
        nextAppointment: null,
        daysUntilNext: 0,
        completedSessions: 0,
        upcomingSessions: 0,
        lastVitalsDate: null,
      };
    }
  },
};
