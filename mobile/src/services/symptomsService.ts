/**
 * Symptoms Service - API calls for symptom tracking
 */
import { apiClient } from './api';
import type { SymptomEntry } from '../types';

export interface SymptomCreate {
  patient_id?: string;
  cycle_id?: string;
  nausea_score?: number; // 0-10
  vomiting_count?: number;
  fatigue_score?: number; // 0-10
  appetite_score?: number; // 0-10
  pain_score?: number; // 0-10
  has_fever?: boolean;
  has_mouth_sores?: boolean;
  has_diarrhea?: boolean;
  has_constipation?: boolean;
  has_numbness?: boolean;
  has_hair_loss?: boolean;
  has_skin_changes?: boolean;
  other_symptoms?: string;
  mood_notes?: string;
}

export const symptomsService = {
  /**
   * Get symptom history for a patient (staff use)
   */
  async getPatientSymptoms(patientId: string, limit: number = 20): Promise<SymptomEntry[]> {
    const response = await apiClient.get(`/symptoms/${patientId}`, { params: { limit } });
    return response.data;
  },

  /**
   * Log new symptoms (staff use)
   */
  async logSymptoms(data: SymptomCreate): Promise<SymptomEntry> {
    const response = await apiClient.post('/symptoms/', data);
    return response.data;
  },

  /**
   * Get symptoms for a specific cycle
   */
  async getCycleSymptoms(cycleId: string): Promise<SymptomEntry[]> {
    const response = await apiClient.get(`/symptoms/cycle/${cycleId}`);
    return response.data;
  },

  /**
   * Get latest symptom entry for a patient
   */
  async getLatestSymptoms(patientId: string): Promise<SymptomEntry | null> {
    const symptoms = await this.getPatientSymptoms(patientId, 1);
    return symptoms.length > 0 ? symptoms[0] : null;
  },

  // ============ Patient Self-Service Endpoints ============

  /**
   * Get my symptom history (for logged-in patient)
   */
  async getMySymptoms(limit: number = 20): Promise<SymptomEntry[]> {
    const response = await apiClient.get('/symptoms/me', { params: { limit } });
    return response.data;
  },

  /**
   * Log my symptoms (patient self-logging)
   */
  async logMySymptoms(data: Partial<SymptomCreate>): Promise<SymptomEntry> {
    const response = await apiClient.post('/symptoms/me', data);
    return response.data;
  },
};
