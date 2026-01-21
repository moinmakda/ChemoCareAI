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
   */
  async createPatient(data: Partial<Patient>): Promise<Patient> {
    const response = await apiClient.post('/patients', data);
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
    const response = await apiClient.get(`/patients/${patientId}/treatments`);
    return response.data;
  },

  /**
   * Get patient vitals history
   */
  async getVitals(patientId: string, limit?: number): Promise<Vital[]> {
    const response = await apiClient.get(`/vitals/${patientId}`, { params: { limit } });
    return response.data;
  },

  /**
   * Get patient symptom diary
   */
  async getSymptomEntries(patientId: string, limit?: number): Promise<SymptomEntry[]> {
    const response = await apiClient.get(`/patients/${patientId}/symptoms`, { params: { limit } });
    return response.data;
  },

  /**
   * Log symptoms
   */
  async logSymptoms(patientId: string, symptoms: Partial<SymptomEntry>): Promise<SymptomEntry> {
    const response = await apiClient.post(`/patients/${patientId}/symptoms`, symptoms);
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
