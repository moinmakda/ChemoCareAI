/**
 * Vitals Service - API calls for patient vital signs
 *
 * Single unified endpoint: POST /vitals and GET /vitals
 * Backend is role-aware: patients auto-get their own data, staff supply patient_id.
 */
import { apiClient } from './api';
import type { Vital } from '../types';

/**
 * Fields sent to backend (snake_case — backend Pydantic models use snake_case).
 * patient_id is omitted when a patient logs their own vitals (backend resolves from JWT).
 */
export interface VitalCreate {
  patient_id?: string;
  cycle_id?: string;
  temperature_f?: number;
  pulse_bpm?: number;
  blood_pressure_systolic?: number;
  blood_pressure_diastolic?: number;
  respiratory_rate?: number;
  oxygen_saturation?: number;
  pain_score?: number;
  pain_location?: string;
  blood_sugar?: number;
  weight_kg?: number;
  notes?: string;
}

export const vitalsService = {
  /**
   * Get vitals history.
   * - Patient: omit patientId — backend resolves from JWT token.
   * - Staff: pass patientId to filter by patient.
   */
  async getVitals(patientId?: string, limit = 20): Promise<Vital[]> {
    const params: Record<string, unknown> = { limit };
    if (patientId) params.patient_id = patientId;
    const response = await apiClient.get('/vitals', { params });
    return response.data;
  },

  /**
   * Record vitals.
   * - Patient: omit patient_id in data — backend resolves from JWT token.
   * - Staff: include patient_id in data.
   */
  async logVitals(vitals: VitalCreate): Promise<Vital> {
    const response = await apiClient.post('/vitals', vitals);
    return response.data;
  },

  /**
   * Get the single most recent vital record.
   * - Patient: omit patientId.
   * - Staff: pass patientId.
   */
  async getLatestVital(patientId?: string): Promise<Vital | null> {
    const vitals = await this.getVitals(patientId, 1);
    return vitals.length > 0 ? vitals[0] : null;
  },
};
