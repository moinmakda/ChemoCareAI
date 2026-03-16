/**
 * Vitals Service Tests
 * 
 * Tests for vitals API service using Jest mocks.
 */
import { vitalsService } from '../../services/vitalsService';

// Mock the api module
jest.mock('../../services/api', () => ({
  apiClient: {
    post: jest.fn(),
    get: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

import { apiClient } from '../../services/api';

const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('Vitals Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getVitals', () => {
    it('fetches vitals for a specific patient (staff)', async () => {
      const mockVitals = [
        {
          id: '1',
          patientId: 'patient-1',
          temperatureF: 98.6,
          pulseBpm: 72,
          bloodPressureSystolic: 120,
          bloodPressureDiastolic: 80,
          oxygenSaturation: 98,
          recordedAt: new Date().toISOString(),
        },
        {
          id: '2',
          patientId: 'patient-1',
          temperatureF: 99.0,
          pulseBpm: 78,
          bloodPressureSystolic: 125,
          bloodPressureDiastolic: 82,
          oxygenSaturation: 97,
          recordedAt: new Date().toISOString(),
        },
      ];
      mockedApiClient.get.mockResolvedValueOnce({ data: mockVitals });

      const result = await vitalsService.getVitals('patient-1');

      expect(mockedApiClient.get).toHaveBeenCalledWith('/vitals', { params: { patient_id: 'patient-1', limit: 20 } });
      expect(result).toHaveLength(2);
      expect(result[0].pulseBpm).toBe(72);
    });

    it('fetches own vitals when no patientId given (patient)', async () => {
      const mockVitals = [
        {
          id: '1',
          patientId: 'patient-1',
          temperatureF: 98.6,
          recordedAt: new Date().toISOString(),
        },
      ];
      mockedApiClient.get.mockResolvedValueOnce({ data: mockVitals });

      const result = await vitalsService.getVitals();

      expect(mockedApiClient.get).toHaveBeenCalledWith('/vitals', { params: { limit: 20 } });
      expect(result).toHaveLength(1);
    });

    it('propagates errors', async () => {
      mockedApiClient.get.mockRejectedValueOnce(new Error('Patient not found'));

      await expect(vitalsService.getVitals('nonexistent')).rejects.toThrow('Patient not found');
    });
  });

  describe('logVitals', () => {
    it('successfully posts vitals (staff includes patient_id)', async () => {
      const newVitals = {
        patient_id: 'patient-1',
        temperature_f: 98.6,
        pulse_bpm: 72,
        blood_pressure_systolic: 120,
        blood_pressure_diastolic: 80,
        oxygen_saturation: 98,
      };
      const mockResponse = {
        id: '3',
        patientId: 'patient-1',
        temperatureF: 98.6,
        pulseBpm: 72,
        bloodPressureSystolic: 120,
        bloodPressureDiastolic: 80,
        oxygenSaturation: 98,
        recordedAt: new Date().toISOString(),
      };
      mockedApiClient.post.mockResolvedValueOnce({ data: mockResponse });

      const result = await vitalsService.logVitals(newVitals);

      expect(mockedApiClient.post).toHaveBeenCalledWith('/vitals', newVitals);
      expect(result).toBeDefined();
      expect(result.id).toBe('3');
      expect(result.temperatureF).toBe(98.6);
    });

    it('propagates validation errors', async () => {
      mockedApiClient.post.mockRejectedValueOnce(new Error('Validation failed'));

      await expect(
        vitalsService.logVitals({ patient_id: 'patient-1' })
      ).rejects.toThrow('Validation failed');
    });
  });

  describe('getLatestVital', () => {
    it('returns latest vital when available', async () => {
      const mockVitals = [
        {
          id: '1',
          patientId: 'patient-1',
          temperatureF: 98.6,
          recordedAt: new Date().toISOString(),
        },
      ];
      mockedApiClient.get.mockResolvedValueOnce({ data: mockVitals });

      const result = await vitalsService.getLatestVital('patient-1');

      expect(result).toBeDefined();
      expect(result?.id).toBe('1');
    });

    it('returns null when no vitals exist', async () => {
      mockedApiClient.get.mockResolvedValueOnce({ data: [] });

      const result = await vitalsService.getLatestVital('patient-1');

      expect(result).toBeNull();
    });
  });
});
