/**
 * Lab Results Service
 */
import { apiClient } from './api';

export interface LabResult {
  id: string;
  patientId: string;
  title: string;
  labDate?: string;
  parameters: Record<string, any>;
  source: string;
  createdAt: string;
}

export interface LabTrendPoint {
  date: string;
  value: number;
  source: string;
}

export interface LabTrend {
  parameter: string;
  unit?: string;
  points: LabTrendPoint[];
}

export const labService = {
  async listLabs(patientId?: string, limit = 50): Promise<LabResult[]> {
    const params: any = { limit };
    if (patientId) params.patient_id = patientId;
    const response = await apiClient.get('/labs', { params });
    return response.data;
  },

  async getTrends(parameter: string, patientId?: string): Promise<LabTrend> {
    const params: any = { parameter };
    if (patientId) params.patient_id = patientId;
    const response = await apiClient.get('/labs/trends', { params });
    return response.data;
  },
};
