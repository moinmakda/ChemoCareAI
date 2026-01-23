/**
 * Treatment Service - API calls for protocols and treatment plans
 */
import { apiClient } from './api';
import type { 
  ProtocolTemplate, 
  TreatmentPlan, 
  TreatmentCycle, 
  DrugAdministration 
} from '../types';

export const treatmentService = {
  // Protocol Templates
  async listProtocols(cancerType?: string): Promise<ProtocolTemplate[]> {
    const response = await apiClient.get('/protocols/', { params: { cancer_type: cancerType } });
    return response.data;
  },

  async getProtocol(protocolId: string): Promise<ProtocolTemplate> {
    const response = await apiClient.get(`/protocols/${protocolId}`);
    return response.data;
  },

  // Treatment Plans
  async createTreatmentPlan(data: Partial<TreatmentPlan>): Promise<TreatmentPlan> {
    const response = await apiClient.post('/treatment-plans', data);
    return response.data;
  },

  async getTreatmentPlan(planId: string): Promise<TreatmentPlan> {
    const response = await apiClient.get(`/treatment-plans/${planId}`);
    return response.data;
  },

  async updateTreatmentPlan(planId: string, data: Partial<TreatmentPlan>): Promise<TreatmentPlan> {
    const response = await apiClient.put(`/treatment-plans/${planId}`, data);
    return response.data;
  },

  async approveOPD(planId: string, notes?: string): Promise<TreatmentPlan> {
    const response = await apiClient.post(`/treatment-plans/${planId}/approve-opd`, null, {
      params: { notes },
    });
    return response.data;
  },

  async approveDaycare(planId: string, notes?: string): Promise<TreatmentPlan> {
    const response = await apiClient.post(`/treatment-plans/${planId}/approve-daycare`, null, {
      params: { notes },
    });
    return response.data;
  },

  // Treatment Cycles
  async getCycles(planId: string): Promise<TreatmentCycle[]> {
    const response = await apiClient.get(`/treatment-plans/${planId}/cycles`);
    return response.data;
  },

  async createCycle(planId: string, data: Partial<TreatmentCycle>): Promise<TreatmentCycle> {
    const response = await apiClient.post(`/treatment-plans/${planId}/cycles`, data);
    return response.data;
  },

  async getCycle(cycleId: string): Promise<TreatmentCycle> {
    const response = await apiClient.get(`/cycles/${cycleId}`);
    return response.data;
  },

  async updateCycle(cycleId: string, data: Partial<TreatmentCycle>): Promise<TreatmentCycle> {
    const response = await apiClient.put(`/cycles/${cycleId}`, data);
    return response.data;
  },

  async approveCycle(cycleId: string, notes?: string): Promise<TreatmentCycle> {
    const response = await apiClient.post(`/cycles/${cycleId}/approve`, null, {
      params: { notes },
    });
    return response.data;
  },

  async startCycle(cycleId: string): Promise<TreatmentCycle> {
    const response = await apiClient.post(`/cycles/${cycleId}/start`);
    return response.data;
  },

  async completeCycle(
    cycleId: string, 
    dischargeNotes?: string, 
    followUpInstructions?: string
  ): Promise<TreatmentCycle> {
    const response = await apiClient.post(`/cycles/${cycleId}/complete`, null, {
      params: { discharge_notes: dischargeNotes, follow_up_instructions: followUpInstructions },
    });
    return response.data;
  },

  // Drug Administration
  async getDrugAdministrations(cycleId: string): Promise<DrugAdministration[]> {
    const response = await apiClient.get(`/cycles/${cycleId}/drugs`);
    return response.data;
  },

  async updateDrugAdministration(adminId: string, data: Partial<DrugAdministration>): Promise<DrugAdministration> {
    const response = await apiClient.put(`/drug-admin/${adminId}`, data);
    return response.data;
  },
};
