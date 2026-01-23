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
    const response = await apiClient.get('/patients/', { params });
    return response.data;
  },

  /**
   * Get current patient profile (for patient users)
   */
  async getMyProfile(): Promise<Patient> {
    const response = await apiClient.get('/patients/me/');
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
   */
  async createPatient(data: Partial<Patient>): Promise<Patient> {
    // Convert camelCase to snake_case for API
    const apiData = {
      first_name: data.firstName,
      last_name: data.lastName,
      date_of_birth: data.dateOfBirth,
      gender: data.gender,
      blood_group: data.bloodGroup,
      cancer_type: data.cancerType,
      cancer_stage: data.cancerStage,
      diagnosis_date: data.diagnosisDate,
      allergies: data.allergies || [],
      comorbidities: data.comorbidities || [],
      emergency_contact_name: data.emergencyContactName,
      emergency_contact_phone: data.emergencyContactPhone,
      emergency_contact_relation: data.emergencyContactRelation,
      height_cm: data.heightCm,
      weight_kg: data.weightKg,
    };
    const response = await apiClient.post('/patients/', apiData);
    return response.data;
  },

  /**
   * Update patient profile
   */
  async updatePatient(patientId: string, data: Partial<Patient>): Promise<Patient> {
    const response = await apiClient.put(`/patients/${patientId}`, data);
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
    const response = await apiClient.get(`/treatment-plans/`, { params: { patient_id: patientId } });
    return response.data;
  },

  /**
   * Get patient vitals history
   */
  async getVitals(patientId: string, limit?: number): Promise<Vital[]> {
    const response = await apiClient.get(`/vitals/`, { params: { patient_id: patientId, limit } });
    return response.data;
  },

  /**
   * Get patient symptom diary
   */
  async getSymptomEntries(patientId: string, limit?: number): Promise<SymptomEntry[]> {
    const response = await apiClient.get(`/symptoms/`, { params: { patient_id: patientId, limit } });
    return response.data;
  },

  /**
   * Log symptoms
   */
  async logSymptoms(patientId: string, symptoms: Partial<SymptomEntry>): Promise<SymptomEntry> {
    const response = await apiClient.post(`/symptoms/`, { ...symptoms, patient_id: patientId });
    return response.data;
  },

  /**
   * Get patient appointments
   */
  async getAppointments(patientId: string): Promise<Appointment[]> {
    const response = await apiClient.get('/appointments', { params: { patient_id: patientId } });
    return response.data;
  },
};
