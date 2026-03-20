/**
 * Medication Adherence Service - Take-home medication tracking
 */
import { apiClient } from './api';

export interface TakeHomeMedication {
  id: string;
  cycleId?: string;
  patientId: string;
  drugName: string;
  dose?: string;
  unit?: string;
  route?: string;
  frequency?: string;
  startDate?: string;
  endDate?: string;
  instructions?: string;
  isActive: boolean;
  createdAt: string;
}

export interface MedicationLog {
  id: string;
  medicationId: string;
  patientId: string;
  scheduledDate?: string;
  scheduledTime?: string;
  takenAt?: string;
  skipped: boolean;
  skipReason?: string;
  notes?: string;
  createdAt: string;
}

export interface AdherenceSummary {
  totalDoses: number;
  taken: number;
  skipped: number;
  missed: number;
  adherenceRate: number;
  medications: TakeHomeMedication[];
}

export const medicationAdherenceService = {
  async getMyMedications(activeOnly = true): Promise<TakeHomeMedication[]> {
    const response = await apiClient.get('/my-medications', { params: { active_only: activeOnly } });
    return response.data;
  },

  async logMedication(medId: string, data: { takenAt?: string; skipped?: boolean; skipReason?: string; notes?: string }): Promise<MedicationLog> {
    const response = await apiClient.post(`/my-medications/${medId}/log`, {
      taken_at: data.takenAt,
      skipped: data.skipped || false,
      skip_reason: data.skipReason,
      notes: data.notes,
    });
    return response.data;
  },

  async getAdherence(): Promise<AdherenceSummary> {
    const response = await apiClient.get('/my-medications/adherence');
    return response.data;
  },
};
