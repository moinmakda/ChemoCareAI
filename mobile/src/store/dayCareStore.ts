/**
 * Day Care Store - State management for day care operations
 */
import { create } from 'zustand';
import api from '../services/api';

// Types
export interface ActivePatient {
  id: string;
  patient_id: string;
  patient_name: string;
  chair_number: number;
  protocol_name: string;
  current_drug: string;
  status: 'awaiting' | 'premedication' | 'infusing' | 'observation' | 'completed' | 'alert';
  progress: number;
  start_time: string;
  estimated_end_time: string;
  nurse_assigned: string;
  nurse_id: string;
  vitals_status: 'normal' | 'warning' | 'critical';
  last_vitals?: {
    temperature: number;
    blood_pressure: string;
    heart_rate: number;
    oxygen_saturation: number;
  };
  alerts: Alert[];
}

export interface Chair {
  id: number;
  status: 'available' | 'occupied' | 'maintenance' | 'reserved';
  current_patient_id?: string;
  current_patient_name?: string;
  scheduled_sessions: {
    time: string;
    patient_name: string;
    duration: number;
  }[];
}

export interface Alert {
  id: string;
  type: 'vital_warning' | 'vital_critical' | 'reaction' | 'delay' | 'completion';
  message: string;
  patient_id: string;
  patient_name: string;
  chair_number: number;
  timestamp: string;
  acknowledged: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface InfusionSession {
  id: string;
  patient_id: string;
  protocol_id: string;
  cycle_number: number;
  chair_number: number;
  scheduled_start: string;
  actual_start?: string;
  estimated_end: string;
  actual_end?: string;
  status: string;
  drugs: {
    name: string;
    dose: string;
    duration: number;
    order: number;
    status: 'pending' | 'infusing' | 'completed' | 'skipped';
  }[];
  reactions: any[];
  notes: string;
}

interface DayCareState {
  // Active patients
  activePatients: ActivePatient[];
  isLoading: boolean;
  error: string | null;

  // Chairs
  chairs: Chair[];
  chairsLoading: boolean;

  // Alerts
  alerts: Alert[];
  unacknowledgedCount: number;

  // Selected session
  selectedSession: InfusionSession | null;
  sessionLoading: boolean;

  // Actions
  fetchActivePatients: () => Promise<void>;
  fetchChairStatus: () => Promise<void>;
  fetchPatientDetails: (id: string) => Promise<void>;
  startInfusion: (sessionId: string) => Promise<boolean>;
  updateProgress: (sessionId: string, progress: number) => Promise<boolean>;
  reportReaction: (sessionId: string, data: any) => Promise<boolean>;
  completeSession: (sessionId: string) => Promise<boolean>;
  acknowledgeAlert: (alertId: string) => void;
  clearError: () => void;
}

export const useDayCareStore = create<DayCareState>((set, get) => ({
  // Initial state
  activePatients: [],
  isLoading: false,
  error: null,
  chairs: [],
  chairsLoading: false,
  alerts: [],
  unacknowledgedCount: 0,
  selectedSession: null,
  sessionLoading: false,

  // Actions
  fetchActivePatients: async () => {
    set({ isLoading: true, error: null });
    try {
      const patients = await api.daycare.getActivePatients();
      
      // Extract alerts from patients
      const alerts = patients.flatMap((p: ActivePatient) => p.alerts || []);
      const unacknowledgedCount = alerts.filter((a: Alert) => !a.acknowledged).length;

      set({
        activePatients: patients,
        alerts,
        unacknowledgedCount,
        isLoading: false,
      });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  fetchChairStatus: async () => {
    set({ chairsLoading: true });
    try {
      const chairs = await api.daycare.getChairStatus();
      set({ chairs, chairsLoading: false });
    } catch (error: any) {
      set({ error: error.message, chairsLoading: false });
    }
  },

  fetchPatientDetails: async (id: string) => {
    set({ sessionLoading: true });
    try {
      const session = await api.daycare.getPatientDetails(id);
      set({ selectedSession: session, sessionLoading: false });
    } catch (error: any) {
      set({ error: error.message, sessionLoading: false });
    }
  },

  startInfusion: async (sessionId: string) => {
    try {
      await api.daycare.startInfusion(sessionId);
      
      // Update local state
      set((state) => ({
        activePatients: state.activePatients.map((p) =>
          p.id === sessionId ? { ...p, status: 'infusing' as const } : p
        ),
      }));
      
      return true;
    } catch (error: any) {
      set({ error: error.message });
      return false;
    }
  },

  updateProgress: async (sessionId: string, progress: number) => {
    try {
      await api.daycare.updateProgress(sessionId, progress);
      
      // Update local state
      set((state) => ({
        activePatients: state.activePatients.map((p) =>
          p.id === sessionId ? { ...p, progress } : p
        ),
      }));
      
      return true;
    } catch (error: any) {
      set({ error: error.message });
      return false;
    }
  },

  reportReaction: async (sessionId: string, data: any) => {
    try {
      await api.daycare.reportReaction(sessionId, data);
      
      // Update local state with alert
      set((state) => ({
        activePatients: state.activePatients.map((p) =>
          p.id === sessionId ? { ...p, status: 'alert' as const } : p
        ),
      }));
      
      return true;
    } catch (error: any) {
      set({ error: error.message });
      return false;
    }
  },

  completeSession: async (sessionId: string) => {
    try {
      await api.daycare.completeSession(sessionId);
      
      // Update local state
      set((state) => ({
        activePatients: state.activePatients.map((p) =>
          p.id === sessionId ? { ...p, status: 'completed' as const, progress: 100 } : p
        ),
      }));
      
      return true;
    } catch (error: any) {
      set({ error: error.message });
      return false;
    }
  },

  acknowledgeAlert: (alertId: string) => {
    set((state) => ({
      alerts: state.alerts.map((a) =>
        a.id === alertId ? { ...a, acknowledged: true } : a
      ),
      unacknowledgedCount: Math.max(0, state.unacknowledgedCount - 1),
    }));
  },

  clearError: () => set({ error: null }),
}));
