/**
 * MSW Request Handlers
 * 
 * Mock API handlers for testing. These intercept network requests
 * and return controlled responses for predictable testing.
 */
import { http, HttpResponse, delay } from 'msw';

const API_BASE = 'http://localhost:8000/api/v1';

// ==================== Mock Data ====================

export const mockUsers = {
  patient: {
    id: 'user-patient-1',
    email: 'patient@test.com',
    fullName: 'Test Patient',
    role: 'patient',
    isActive: true,
    isVerified: true,
    createdAt: '2024-01-01T00:00:00Z',
  },
  doctor: {
    id: 'user-doctor-1',
    email: 'doctor@test.com',
    fullName: 'Dr. Test Doctor',
    role: 'doctor_daycare',
    isActive: true,
    isVerified: true,
    createdAt: '2024-01-01T00:00:00Z',
  },
  nurse: {
    id: 'user-nurse-1',
    email: 'nurse@test.com',
    fullName: 'Nurse Test',
    role: 'nurse',
    isActive: true,
    isVerified: true,
    createdAt: '2024-01-01T00:00:00Z',
  },
};

export const mockPatient = {
  id: 'patient-1',
  userId: 'user-patient-1',
  firstName: 'John',
  lastName: 'Doe',
  dateOfBirth: '1980-05-15',
  gender: 'male',
  bloodGroup: 'O+',
  weightKg: 75.5,
  heightCm: 175,
  bsa: 1.92,
  age: 45,
  allergies: ['Penicillin'],
  comorbidities: ['Hypertension'],
  currentMedications: [],
  cancerType: 'Lung Cancer',
  cancerStage: 'Stage IIIA',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-15T00:00:00Z',
};

export const mockAppointments = [
  {
    id: 'appt-1',
    patientId: 'patient-1',
    appointmentType: 'daycare_chemo',
    scheduledDate: '2026-01-26',
    scheduledTime: '09:00',
    durationMins: 180,
    status: 'scheduled',
    notes: 'Cycle 3 of CHOP',
  },
  {
    id: 'appt-2',
    patientId: 'patient-1',
    appointmentType: 'lab_work',
    scheduledDate: '2026-01-27',
    scheduledTime: '08:00',
    durationMins: 30,
    status: 'scheduled',
    notes: 'Pre-chemo blood work',
  },
];

export const mockVitals = [
  {
    id: 'vital-1',
    patientId: 'patient-1',
    bloodPressureSystolic: 120,
    bloodPressureDiastolic: 80,
    heartRate: 72,
    temperature: 36.8,
    oxygenSaturation: 98,
    respiratoryRate: 16,
    recordedAt: '2026-01-25T09:00:00Z',
  },
];

export const mockSymptoms = [
  {
    id: 'symptom-1',
    patientId: 'patient-1',
    symptomType: 'nausea',
    severity: 3,
    description: 'Mild nausea after meals',
    reportedAt: '2026-01-24T14:00:00Z',
    resolvedAt: null,
  },
];

export const mockMedications = [
  {
    id: 'med-1',
    patientId: 'patient-1',
    patientName: 'John Doe',
    drugName: 'Cyclophosphamide',
    dose: '750mg/m²',
    route: 'IV',
    status: 'pending',
    scheduledTime: '09:00',
    notes: 'Dilute in 250ml NS',
  },
  {
    id: 'med-2',
    patientId: 'patient-1',
    patientName: 'John Doe',
    drugName: 'Doxorubicin',
    dose: '50mg/m²',
    route: 'IV Push',
    status: 'pending',
    scheduledTime: '10:30',
    notes: 'Administer slowly over 5 mins',
  },
];

export const mockTokens = {
  access_token: 'mock-access-token-12345',
  refresh_token: 'mock-refresh-token-67890',
  token_type: 'bearer',
  expires_in: 3600,
};

// ==================== Auth Handlers ====================

export const authHandlers = [
  // Login
  http.post(`${API_BASE}/auth/login`, async ({ request }) => {
    await delay(100);
    const body = await request.json() as { email: string; password: string };
    
    if (body.email === 'patient@test.com' && body.password === 'password123') {
      return HttpResponse.json({
        ...mockTokens,
        user: mockUsers.patient,
      });
    }
    
    if (body.email === 'doctor@test.com' && body.password === 'password123') {
      return HttpResponse.json({
        ...mockTokens,
        user: mockUsers.doctor,
      });
    }
    
    if (body.email === 'nurse@test.com' && body.password === 'password123') {
      return HttpResponse.json({
        ...mockTokens,
        user: mockUsers.nurse,
      });
    }
    
    return HttpResponse.json(
      { detail: 'Invalid credentials' },
      { status: 401 }
    );
  }),
  
  // Register
  http.post(`${API_BASE}/auth/register`, async ({ request }) => {
    await delay(100);
    const body = await request.json() as { email: string; password: string; full_name: string };
    
    return HttpResponse.json({
      ...mockTokens,
      user: {
        id: 'new-user-id',
        email: body.email,
        fullName: body.full_name,
        role: 'patient',
        isActive: true,
        isVerified: false,
        createdAt: new Date().toISOString(),
      },
    });
  }),
  
  // Get current user
  http.get(`${API_BASE}/auth/me`, async () => {
    await delay(50);
    return HttpResponse.json(mockUsers.patient);
  }),
  
  // Refresh token
  http.post(`${API_BASE}/auth/refresh`, async () => {
    await delay(50);
    return HttpResponse.json(mockTokens);
  }),
];

