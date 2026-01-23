/**
 * Patient Store - Zustand store for patient-related state
 */
import { create } from 'zustand';
import { patientService } from '../services/patientService';
import type { Patient, Appointment, Document, TreatmentPlan, SymptomEntry, Vital } from '../types';

interface PatientState {
  // Current patient (for patient portal)
  currentPatient: Patient | null;
  
  // Patient list (for staff)
  patients: Patient[];
  
  // Related data
  appointments: Appointment[];
  documents: Document[];
  treatmentPlans: TreatmentPlan[];
  vitals: Vital[];
  symptoms: SymptomEntry[];
  
  // Loading states
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchCurrentPatient: () => Promise<void>;
  fetchPatients: (search?: string) => Promise<void>;
  fetchPatient: (id: string) => Promise<Patient>;
  updatePatient: (id: string, data: Partial<Patient>) => Promise<void>;
  fetchAppointments: () => Promise<void>;
  fetchDocuments: () => Promise<void>;
  fetchTreatmentPlans: () => Promise<void>;
  fetchVitals: () => Promise<void>;
  fetchSymptoms: () => Promise<void>;
  logSymptoms: (symptoms: Partial<SymptomEntry>) => Promise<void>;
  clearError: () => void;
}

export const usePatientStore = create<PatientState>((set, get) => ({
  currentPatient: null,
  patients: [],
  appointments: [],
  documents: [],
  treatmentPlans: [],
  vitals: [],
  symptoms: [],
  isLoading: false,
  error: null,

  fetchCurrentPatient: async () => {
    set({ isLoading: true, error: null });
    try {
      const patient = await patientService.getMyProfile();
      set({ currentPatient: patient, isLoading: false, error: null });
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || error.message || 'Failed to load patient profile';
      set({ error: errorMsg, isLoading: false, currentPatient: null });
      throw error;
    }
  },

  fetchPatients: async (search?: string) => {
    set({ isLoading: true, error: null });
    try {
      const patients = await patientService.listPatients({ search });
      set({ patients, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  fetchPatient: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const patient = await patientService.getPatient(id);
      set({ isLoading: false });
      return patient;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  updatePatient: async (id: string, data: Partial<Patient>) => {
    set({ isLoading: true, error: null });
    try {
      const updated = await patientService.updatePatient(id, data);
      set({ currentPatient: updated, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  fetchAppointments: async () => {
    const { currentPatient } = get();
    if (!currentPatient) return;
    
    try {
      const appointments = await patientService.getAppointments(currentPatient.id);
      set({ appointments });
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  fetchDocuments: async () => {
    const { currentPatient } = get();
    if (!currentPatient) return;
    
    try {
      const documents = await patientService.getDocuments(currentPatient.id);
      set({ documents });
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  fetchTreatmentPlans: async () => {
    const { currentPatient } = get();
    if (!currentPatient) return;
    
    try {
      const treatmentPlans = await patientService.getTreatmentPlans(currentPatient.id);
      set({ treatmentPlans });
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  fetchVitals: async () => {
    const { currentPatient } = get();
    if (!currentPatient) return;
    
    try {
      const vitals = await patientService.getVitals(currentPatient.id);
      set({ vitals });
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  fetchSymptoms: async () => {
    const { currentPatient } = get();
    if (!currentPatient) return;
    
    try {
      const symptoms = await patientService.getSymptomEntries(currentPatient.id);
      set({ symptoms });
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  logSymptoms: async (symptoms: Partial<SymptomEntry>) => {
    const { currentPatient } = get();
    if (!currentPatient) return;
    
    set({ isLoading: true, error: null });
    try {
      await patientService.logSymptoms(currentPatient.id, symptoms);
      await get().fetchSymptoms();
      set({ isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));
