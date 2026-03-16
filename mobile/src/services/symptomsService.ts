/**
 * Symptoms Service - API calls for symptom tracking
 *
 * Single unified endpoint: POST /symptoms and GET /symptoms
 * Backend is role-aware: patients auto-get their own data, staff supply patient_id.
 */
import { apiClient } from './api';
import type { SymptomEntry } from '../types';

/**
 * Fields sent to backend (snake_case — backend Pydantic models use snake_case).
 * patient_id is omitted when a patient logs their own symptoms.
 */
export interface SymptomCreate {
  patient_id?: string;
  cycle_id?: string;
  nausea_score?: number;
  vomiting_count?: number;
  fatigue_score?: number;
  appetite_score?: number;
  pain_score?: number;
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
   * Get symptom history.
   * - Patient: omit patientId — backend resolves from JWT token.
   * - Staff: pass patientId to filter by patient.
   */
  async getSymptoms(patientId?: string, limit = 20): Promise<SymptomEntry[]> {
    const params: Record<string, unknown> = { limit };
    if (patientId) params.patient_id = patientId;
    const response = await apiClient.get('/symptoms', { params });
    return response.data;
  },

  /**
   * Log symptoms.
   * - Patient: omit patient_id in data — backend resolves from JWT token.
   * - Staff: include patient_id in data.
   */
  async logSymptoms(data: SymptomCreate): Promise<SymptomEntry> {
    const response = await apiClient.post('/symptoms', data);
    return response.data;
  },

  /**
   * Get the single most recent symptom entry.
   * - Patient: omit patientId.
   * - Staff: pass patientId.
   */
  async getLatestSymptom(patientId?: string): Promise<SymptomEntry | null> {
    const symptoms = await this.getSymptoms(patientId, 1);
    return symptoms.length > 0 ? symptoms[0] : null;
  },
};