// ==================== Patient Handlers ====================

export const patientHandlers = [
  // Get patient profile
  http.get(`${API_BASE}/patients/me`, async () => {
    await delay(50);
    return HttpResponse.json(mockPatient);
  }),
  
  // Get patient by ID
  http.get(`${API_BASE}/patients/:id`, async ({ params }) => {
    await delay(50);
    if (params.id === 'patient-1') {
      return HttpResponse.json(mockPatient);
    }
    return HttpResponse.json({ detail: 'Patient not found' }, { status: 404 });
  }),
  
  // Update patient
  http.put(`${API_BASE}/patients/:id`, async ({ request, params }) => {
    await delay(100);
    const updates = await request.json() as Record<string, unknown>;
    return HttpResponse.json({ ...mockPatient, ...updates });
  }),
];

// ==================== Clinical Handlers ====================

export const clinicalHandlers = [
  // Appointments
  http.get(`${API_BASE}/clinical/appointments`, async () => {
    await delay(50);
    return HttpResponse.json(mockAppointments);
  }),
  
  http.get(`${API_BASE}/clinical/appointments/upcoming`, async () => {
    await delay(50);
    return HttpResponse.json(mockAppointments);
  }),
  
  http.post(`${API_BASE}/clinical/appointments`, async ({ request }) => {
    await delay(100);
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({
      id: 'new-appt-id',
      ...body,
      status: 'scheduled',
    });
  }),
  
  // Vitals
  http.get(`${API_BASE}/clinical/vitals/:patientId`, async () => {
    await delay(50);
    return HttpResponse.json(mockVitals);
  }),
  
  http.post(`${API_BASE}/clinical/vitals`, async ({ request }) => {
    await delay(100);
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({
      id: 'new-vital-id',
      ...body,
      recordedAt: new Date().toISOString(),
    });
  }),
  
  // Symptoms
  http.get(`${API_BASE}/clinical/symptoms/:patientId`, async () => {
    await delay(50);
    return HttpResponse.json(mockSymptoms);
  }),
  
  http.post(`${API_BASE}/clinical/symptoms`, async ({ request }) => {
    await delay(100);
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({
      id: 'new-symptom-id',
      ...body,
      reportedAt: new Date().toISOString(),
    });
  }),
  
  // Medications
  http.get(`${API_BASE}/clinical/medications/today`, async () => {
    await delay(50);
    return HttpResponse.json(mockMedications);
  }),
  
  http.put(`${API_BASE}/clinical/medications/:id/status`, async ({ params, request }) => {
    await delay(100);
    const body = await request.json() as { status: string };
    const med = mockMedications.find(m => m.id === params.id);
    if (!med) {
      return HttpResponse.json({ detail: 'Medication not found' }, { status: 404 });
    }
    return HttpResponse.json({ ...med, status: body.status });
  }),
  
  // Dashboard stats
  http.get(`${API_BASE}/clinical/dashboard/stats`, async () => {
    await delay(50);
    return HttpResponse.json({
      totalPatients: 42,
      todayAppointments: 8,
      activeTreatments: 15,
      pendingAlerts: 3,
    });
  }),
];

// ==================== AI Handlers ====================

export const aiHandlers = [
  // Chat
  http.post(`${API_BASE}/ai/chat`, async ({ request }) => {
    await delay(200);
    const body = await request.json() as { message: string };
    return HttpResponse.json({
      response: `I understand you're asking about: "${body.message}". This is a mock AI response for testing purposes.`,
      citations: [],
    });
  }),
  
  // Symptom analysis
  http.post(`${API_BASE}/ai/analyze-symptoms`, async ({ request }) => {
    await delay(200);
    return HttpResponse.json({
      severity: 'moderate',
      recommendations: [
        'Stay hydrated',
        'Rest as needed',
        'Contact your care team if symptoms worsen',
      ],
      urgency: 'routine',
      shouldContactDoctor: false,
    });
  }),
];

// ==================== Daycare Handlers ====================

export const daycareHandlers = [
  // Active sessions
  http.get(`${API_BASE}/daycare/sessions/active`, async () => {
    await delay(50);
    return HttpResponse.json([
      {
        session_id: 'session-1',
        patient_id: 'patient-1',
        patient_name: 'John Doe',
        chair_number: 3,
        current_drug: 'Cyclophosphamide',
        progress_percent: 45,
        status: 'infusing',
        started_at: '2026-01-25T09:00:00Z',
        estimated_end: '2026-01-25T12:00:00Z',
        alerts: [],
      },
    ]);
  }),
  
  // Chairs
  http.get(`${API_BASE}/daycare/chairs`, async () => {
    await delay(50);
    const chairs = Array.from({ length: 12 }, (_, i) => ({
      chair_number: i + 1,
      status: i === 2 ? 'occupied' : i === 5 ? 'maintenance' : 'available',
      current_patient: i === 2 ? { id: 'patient-1', name: 'John Doe' } : null,
    }));
    return HttpResponse.json(chairs);
  }),
];

// ==================== All Handlers ====================

export const handlers = [
  ...authHandlers,
  ...patientHandlers,
  ...clinicalHandlers,
  ...aiHandlers,
  ...daycareHandlers,
];
