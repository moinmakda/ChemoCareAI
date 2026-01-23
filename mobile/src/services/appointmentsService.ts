/**
 * Appointments Service - API calls for appointment management
 */
import { apiClient } from './api';
import type { Appointment } from '../types';

export interface AppointmentCreate {
  patient_id: string;
  appointment_type: 'chemotherapy' | 'consultation' | 'follow_up' | 'lab_work' | 'imaging' | 'emergency';
  scheduled_date: string; // YYYY-MM-DD
  scheduled_time: string; // HH:MM:SS
  duration_mins?: number;
  cycle_id?: string;
  chair_number?: number;
  doctor_id?: string;
  nurse_id?: string;
  notes?: string;
}

export interface AppointmentUpdate {
  scheduled_date?: string;
  scheduled_time?: string;
  duration_mins?: number;
  status?: 'scheduled' | 'confirmed' | 'checked_in' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  chair_number?: number;
  doctor_id?: string;
  nurse_id?: string;
  notes?: string;
  cancellation_reason?: string;
}

export interface AppointmentListParams {
  patient_id?: string;
  scheduled_date?: string;
  status?: string;
}

export const appointmentsService = {
  /**
   * List appointments (optionally filtered)
   */
  async listAppointments(params?: AppointmentListParams): Promise<Appointment[]> {
    const response = await apiClient.get('/appointments', { params });
    return response.data;
  },

  /**
   * Get appointment by ID
   */
  async getAppointment(appointmentId: string): Promise<Appointment> {
    const response = await apiClient.get(`/appointments/${appointmentId}`);
    return response.data;
  },

  /**
   * Create a new appointment
   */
  async createAppointment(data: AppointmentCreate): Promise<Appointment> {
    const response = await apiClient.post('/appointments', data);
    return response.data;
  },

  /**
   * Update an appointment
   */
  async updateAppointment(appointmentId: string, data: AppointmentUpdate): Promise<Appointment> {
    const response = await apiClient.put(`/appointments/${appointmentId}`, data);
    return response.data;
  },

  /**
   * Check in to an appointment
   */
  async checkIn(appointmentId: string): Promise<Appointment> {
    const response = await apiClient.post(`/appointments/${appointmentId}/checkin`);
    return response.data;
  },

  /**
   * Check out from an appointment
   */
  async checkOut(appointmentId: string): Promise<Appointment> {
    const response = await apiClient.post(`/appointments/${appointmentId}/checkout`);
    return response.data;
  },

  /**
   * Get today's appointments
   */
  async getTodayAppointments(): Promise<Appointment[]> {
    const today = new Date().toISOString().split('T')[0];
    return this.listAppointments({ scheduled_date: today });
  },

  /**
   * Get upcoming appointments for a patient
   */
  async getUpcomingAppointments(patientId: string): Promise<Appointment[]> {
    const appointments = await this.listAppointments({ patient_id: patientId });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return appointments
      .filter(apt => new Date(apt.scheduledDate) >= today)
      .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());
  },
};
