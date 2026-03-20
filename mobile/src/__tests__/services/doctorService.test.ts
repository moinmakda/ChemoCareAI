/**
 * Doctor Service Tests
 *
 * Tests doctor-specific API interactions:
 * - Patient listing and details
 * - Vitals and symptoms retrieval
 * - Appointment management
 * - Dashboard stats (with fallback)
 * - Treatment plans
 */

jest.mock('../../services/api', () => ({
  apiClient: {
    post: jest.fn(),
    get: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

import { apiClient } from '../../services/api';
import { doctorService } from '../../services/doctorService';

const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;

const today = new Date();
const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

const mockPatients = [
  { id: 'p-1', firstName: 'Rajesh', lastName: 'Kumar', cancerType: 'DLBCL', cancerStage: 'III' },
  { id: 'p-2', firstName: 'Priya', lastName: 'Sharma', cancerType: 'Breast', cancerStage: 'IIA' },
];

const mockPatientDetail = {
  id: 'p-1',
  firstName: 'Rajesh',
  lastName: 'Kumar',
  dateOfBirth: '1968-05-15',
  gender: 'male',
  bsa: 1.91,
  age: 57,
  allergies: ['platinum'],
  comorbidities: ['hypertension'],
  currentMedications: [],
  cancerType: 'DLBCL',
  cancerStage: 'Ann Arbor III',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-03-16T00:00:00Z',
};

const mockAppointments = [
  { id: 'apt-1', patientId: 'p-1', scheduledDate: todayStr, status: 'checked_in', appointmentType: 'daycare_chemo', scheduledTime: '09:00', durationMins: 180, createdAt: '', updatedAt: '' },
  { id: 'apt-2', patientId: 'p-2', scheduledDate: todayStr, status: 'in_progress', appointmentType: 'daycare_chemo', scheduledTime: '10:00', durationMins: 120, createdAt: '', updatedAt: '' },
  { id: 'apt-3', patientId: 'p-3', scheduledDate: todayStr, status: 'completed', appointmentType: 'lab_work', scheduledTime: '08:00', durationMins: 30, createdAt: '', updatedAt: '' },
];

describe('Doctor Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPatients', () => {
    it('lists all patients', async () => {
      mockedApiClient.get.mockResolvedValueOnce({ data: mockPatients });

      const result = await doctorService.getPatients();

      expect(mockedApiClient.get).toHaveBeenCalledWith('/patients', { params: undefined });
      expect(result).toHaveLength(2);
      expect(result[0].firstName).toBe('Rajesh');
    });

    it('searches patients', async () => {
      mockedApiClient.get.mockResolvedValueOnce({ data: [mockPatients[0]] });

      const result = await doctorService.getPatients({ search: 'Rajesh' });

      expect(mockedApiClient.get).toHaveBeenCalledWith('/patients', { params: { search: 'Rajesh' } });
      expect(result).toHaveLength(1);
    });
  });

  describe('getPatientById', () => {
    it('returns patient detail', async () => {
      mockedApiClient.get.mockResolvedValueOnce({ data: mockPatientDetail });

      const result = await doctorService.getPatientById('p-1');

      expect(mockedApiClient.get).toHaveBeenCalledWith('/patients/p-1');
      expect(result.bsa).toBe(1.91);
      expect(result.allergies).toContain('platinum');
    });

    it('propagates not found error', async () => {
      mockedApiClient.get.mockRejectedValueOnce(new Error('Not found'));

      await expect(doctorService.getPatientById('nonexistent')).rejects.toThrow('Not found');
    });
  });

  describe('getPatientVitals', () => {
    it('fetches vitals with patient_id param', async () => {
      const mockVitals = [{ id: 'v-1', patientId: 'p-1', temperatureF: 98.6, recordedAt: '2026-03-16T09:00:00Z', createdAt: '' }];
      mockedApiClient.get.mockResolvedValueOnce({ data: mockVitals });

      const result = await doctorService.getPatientVitals('p-1', 10);

      expect(mockedApiClient.get).toHaveBeenCalledWith('/vitals', { params: { patient_id: 'p-1', limit: 10 } });
      expect(result).toHaveLength(1);
    });
  });

  describe('getPatientSymptoms', () => {
    it('fetches symptoms with patient_id param', async () => {
      const mockSymptoms = [{ id: 's-1', symptom: 'nausea', severity: 5 }];
      mockedApiClient.get.mockResolvedValueOnce({ data: mockSymptoms });

      const result = await doctorService.getPatientSymptoms('p-1');

      expect(mockedApiClient.get).toHaveBeenCalledWith('/symptoms', { params: { patient_id: 'p-1', limit: 20 } });
      expect(result).toHaveLength(1);
    });
  });

  describe('getTodayAppointments', () => {
    it('fetches appointments for today', async () => {
      mockedApiClient.get.mockResolvedValueOnce({ data: mockAppointments });

      const result = await doctorService.getTodayAppointments();

      expect(mockedApiClient.get).toHaveBeenCalledWith('/appointments', { params: { scheduled_date: todayStr } });
      expect(result).toHaveLength(3);
    });
  });

  describe('getActiveAppointments', () => {
    it('filters for active statuses only', async () => {
      mockedApiClient.get.mockResolvedValueOnce({ data: mockAppointments });

      const result = await doctorService.getActiveAppointments();

      expect(result).toHaveLength(2);
      expect(result.every(a => ['checked_in', 'in_progress', 'scheduled', 'confirmed'].includes(a.status))).toBe(true);
    });
  });

  describe('checkInPatient / checkOutPatient', () => {
    it('checks in patient', async () => {
      mockedApiClient.post.mockResolvedValueOnce({ data: { ...mockAppointments[0], status: 'checked_in' } });

      const result = await doctorService.checkInPatient('apt-1');

      expect(mockedApiClient.post).toHaveBeenCalledWith('/appointments/apt-1/checkin');
      expect(result.status).toBe('checked_in');
    });

    it('checks out patient', async () => {
      mockedApiClient.post.mockResolvedValueOnce({ data: { ...mockAppointments[0], status: 'completed' } });

      const result = await doctorService.checkOutPatient('apt-1');

      expect(mockedApiClient.post).toHaveBeenCalledWith('/appointments/apt-1/checkout');
      expect(result.status).toBe('completed');
    });
  });

  describe('recordVitals', () => {
    it('posts vitals with patient_id', async () => {
      const mockVital = { id: 'v-new', patientId: 'p-1', temperatureF: 99.1, recordedAt: '', createdAt: '' };
      mockedApiClient.post.mockResolvedValueOnce({ data: mockVital });

      const result = await doctorService.recordVitals('p-1', { temperature_f: 99.1, pulse_bpm: 80 });

      expect(mockedApiClient.post).toHaveBeenCalledWith('/vitals', {
        patient_id: 'p-1',
        temperature_f: 99.1,
        pulse_bpm: 80,
      });
      expect(result.id).toBe('v-new');
    });
  });

  describe('getDashboardStats', () => {
    it('returns stats from primary endpoint', async () => {
      const mockStats = { totalPatients: 25, todayAppointments: 8, activeTreatments: 3, pendingAlerts: 2 };
      mockedApiClient.get.mockResolvedValueOnce({ data: mockStats });

      const result = await doctorService.getDashboardStats();

      expect(mockedApiClient.get).toHaveBeenCalledWith('/dashboard/stats');
      expect(result.totalPatients).toBe(25);
      expect(result.activeTreatments).toBe(3);
    });

    it('falls back to client-side calculation on primary failure', async () => {
      mockedApiClient.get
        .mockRejectedValueOnce(new Error('Endpoint not found'))  // /dashboard/stats fails
        .mockResolvedValueOnce({ data: mockPatients })            // /patients fallback
        .mockResolvedValueOnce({ data: mockAppointments });       // /appointments fallback

      const result = await doctorService.getDashboardStats();

      expect(result.totalPatients).toBe(2);
      expect(result.todayAppointments).toBe(3);
      expect(result.activeTreatments).toBe(2); // checked_in + in_progress
    });

    it('returns zeros when all fallbacks fail', async () => {
      mockedApiClient.get.mockRejectedValue(new Error('Network error'));

      const result = await doctorService.getDashboardStats();

      expect(result).toEqual({
        totalPatients: 0,
        todayAppointments: 0,
        activeTreatments: 0,
        pendingAlerts: 0,
      });
    });
  });

  describe('getTreatmentPlans', () => {
    it('fetches treatment plans for a patient', async () => {
      const mockPlans = [{ id: 'plan-1', protocolName: 'RCHOP21', status: 'approved' }];
      mockedApiClient.get.mockResolvedValueOnce({ data: mockPlans });

      const result = await doctorService.getTreatmentPlans('p-1');

      expect(mockedApiClient.get).toHaveBeenCalledWith('/treatment-plans', { params: { patient_id: 'p-1' } });
      expect(result).toHaveLength(1);
    });

    it('fetches all treatment plans when no patientId', async () => {
      mockedApiClient.get.mockResolvedValueOnce({ data: [] });

      await doctorService.getTreatmentPlans();

      expect(mockedApiClient.get).toHaveBeenCalledWith('/treatment-plans', { params: {} });
    });
  });
});
