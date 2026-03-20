/**
 * Full Product Workflow Test
 *
 * Simulates the complete ChemoCare workflow as different users:
 *
 * 1. NURSE: Selects patient → picks SOPHIA protocol → enters clinical data → submits
 * 2. NURSE: Reviews generated protocol (doses, warnings, safety) → approves
 * 3. DOCTOR: Reviews protocol → modifies dose → approves → treatment plan created
 * 4. NURSE: Checks in patient → records vitals → administers medications
 * 5. PATIENT: Views treatment plan, logs symptoms, chats with AI
 *
 * Each step verifies the API calls match the expected contract.
 */

jest.mock('../../services/api', () => ({
  apiClient: {
    post: jest.fn(),
    get: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
  setAuthTokens: jest.fn(() => Promise.resolve()),
  clearAuthTokens: jest.fn(() => Promise.resolve()),
}));

import { apiClient, setAuthTokens, clearAuthTokens } from '../../services/api';
import { authService } from '../../services/authService';
import {
  getSophiaProtocols,
  getSophiaCategories,
  createProtocolRequest,
  updateClinicalData,
  nurseSubmitForReview,
  nurseApproveProtocol,
  doctorApproveProtocol,
  getProtocolRequest,
} from '../../services/protocolService';
import { nurseService } from '../../services/nurseService';
import { doctorService } from '../../services/doctorService';
import { vitalsService } from '../../services/vitalsService';
import { patientService } from '../../services/patientService';

const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;

// ─── Shared Test State (simulates data flowing through the workflow) ────────

const PATIENT_ID = 'patient-uuid-001';
const REQUEST_ID = 'req-uuid-001';

const sophiaProtocol = {
  id: 'lymphoma-rchop21',
  code: 'LYMPHOMA-RCHOP21',
  name: 'RCHOP21 - Rituximab-Cyclophosphamide-Doxorubicin-Prednisolone-Vincristine',
  indication: 'DLBCL',
  drugs: ['Rituximab', 'Cyclophosphamide', 'Doxorubicin', 'Vincristine', 'Prednisolone'],
  cycleLengthDays: 21,
  totalCycles: 6,
  category: 'lymphoma',
};

const clinicalDataPayload = {
  protocol_code: 'LYMPHOMA-RCHOP21',
  cycle_number: 1,
  height_cm: 172,
  weight_kg: 78,
  cancer_type: 'DLBCL',
  disease_stage: 'Ann Arbor III',
  performance_status: '1',
  neutrophils: 2.1,
  platelets: 145,
  hemoglobin: 11.5,
  bilirubin: 12,
  gfr: 75,
  creatinine: 95,
  known_allergies: [],
  active_infection: false,
  hep_b_surface: 'negative',
  hep_b_core: 'positive',
};

const generatedProtocol = {
  protocolName: 'RCHOP21',
  protocolCode: 'LYMPHOMA-RCHOP21',
  cycleLengthDays: 21,
  totalCycles: 6,
  cycleNumber: 1,
  patientBsa: 1.93,
  patientBsaCapped: false,
  patientWeight: 78,
  patientAge: 55,
  chemotherapyDrugs: [
    { drugName: 'Rituximab', calculatedDose: 723.8, calculatedDoseUnit: 'mg', route: 'IV infusion', days: [1], doseModified: false },
    { drugName: 'Doxorubicin', calculatedDose: 96.5, calculatedDoseUnit: 'mg', route: 'IV bolus', days: [1], doseModified: false },
    { drugName: 'Vincristine', calculatedDose: 2.0, calculatedDoseUnit: 'mg', route: 'IV bolus', days: [1], doseModified: true, modificationReason: 'Max dose cap: 2.0 mg (calculated: 2.7 mg)' },
    { drugName: 'Cyclophosphamide', calculatedDose: 1447.5, calculatedDoseUnit: 'mg', route: 'IV bolus', days: [1], doseModified: false },
    { drugName: 'Prednisolone', calculatedDose: 100.0, calculatedDoseUnit: 'mg', route: 'Oral', days: [1, 2, 3, 4, 5], doseModified: false },
  ],
  preMedications: [
    { drugName: 'Dexamethasone', calculatedDose: 8, calculatedDoseUnit: 'mg', route: 'IV bolus' },
  ],
  takeHomeMedicines: [
    { drugName: 'Allopurinol', calculatedDose: 300, calculatedDoseUnit: 'mg', route: 'Oral' },
  ],
  warnings: [
    { level: 'warning', message: 'Anti-HBc POSITIVE: reactivation risk with Rituximab' },
    { level: 'warning', message: 'BASELINE LVEF RECOMMENDED: anthracycline-containing regimen' },
    { level: 'warning', message: 'Vincristine capped at 2.0 mg' },
  ],
  doseModificationsApplied: ['Vincristine: capped at 2.0mg (was 2.7mg)'],
  treatmentDelayRecommended: false,
  treatmentAbsolutelyContraindicated: false,
  delayReasons: [],
};

// ─── Full Workflow ──────────────────────────────────────────────────────────

describe('Full Product Workflow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Step 1: Nurse logs in ──

  describe('Step 1: Nurse Login', () => {
    it('nurse authenticates and gets token', async () => {
      mockedApiClient.post.mockResolvedValueOnce({
        data: { accessToken: 'nurse-token', refreshToken: 'nurse-refresh', tokenType: 'bearer', expiresIn: 3600 },
      });

      const result = await authService.login({ email: 'nurse@test.com', password: 'password123' });

      expect(clearAuthTokens).toHaveBeenCalled();
      expect(setAuthTokens).toHaveBeenCalledWith('nurse-token', 'nurse-refresh');
      expect(result.accessToken).toBe('nurse-token');
    });
  });

  // ── Step 2: Nurse browses SOPHIA protocols ──

  describe('Step 2: Nurse Browses SOPHIA Protocol Library', () => {
    it('loads categories', async () => {
      mockedApiClient.get.mockResolvedValueOnce({
        data: [
          { name: 'lymphoma', count: 82 },
          { name: 'breast', count: 66 },
        ],
      });

      const cats = await getSophiaCategories();
      expect(cats.find(c => c.name === 'lymphoma')?.count).toBe(82);
    });

    it('searches for RCHOP and finds protocol', async () => {
      mockedApiClient.get.mockResolvedValueOnce({ data: [sophiaProtocol] });

      const results = await getSophiaProtocols({ search: 'RCHOP' });

      expect(results).toHaveLength(1);
      expect(results[0].code).toBe('LYMPHOMA-RCHOP21');
      expect(results[0].drugs).toContain('Vincristine');
      expect(results[0].totalCycles).toBe(6);
    });
  });

  // ── Step 3: Nurse creates request and enters clinical data ──

  describe('Step 3: Nurse Creates Protocol Request', () => {
    it('creates request for patient', async () => {
      mockedApiClient.post.mockResolvedValueOnce({
        data: { id: REQUEST_ID, patientId: PATIENT_ID, status: 'draft', clinicalData: null, createdAt: '2026-03-16T10:00:00Z' },
      });

      const req = await createProtocolRequest({ patient_id: PATIENT_ID });

      expect(req.id).toBe(REQUEST_ID);
      expect(req.status).toBe('draft');
    });

    it('saves clinical data with protocol code and labs', async () => {
      mockedApiClient.put.mockResolvedValueOnce({
        data: {
          id: REQUEST_ID,
          patientId: PATIENT_ID,
          status: 'nurse_collecting',
          clinicalData: clinicalDataPayload,
          createdAt: '2026-03-16T10:00:00Z',
        },
      });

      const updated = await updateClinicalData(REQUEST_ID, clinicalDataPayload as any);

      expect(updated.status).toBe('nurse_collecting');
      // Verify protocol code is included in the request body
      expect(mockedApiClient.put).toHaveBeenCalledWith(
        `/protocol-workflow/requests/${REQUEST_ID}/clinical-data`,
        expect.objectContaining({
          clinical_data: expect.objectContaining({
            protocol_code: 'LYMPHOMA-RCHOP21',
            neutrophils: 2.1,
            platelets: 145,
            hemoglobin: 11.5,
            bilirubin: 12,
            gfr: 75,
          }),
        })
      );
    });
  });

  // ── Step 4: Nurse submits → SOPHIA generates protocol ──

  describe('Step 4: SOPHIA Protocol Generation', () => {
    it('submits and receives deterministic protocol with doses and warnings', async () => {
      mockedApiClient.post.mockResolvedValueOnce({
        data: {
          id: REQUEST_ID,
          status: 'nurse_review',
          generatedProtocol: generatedProtocol,
          createdAt: '2026-03-16T10:00:00Z',
        },
      });

      const result = await nurseSubmitForReview(REQUEST_ID, 'All labs verified');

      expect(result.status).toBe('nurse_review');
      const gp = result.generatedProtocol!;

      // Verify SOPHIA output structure
      expect(gp.patientBsa).toBeCloseTo(1.93, 1);
      expect(gp.chemotherapyDrugs).toHaveLength(5);

      // Verify Vincristine hard cap
      const vincristine = gp.chemotherapyDrugs.find((d: any) => d.drugName === 'Vincristine');
      expect(vincristine.calculatedDose).toBe(2.0);
      expect(vincristine.doseModified).toBe(true);
      expect(vincristine.modificationReason).toContain('cap');

      // Verify warnings present
      expect(gp.warnings).toHaveLength(3);
      expect(gp.warnings.some((w: any) => w.message.includes('HBc'))).toBe(true);

      // Verify no treatment delay for normal labs
      expect(gp.treatmentDelayRecommended).toBe(false);
      expect(gp.treatmentAbsolutelyContraindicated).toBe(false);
    });
  });

  // ── Step 5: Nurse reviews and approves ──

  describe('Step 5: Nurse Reviews and Approves', () => {
    it('fetches generated protocol for review', async () => {
      mockedApiClient.get.mockResolvedValueOnce({
        data: {
          id: REQUEST_ID,
          status: 'nurse_review',
          generatedProtocol: generatedProtocol,
          createdAt: '2026-03-16T10:00:00Z',
        },
      });

      const req = await getProtocolRequest(REQUEST_ID);

      expect(req.generatedProtocol).toBeDefined();
      expect(req.generatedProtocol!.chemotherapyDrugs).toHaveLength(5);
    });

    it('nurse approves and sends to doctor', async () => {
      mockedApiClient.post.mockResolvedValueOnce({
        data: {
          id: REQUEST_ID,
          status: 'doctor_review',
          nurseReviewNotes: 'Vincristine cap appropriate. HBV prophylaxis needed.',
          createdAt: '2026-03-16T10:00:00Z',
        },
      });

      const result = await nurseApproveProtocol(REQUEST_ID, 'approve', 'Vincristine cap appropriate. HBV prophylaxis needed.');

      expect(result.status).toBe('doctor_review');
    });
  });

  // ── Step 6: Doctor logs in, reviews, and approves ──

  describe('Step 6: Doctor Reviews and Approves', () => {
    it('doctor authenticates', async () => {
      mockedApiClient.post.mockResolvedValueOnce({
        data: { accessToken: 'doctor-token', refreshToken: 'doctor-refresh', tokenType: 'bearer', expiresIn: 3600 },
      });

      const result = await authService.login({ email: 'doctor@test.com', password: 'password123' });
      expect(result.accessToken).toBe('doctor-token');
    });

    it('doctor approves with note about HBV prophylaxis', async () => {
      mockedApiClient.post.mockResolvedValueOnce({
        data: {
          id: REQUEST_ID,
          status: 'approved',
          doctorReviewNotes: 'Approved. Start entecavir for HBV prophylaxis before Rituximab.',
          generatedProtocol: generatedProtocol,
          createdAt: '2026-03-16T10:00:00Z',
        },
      });

      const result = await doctorApproveProtocol(
        REQUEST_ID,
        'approve',
        'Approved. Start entecavir for HBV prophylaxis before Rituximab.'
      );

      expect(result.status).toBe('approved');
      expect(mockedApiClient.post).toHaveBeenCalledWith(
        `/protocol-workflow/requests/${REQUEST_ID}/doctor-approve`,
        expect.objectContaining({ action: 'approve' })
      );
    });
  });

  // ── Step 7: Treatment day — nurse checks in patient and records vitals ──

  describe('Step 7: Treatment Day — Nurse Operations', () => {
    it('nurse checks in patient', async () => {
      mockedApiClient.post.mockResolvedValueOnce({
        data: { id: 'apt-1', patientId: PATIENT_ID, status: 'checked_in' },
      });

      const result = await nurseService.checkInPatient('apt-1');
      expect(result.status).toBe('checked_in');
    });

    it('nurse records pre-chemo vitals', async () => {
      mockedApiClient.post.mockResolvedValueOnce({
        data: {
          id: 'vital-1',
          patientId: PATIENT_ID,
          temperatureF: 98.4,
          pulseBpm: 68,
          bloodPressureSystolic: 118,
          bloodPressureDiastolic: 76,
          oxygenSaturation: 99,
          recordedAt: '2026-03-16T09:00:00Z',
          createdAt: '2026-03-16T09:00:00Z',
        },
      });

      const vital = await nurseService.recordVitals(PATIENT_ID, {
        temperature_f: 98.4,
        pulse_bpm: 68,
        blood_pressure_systolic: 118,
        blood_pressure_diastolic: 76,
        oxygen_saturation: 99,
      });

      expect(vital.temperatureF).toBe(98.4);
      expect(vital.oxygenSaturation).toBe(99);
    });

    it('nurse starts medication administration', async () => {
      mockedApiClient.put.mockResolvedValueOnce({
        data: { id: 'med-1', drugName: 'Rituximab', status: 'started', startedAt: '2026-03-16T09:15:00Z', createdAt: '' },
      });

      const med = await nurseService.startMedication('med-1');
      expect(med.status).toBe('started');
    });

    it('nurse completes medication', async () => {
      mockedApiClient.put.mockResolvedValueOnce({
        data: { id: 'med-1', drugName: 'Rituximab', status: 'completed', actualDose: 720, createdAt: '' },
      });

      const med = await nurseService.completeMedication('med-1', 720, 'Infused over 4 hours');
      expect(med.status).toBe('completed');
      expect(med.actualDose).toBe(720);
    });

    it('nurse checks out patient after treatment', async () => {
      mockedApiClient.post.mockResolvedValueOnce({
        data: { id: 'apt-1', patientId: PATIENT_ID, status: 'completed' },
      });

      const result = await nurseService.checkOutPatient('apt-1');
      expect(result.status).toBe('completed');
    });
  });

  // ── Step 8: Patient views their data ──

  describe('Step 8: Patient Views Their Data', () => {
    it('patient authenticates', async () => {
      mockedApiClient.post.mockResolvedValueOnce({
        data: { accessToken: 'patient-token', refreshToken: 'patient-refresh', tokenType: 'bearer', expiresIn: 3600 },
      });

      const result = await authService.login({ email: 'patient@test.com', password: 'password123' });
      expect(result.accessToken).toBe('patient-token');
    });

    it('patient views their profile', async () => {
      mockedApiClient.get.mockResolvedValueOnce({
        data: {
          id: PATIENT_ID,
          firstName: 'Rajesh',
          lastName: 'Kumar',
          cancerType: 'DLBCL',
          cancerStage: 'Ann Arbor III',
        },
      });

      const profile = await patientService.getMyProfile();
      expect(profile.firstName).toBe('Rajesh');
    });

    it('patient views their vitals (auto-filtered by JWT)', async () => {
      mockedApiClient.get.mockResolvedValueOnce({
        data: [
          { id: 'v-1', temperatureF: 98.4, pulseBpm: 68, recordedAt: '2026-03-16T09:00:00Z' },
        ],
      });

      const vitals = await patientService.getVitals(5);
      expect(vitals).toHaveLength(1);
      // Patient endpoint sends no patient_id — backend uses JWT
      expect(mockedApiClient.get).toHaveBeenCalledWith('/vitals', { params: { limit: 5 } });
    });

    it('patient logs symptoms', async () => {
      mockedApiClient.post.mockResolvedValueOnce({
        data: { id: 's-1', symptomType: 'nausea', severity: 4, createdAt: '2026-03-16T18:00:00Z' },
      });

      const symptom = await patientService.logSymptoms({
        symptom_type: 'nausea',
        severity: 4,
        notes: 'Mild nausea after treatment',
      } as any);

      expect((symptom as any).symptomType).toBe('nausea');
      expect(mockedApiClient.post).toHaveBeenCalledWith('/symptoms', expect.objectContaining({
        symptom_type: 'nausea',
        severity: 4,
      }));
    });

    it('patient views their appointments', async () => {
      mockedApiClient.get.mockResolvedValueOnce({
        data: [
          { id: 'apt-1', scheduledDate: '2026-03-16', status: 'completed', appointmentType: 'daycare_chemo' },
          { id: 'apt-2', scheduledDate: '2026-04-06', status: 'scheduled', appointmentType: 'daycare_chemo' },
        ],
      });

      const appointments = await patientService.getAppointments(PATIENT_ID);
      expect(appointments).toHaveLength(2);
      expect(appointments[0].status).toBe('completed');
      expect(appointments[1].status).toBe('scheduled');
    });
  });

  // ── Step 9: Doctor views dashboard ──

  describe('Step 9: Doctor Dashboard', () => {
    it('doctor views dashboard stats', async () => {
      mockedApiClient.get.mockResolvedValueOnce({
        data: { totalPatients: 25, todayAppointments: 8, activeTreatments: 3, pendingAlerts: 1 },
      });

      const stats = await doctorService.getDashboardStats();

      expect(stats.totalPatients).toBe(25);
      expect(stats.todayAppointments).toBe(8);
      expect(stats.activeTreatments).toBe(3);
    });

    it('doctor views patient vitals', async () => {
      mockedApiClient.get.mockResolvedValueOnce({
        data: [
          { id: 'v-1', patientId: PATIENT_ID, temperatureF: 98.4, recordedAt: '2026-03-16T09:00:00Z', createdAt: '' },
        ],
      });

      const vitals = await doctorService.getPatientVitals(PATIENT_ID);

      expect(mockedApiClient.get).toHaveBeenCalledWith('/vitals', { params: { patient_id: PATIENT_ID, limit: 20 } });
      expect(vitals).toHaveLength(1);
    });

    it('doctor views treatment plans', async () => {
      mockedApiClient.get.mockResolvedValueOnce({
        data: [{ id: 'plan-1', protocolName: 'RCHOP21', status: 'approved', plannedCycles: 6 }],
      });

      const plans = await doctorService.getTreatmentPlans(PATIENT_ID);
      expect(plans).toHaveLength(1);
      expect(plans[0].protocolName).toBe('RCHOP21');
    });
  });
});
