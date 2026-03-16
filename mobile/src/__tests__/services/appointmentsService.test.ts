/**
 * Appointments Service Tests
 * 
 * Tests for appointments API service using Jest mocks.
 */
import { appointmentsService } from '../../services/appointmentsService';

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

describe('Appointments Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listAppointments', () => {
    it('successfully lists appointments', async () => {
      const mockAppointments = [
        {
          id: '1',
          patientId: 'patient-1',
          appointmentType: 'daycare_chemo',
          scheduledDate: '2025-01-25',
          scheduledTime: '09:00:00',
          status: 'scheduled',
        },
        {
          id: '2',
          patientId: 'patient-1',
          appointmentType: 'follow_up',
          scheduledDate: '2025-02-01',
          scheduledTime: '10:00:00',
          status: 'confirmed',
        },
      ];
      mockedApiClient.get.mockResolvedValueOnce({ data: mockAppointments });

      const result = await appointmentsService.listAppointments();

      expect(mockedApiClient.get).toHaveBeenCalledWith('/appointments', { params: undefined });
      expect(result).toHaveLength(2);
      expect(result[0].appointmentType).toBe('daycare_chemo');
    });

    it('filters appointments by patient ID', async () => {
      mockedApiClient.get.mockResolvedValueOnce({ data: [] });

      await appointmentsService.listAppointments({ patient_id: 'patient-1' });

      expect(mockedApiClient.get).toHaveBeenCalledWith('/appointments', { 
        params: { patient_id: 'patient-1' } 
      });
    });

    it('handles error when listing appointments', async () => {
      mockedApiClient.get.mockRejectedValueOnce(new Error('Unauthorized'));

      await expect(appointmentsService.listAppointments()).rejects.toThrow('Unauthorized');
    });
  });

  describe('getAppointment', () => {
    it('successfully gets appointment by ID', async () => {
      const mockAppointment = {
        id: '1',
        patientId: 'patient-1',
        appointmentType: 'daycare_chemo',
        scheduledDate: '2025-01-25',
        scheduledTime: '09:00:00',
        status: 'scheduled',
      };
      mockedApiClient.get.mockResolvedValueOnce({ data: mockAppointment });

      const result = await appointmentsService.getAppointment('1');

      expect(mockedApiClient.get).toHaveBeenCalledWith('/appointments/1');
      expect(result).toBeDefined();
      expect(result.id).toBe('1');
    });

    it('handles not found error', async () => {
      mockedApiClient.get.mockRejectedValueOnce(new Error('Appointment not found'));

      await expect(appointmentsService.getAppointment('nonexistent')).rejects.toThrow('Appointment not found');
    });
  });

  describe('createAppointment', () => {
    it('successfully creates an appointment', async () => {
      const newAppointment = {
        patient_id: 'patient-1',
        appointment_type: 'daycare_chemo' as const,
        scheduled_date: '2025-01-25',
        scheduled_time: '09:00:00',
        duration_mins: 180,
      };
      const mockResponse = {
        id: '3',
        patientId: 'patient-1',
        appointmentType: 'daycare_chemo',
        scheduledDate: '2025-01-25',
        scheduledTime: '09:00:00',
        durationMins: 180,
        status: 'scheduled',
      };
      mockedApiClient.post.mockResolvedValueOnce({ data: mockResponse });

      const result = await appointmentsService.createAppointment(newAppointment);

      expect(mockedApiClient.post).toHaveBeenCalledWith('/appointments', newAppointment);
      expect(result).toBeDefined();
      expect(result.id).toBe('3');
    });

    it('handles validation error when creating appointment', async () => {
      mockedApiClient.post.mockRejectedValueOnce(new Error('Invalid date format'));

      await expect(
        appointmentsService.createAppointment({
          patient_id: 'patient-1',
          appointment_type: 'daycare_chemo',
          scheduled_date: 'invalid-date',
          scheduled_time: '09:00:00',
        })
      ).rejects.toThrow('Invalid date format');
    });
  });

  describe('updateAppointment', () => {
    it('successfully updates an appointment', async () => {
      const mockResponse = {
        id: '1',
        patientId: 'patient-1',
        appointmentType: 'daycare_chemo',
        scheduledDate: '2025-01-26',
        scheduledTime: '10:00:00',
        status: 'confirmed',
      };
      mockedApiClient.put.mockResolvedValueOnce({ data: mockResponse });

      const result = await appointmentsService.updateAppointment('1', {
        scheduled_date: '2025-01-26',
        scheduled_time: '10:00:00',
        status: 'confirmed',
      });

      expect(mockedApiClient.put).toHaveBeenCalledWith('/appointments/1', expect.any(Object));
      expect(result.status).toBe('confirmed');
    });
  });

  describe('cancelAppointment', () => {
    it('successfully cancels an appointment via updateAppointment', async () => {
      const mockResponse = {
        id: '1',
        status: 'cancelled',
        cancellationReason: 'Patient request',
      };
      mockedApiClient.put.mockResolvedValueOnce({ data: mockResponse });

      // Use updateAppointment to cancel
      const result = await appointmentsService.updateAppointment('1', {
        status: 'cancelled',
        cancellation_reason: 'Patient request',
      });

      expect(mockedApiClient.put).toHaveBeenCalledWith('/appointments/1', {
        status: 'cancelled',
        cancellation_reason: 'Patient request',
      });
      expect(result.status).toBe('cancelled');
    });
  });
});
