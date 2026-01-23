/**
 * Vitals Service - API calls for patient vital signs
 */
import { apiClient } from './api';
import type { Vital } from '../types';

export interface VitalCreate {
  patient_id: string;
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
  timing?: string;
}

export interface PatientVitalCreate {
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
   * Get vitals history for a patient (staff use)
   */
  async getPatientVitals(patientId: string, limit: number = 20): Promise<Vital[]> {
    const response = await apiClient.get(`/vitals/${patientId}`, { params: { limit } });
    return response.data;
  },

  /**
   * Get vitals for a specific treatment cycle
   */
  async getCycleVitals(cycleId: string): Promise<Vital[]> {
    const response = await apiClient.get(`/vitals/cycle/${cycleId}`);
    return response.data;
  },

  /**
   * Record new vitals (nurses only)
   */
  async recordVitals(vitals: VitalCreate): Promise<Vital> {
    const response = await apiClient.post('/vitals/', vitals);
    return response.data;
  },

  /**
   * Get latest vitals for a patient
   */
  async getLatestVitals(patientId: string): Promise<Vital | null> {
    const vitals = await this.getPatientVitals(patientId, 1);
    return vitals.length > 0 ? vitals[0] : null;
  },

  // ============ Patient Self-Service Endpoints ============

  /**
   * Get my vitals history (for logged-in patient)
   */
  async getMyVitals(limit: number = 20): Promise<Vital[]> {
    const response = await apiClient.get('/vitals/me', { params: { limit } });
    return response.data;
  },

  /**
   * Log my own vitals (patient self-logging)
   */
  async logMyVitals(vitals: PatientVitalCreate): Promise<Vital> {
    const response = await apiClient.post('/vitals/me', vitals);
    return response.data;
  },

  /**
   * Get my latest vitals (for logged-in patient)
   */
  async getMyLatestVitals(): Promise<Vital | null> {
    const vitals = await this.getMyVitals(1);
    return vitals.length > 0 ? vitals[0] : null;
  },
};
