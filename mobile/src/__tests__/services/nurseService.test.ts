/**
 * Nurse Service Tests
 *
 * Tests nurse-specific API interactions:
 * - Dashboard stats computation
 * - Active/awaiting patient filtering
 * - Medication management (start, complete, pause)
 * - Vitals recording
 * - Patient check-in/check-out
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
import { nurseService } from '../../services/nurseService';

const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;

// ─── Mock Data ──────────────────────────────────────────────────────────────

const today = new Date().toISOString().split('T')[0];

const mockAppointments = [
  {
    id: 'apt-1',
    patientId: 'p-1',
    appointmentType: 'daycare_chemo',
    scheduledDate: today,
    scheduledTime: '09:00',
    durationMins: 180,
    status: 'checked_in',
    createdAt: '2026-03-16T00:00:00Z',
    updatedAt: '2026-03-16T09:00:00Z',
  },
  {
    id: 'apt-2',
    patientId: 'p-2',
    appointmentType: 'daycare_chemo',
    scheduledDate: today,
    scheduledTime: '10:00',
    durationMins: 120,
    status: 'scheduled',
    createdAt: '2026-03-16T00:00:00Z',
    updatedAt: '2026-03-16T00:00:00Z',
  },
  {
    id: 'apt-3',
    patientId: 'p-3',
    appointmentType: 'lab_work',
    scheduledDate: today,
    scheduledTime: '08:00',
    durationMins: 30,
    status: 'completed',
    createdAt: '2026-03-16T00:00:00Z',
    updatedAt: '2026-03-16T08:30:00Z',
  },
];

const mockMedications = [
  {
    id: 'med-1',
    cycleId: 'cycle-1',
    drugName: 'Rituximab',
    plannedDose: 716,
    unit: 'mg',
    route: 'IV infusion',
    status: 'pending',
    sequenceNumber: 1,
    createdAt: '2026-03-16T00:00:00Z',
  },
  {
    id: 'med-2',
    cycleId: 'cycle-1',
    drugName: 'Cyclophosphamide',
    plannedDose: 1432,
    unit: 'mg',
    route: 'IV bolus',
    status: 'completed',
    sequenceNumber: 2,
    createdAt: '2026-03-16T00:00:00Z',
  },
];

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Nurse Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getTodayMedications', () => {
    it('fetches today medications', async () => {
      mockedApiClient.get.mockResolvedValueOnce({ data: mockMedications });

      const result = await nurseService.getTodayMedications();

      expect(mockedApiClient.get).toHaveBeenCalledWith('/medications/today');
      expect(result).toHaveLength(2);
      expect(result[0].drugName).toBe('Rituximab');
    });

    it('returns empty array on error', async () => {
      mockedApiClient.get.mockRejectedValueOnce(new Error('403 Forbidden'));

      const result = await nurseService.getTodayMedications();

      expect(result).toEqual([]);
    });
  });

  describe('updateMedicationStatus', () => {
    it('updates medication to started', async () => {
      const updated = { ...mockMedications[0], status: 'started', startedAt: '2026-03-16T09:30:00Z' };
      mockedApiClient.put.mockResolvedValueOnce({ data: updated });

      const result = await nurseService.updateMedicationStatus('med-1', 'started');

      expect(mockedApiClient.put).toHaveBeenCalledWith('/medications/med-1/status', {
        status: 'started',
        actual_dose: undefined,
        notes: undefined,
      });
      expect(result.status).toBe('started');
    });

    it('completes medication with actual dose and notes', async () => {
      const updated = { ...mockMedications[0], status: 'completed', actualDose: 700 };
      mockedApiClient.put.mockResolvedValueOnce({ data: updated });

      const result = await nurseService.completeMedication('med-1', 700, 'Dose adjusted');

      expect(mockedApiClient.put).toHaveBeenCalledWith('/medications/med-1/status', {
        status: 'completed',
        actual_dose: 700,
        notes: 'Dose adjusted',
      });
      expect(result.status).toBe('completed');
    });

    it('pauses medication with reason', async () => {
      const updated = { ...mockMedications[0], status: 'paused' };
      mockedApiClient.put.mockResolvedValueOnce({ data: updated });

      const result = await nurseService.pauseMedication('med-1', 'Patient reaction');

      expect(mockedApiClient.put).toHaveBeenCalledWith('/medications/med-1/status', {
        status: 'paused',
        actual_dose: undefined,
        notes: 'Patient reaction',
      });
    });
  });

  describe('startMedication / completeMedication shortcuts', () => {
    it('startMedication calls updateMedicationStatus with started', async () => {
      mockedApiClient.put.mockResolvedValueOnce({
        data: { ...mockMedications[0], status: 'started' },
      });

      await nurseService.startMedication('med-1');

      expect(mockedApiClient.put).toHaveBeenCalledWith('/medications/med-1/status', {
        status: 'started',
        actual_dose: undefined,
        notes: undefined,
      });
    });
  });

  describe('getActivePatients', () => {
    it('returns only checked_in and in_progress patients', async () => {
      mockedApiClient.get.mockResolvedValueOnce({ data: mockAppointments });

      const result = await nurseService.getActivePatients();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('apt-1');
      expect(result[0].status).toBe('checked_in');
    });
  });

  describe('getAwaitingPatients', () => {
    it('returns only scheduled and confirmed patients', async () => {
      mockedApiClient.get.mockResolvedValueOnce({ data: mockAppointments });

      const result = await nurseService.getAwaitingPatients();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('apt-2');
      expect(result[0].status).toBe('scheduled');
    });
  });

  describe('recordVitals', () => {
    it('records vitals for a patient', async () => {
      const mockVital = {
        id: 'v-1',
        patientId: 'p-1',
        temperatureF: 98.6,
        pulseBpm: 72,
        bloodPressureSystolic: 120,
        bloodPressureDiastolic: 80,
        oxygenSaturation: 98,
        recordedAt: '2026-03-16T09:00:00Z',
        createdAt: '2026-03-16T09:00:00Z',
      };
      mockedApiClient.post.mockResolvedValueOnce({ data: mockVital });

      const result = await nurseService.recordVitals('p-1', {
        temperature_f: 98.6,
        pulse_bpm: 72,
        blood_pressure_systolic: 120,
        blood_pressure_diastolic: 80,
        oxygen_saturation: 98,
      });

      expect(mockedApiClient.post).toHaveBeenCalledWith('/vitals', {
        patient_id: 'p-1',
        temperature_f: 98.6,
        pulse_bpm: 72,
        blood_pressure_systolic: 120,
        blood_pressure_diastolic: 80,
        oxygen_saturation: 98,
      });
      expect(result.id).toBe('v-1');
    });
  });

  describe('checkInPatient / checkOutPatient', () => {
    it('checks in a patient', async () => {
      const checkedIn = { ...mockAppointments[1], status: 'checked_in' };
      mockedApiClient.post.mockResolvedValueOnce({ data: checkedIn });

      const result = await nurseService.checkInPatient('apt-2');

      expect(mockedApiClient.post).toHaveBeenCalledWith('/appointments/apt-2/checkin');
      expect(result.status).toBe('checked_in');
    });

    it('checks out a patient', async () => {
      const checkedOut = { ...mockAppointments[0], status: 'completed' };
      mockedApiClient.post.mockResolvedValueOnce({ data: checkedOut });

      const result = await nurseService.checkOutPatient('apt-1');

      expect(mockedApiClient.post).toHaveBeenCalledWith('/appointments/apt-1/checkout');
      expect(result.status).toBe('completed');
    });
  });

  describe('updateAppointmentStatus', () => {
    it('updates appointment status', async () => {
      const updated = { ...mockAppointments[1], status: 'confirmed' };
      mockedApiClient.put.mockResolvedValueOnce({ data: updated });

      const result = await nurseService.updateAppointmentStatus('apt-2', 'confirmed');

      expect(mockedApiClient.put).toHaveBeenCalledWith('/appointments/apt-2', { status: 'confirmed' });
      expect(result.status).toBe('confirmed');
    });
  });

  describe('getDashboardStats', () => {
    it('returns fallback stats on error', async () => {
      mockedApiClient.get.mockRejectedValue(new Error('Server error'));

      const result = await nurseService.getDashboardStats();

      expect(result).toEqual({
        assignedPatients: 0,
        pendingVitals: 0,
        pendingMedications: 0,
        completedToday: 0,
      });
    });
  });
});
