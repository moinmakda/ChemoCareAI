/**
 * Protocol Service Tests
 *
 * Tests SOPHIA protocol library browsing and the full protocol workflow:
 * - Protocol search and category filtering
 * - Protocol request creation
 * - Clinical data updates (with SOPHIA-required fields)
 * - Nurse submit → SOPHIA protocol generation
 * - Nurse approve/reject
 * - Doctor approve/modify/reject
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
import {
  getSophiaProtocols,
  getSophiaCategories,
  getSophiaProtocolDetail,
  getSophiaProtocolDrugs,
  createProtocolRequest,
  getProtocolRequest,
  getProtocolRequests,
  updateClinicalData,
  nurseSubmitForReview,
  nurseApproveProtocol,
  doctorApproveProtocol,
  getPendingApprovals,
  getWorkflowStatus,
} from '../../services/protocolService';

const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;

// ─── Mock Data ──────────────────────────────────────────────────────────────

const mockSophiaProtocols = [
  {
    id: 'lymphoma-rchop21',
    code: 'LYMPHOMA-RCHOP21',
    name: 'RCHOP21 - Rituximab-Cyclophosphamide-Doxorubicin-Prednisolone-Vincristine',
    indication: 'B-cell non-Hodgkin lymphoma',
    drugs: ['Rituximab', 'Cyclophosphamide', 'Doxorubicin', 'Vincristine', 'Prednisolone'],
    cycleLengthDays: 21,
    totalCycles: 6,
    category: 'lymphoma',
  },
  {
    id: 'crc-folfox',
    code: 'CRC-FOLFOX',
    name: 'FOLFOX - Fluorouracil, Folinic Acid and Oxaliplatin',
    indication: 'Colorectal cancer',
    drugs: ['Fluorouracil', 'Folinic Acid', 'Oxaliplatin'],
    cycleLengthDays: 14,
    totalCycles: 12,
    category: 'gastrointestinal',
  },
];

const mockCategories = [
  { name: 'breast', count: 66 },
  { name: 'lymphoma', count: 82 },
  { name: 'lung', count: 59 },
  { name: 'gastrointestinal', count: 56 },
];

const mockGeneratedProtocol = {
  protocolName: 'RCHOP21',
  protocolCode: 'LYMPHOMA-RCHOP21',
  cycleLengthDays: 21,
  totalCycles: 6,
  cycleNumber: 1,
  patientBsa: 1.91,
  patientBsaCapped: false,
  patientWeight: 75,
  patientAge: 55,
  chemotherapyDrugs: [
    {
      drugName: 'Rituximab',
      calculatedDose: 716.2,
      calculatedDoseUnit: 'mg',
      route: 'IV infusion',
      days: [1],
      durationMinutes: 360,
      doseModified: false,
    },
    {
      drugName: 'Vincristine',
      calculatedDose: 2.0,
      calculatedDoseUnit: 'mg',
      route: 'IV bolus',
      days: [1],
      doseModified: true,
      modificationReason: 'Max dose cap: 2.0 mg (calculated: 2.67 mg)',
    },
  ],
  preMedications: [],
  takeHomeMedicines: [],
  rescueMedications: [],
  warnings: [
    { level: 'warning', message: 'HBV serology not recorded — required before Rituximab' },
    { level: 'warning', message: 'Vincristine capped at 2.0 mg' },
  ],
  doseModificationsApplied: ['Vincristine: capped at 2.0mg (was 2.67mg)'],
  monitoringRequirements: [],
  treatmentDelayRecommended: false,
  treatmentAbsolutelyContraindicated: false,
  delayReasons: [],
};

const mockProtocolRequest = {
  id: 'req-123',
  patientId: 'patient-1',
  status: 'draft',
  clinicalData: null,
  generatedProtocol: null,
  createdAt: '2026-03-16T10:00:00Z',
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Protocol Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── SOPHIA Protocol Library ──

  describe('SOPHIA Protocol Library', () => {
    it('lists all protocols', async () => {
      mockedApiClient.get.mockResolvedValueOnce({ data: mockSophiaProtocols });

      const result = await getSophiaProtocols();

      expect(mockedApiClient.get).toHaveBeenCalledWith('/sophia-protocols', { params: undefined });
      expect(result).toHaveLength(2);
      expect(result[0].code).toBe('LYMPHOMA-RCHOP21');
    });

    it('searches protocols by keyword', async () => {
      mockedApiClient.get.mockResolvedValueOnce({ data: [mockSophiaProtocols[0]] });

      const result = await getSophiaProtocols({ search: 'RCHOP' });

      expect(mockedApiClient.get).toHaveBeenCalledWith('/sophia-protocols', {
        params: { search: 'RCHOP' },
      });
      expect(result).toHaveLength(1);
      expect(result[0].drugs).toContain('Rituximab');
    });

    it('filters protocols by category', async () => {
      mockedApiClient.get.mockResolvedValueOnce({ data: [mockSophiaProtocols[1]] });

      const result = await getSophiaProtocols({ category: 'gastrointestinal' });

      expect(mockedApiClient.get).toHaveBeenCalledWith('/sophia-protocols', {
        params: { category: 'gastrointestinal' },
      });
      expect(result[0].category).toBe('gastrointestinal');
    });

    it('gets protocol categories with counts', async () => {
      mockedApiClient.get.mockResolvedValueOnce({ data: mockCategories });

      const result = await getSophiaCategories();

      expect(mockedApiClient.get).toHaveBeenCalledWith('/sophia-protocols/categories');
      expect(result).toHaveLength(4);
      expect(result.find(c => c.name === 'lymphoma')?.count).toBe(82);
    });

    it('gets protocol detail by code', async () => {
      const mockDetail = { protocolCode: 'LYMPHOMA-RCHOP21', drugs: [{}, {}, {}, {}, {}] };
      mockedApiClient.get.mockResolvedValueOnce({ data: mockDetail });

      const result = await getSophiaProtocolDetail('LYMPHOMA-RCHOP21');

      expect(mockedApiClient.get).toHaveBeenCalledWith('/sophia-protocols/LYMPHOMA-RCHOP21');
      expect(result.drugs).toHaveLength(5);
    });

    it('gets protocol drugs grouped by category', async () => {
      const mockDrugs = {
        protocolCode: 'LYMPHOMA-RCHOP21',
        coreDrugs: [{}, {}, {}, {}, {}],
        preMedications: [{}, {}, {}],
        takeHomeMedicines: [{}, {}],
        rescueMedications: [{}],
      };
      mockedApiClient.get.mockResolvedValueOnce({ data: mockDrugs });

      const result = await getSophiaProtocolDrugs('LYMPHOMA-RCHOP21');

      expect(result.coreDrugs).toHaveLength(5);
      expect(result.preMedications).toHaveLength(3);
    });
  });

  // ── Protocol Request CRUD ──

  describe('Protocol Request CRUD', () => {
    it('creates a new protocol request', async () => {
      mockedApiClient.post.mockResolvedValueOnce({ data: mockProtocolRequest });

      const result = await createProtocolRequest({ patient_id: 'patient-1' });

      expect(mockedApiClient.post).toHaveBeenCalledWith('/protocol-workflow/requests', {
        patient_id: 'patient-1',
      });
      expect(result.id).toBe('req-123');
      expect(result.status).toBe('draft');
    });

    it('gets a specific protocol request', async () => {
      mockedApiClient.get.mockResolvedValueOnce({ data: mockProtocolRequest });

      const result = await getProtocolRequest('req-123');

      expect(mockedApiClient.get).toHaveBeenCalledWith('/protocol-workflow/requests/req-123');
      expect(result.patientId).toBe('patient-1');
    });

    it('lists protocol requests with filters', async () => {
      const mockList = { items: [mockProtocolRequest], total: 1, page: 1, pageSize: 20 };
      mockedApiClient.get.mockResolvedValueOnce({ data: mockList });

      const result = await getProtocolRequests({ status_filter: 'nurse_review' });

      expect(mockedApiClient.get).toHaveBeenCalledWith('/protocol-workflow/requests', {
        params: { status_filter: 'nurse_review' },
      });
      expect(result.items).toHaveLength(1);
    });
  });

  // ── Clinical Data Update ──

  describe('Clinical Data Updates', () => {
    it('updates clinical data with SOPHIA-required fields', async () => {
      const updatedRequest = {
        ...mockProtocolRequest,
        status: 'nurse_collecting',
        clinicalData: {
          protocolCode: 'LYMPHOMA-RCHOP21',
          heightCm: 175,
          weightKg: 75,
          neutrophils: 2.5,
          platelets: 150,
          hemoglobin: 12.0,
          bilirubin: 15,
          gfr: 85,
        },
      };
      mockedApiClient.put.mockResolvedValueOnce({ data: updatedRequest });

      const result = await updateClinicalData('req-123', {
        protocol_code: 'LYMPHOMA-RCHOP21',
        height_cm: 175,
        weight_kg: 75,
        neutrophils: 2.5,
        platelets: 150,
        hemoglobin: 12.0,
        bilirubin: 15,
        gfr: 85,
      });

      expect(mockedApiClient.put).toHaveBeenCalledWith(
        '/protocol-workflow/requests/req-123/clinical-data',
        expect.objectContaining({
          clinical_data: expect.objectContaining({
            protocol_code: 'LYMPHOMA-RCHOP21',
            neutrophils: 2.5,
          }),
        })
      );
      expect(result.status).toBe('nurse_collecting');
    });

    it('updates clinical data with allergy information', async () => {
      const updatedRequest = {
        ...mockProtocolRequest,
        clinicalData: { knownAllergies: ['platinum', 'rituximab'] },
      };
      mockedApiClient.put.mockResolvedValueOnce({ data: updatedRequest });

      await updateClinicalData('req-123', {
        known_allergies: ['platinum', 'rituximab'],
      } as any);

      expect(mockedApiClient.put).toHaveBeenCalledWith(
        '/protocol-workflow/requests/req-123/clinical-data',
        expect.objectContaining({
          clinical_data: expect.objectContaining({
            known_allergies: ['platinum', 'rituximab'],
          }),
        })
      );
    });
  });

  // ── Nurse Workflow ──

  describe('Nurse Workflow', () => {
    it('submits for SOPHIA protocol generation', async () => {
      const generatedRequest = {
        ...mockProtocolRequest,
        status: 'nurse_review',
        generatedProtocol: mockGeneratedProtocol,
      };
      mockedApiClient.post.mockResolvedValueOnce({ data: generatedRequest });

      const result = await nurseSubmitForReview('req-123', 'Labs verified');

      expect(mockedApiClient.post).toHaveBeenCalledWith(
        '/protocol-workflow/requests/req-123/nurse-submit',
        null,
        { params: { notes: 'Labs verified' } }
      );
      expect(result.status).toBe('nurse_review');
      expect(result.generatedProtocol).toBeDefined();
    });

    it('nurse approves and sends to doctor', async () => {
      const approvedRequest = { ...mockProtocolRequest, status: 'doctor_review' };
      mockedApiClient.post.mockResolvedValueOnce({ data: approvedRequest });

      const result = await nurseApproveProtocol('req-123', 'approve', 'Looks correct');

      expect(mockedApiClient.post).toHaveBeenCalledWith(
        '/protocol-workflow/requests/req-123/nurse-approve',
        { action: 'approve', notes: 'Looks correct' }
      );
      expect(result.status).toBe('doctor_review');
    });

    it('nurse rejects and sends back for data collection', async () => {
      const rejectedRequest = { ...mockProtocolRequest, status: 'nurse_collecting' };
      mockedApiClient.post.mockResolvedValueOnce({ data: rejectedRequest });

      const result = await nurseApproveProtocol('req-123', 'reject', 'Missing labs');

      expect(mockedApiClient.post).toHaveBeenCalledWith(
        '/protocol-workflow/requests/req-123/nurse-approve',
        { action: 'reject', notes: 'Missing labs' }
      );
      expect(result.status).toBe('nurse_collecting');
    });
  });

  // ── Doctor Workflow ──

  describe('Doctor Workflow', () => {
    it('doctor approves protocol', async () => {
      const approvedRequest = { ...mockProtocolRequest, status: 'approved' };
      mockedApiClient.post.mockResolvedValueOnce({ data: approvedRequest });

      const result = await doctorApproveProtocol('req-123', 'approve', 'Approved');

      expect(mockedApiClient.post).toHaveBeenCalledWith(
        '/protocol-workflow/requests/req-123/doctor-approve',
        { action: 'approve', notes: 'Approved', modified_protocol: undefined }
      );
      expect(result.status).toBe('approved');
    });

    it('doctor modifies and approves protocol', async () => {
      const modifiedProtocol = { ...mockGeneratedProtocol, totalCycles: 4 };
      const approvedRequest = {
        ...mockProtocolRequest,
        status: 'approved',
        generatedProtocol: modifiedProtocol,
      };
      mockedApiClient.post.mockResolvedValueOnce({ data: approvedRequest });

      const result = await doctorApproveProtocol(
        'req-123',
        'modify',
        'Reduced cycles to 4',
        modifiedProtocol
      );

      expect(mockedApiClient.post).toHaveBeenCalledWith(
        '/protocol-workflow/requests/req-123/doctor-approve',
        {
          action: 'modify',
          notes: 'Reduced cycles to 4',
          modified_protocol: modifiedProtocol,
        }
      );
      expect(result.status).toBe('approved');
    });

    it('doctor rejects protocol', async () => {
      const rejectedRequest = { ...mockProtocolRequest, status: 'rejected' };
      mockedApiClient.post.mockResolvedValueOnce({ data: rejectedRequest });

      const result = await doctorApproveProtocol('req-123', 'reject', 'Wrong protocol');

      expect(result.status).toBe('rejected');
    });
  });

  // ── Workflow Status & Pending Approvals ──

  describe('Workflow Status', () => {
    it('gets workflow status', async () => {
      const mockStatus = {
        requestId: 'req-123',
        currentStatus: 'doctor_review',
        dataCollectionComplete: true,
        nurseReviewComplete: true,
        doctorReviewComplete: false,
        pendingActionBy: 'doctor',
      };
      mockedApiClient.get.mockResolvedValueOnce({ data: mockStatus });

      const result = await getWorkflowStatus('req-123');

      expect(result.pendingActionBy).toBe('doctor');
      expect(result.nurseReviewComplete).toBe(true);
    });

    it('gets pending approvals by role', async () => {
      const mockPending = {
        nursePending: [mockProtocolRequest],
        doctorPending: [],
        totalPending: 1,
      };
      mockedApiClient.get.mockResolvedValueOnce({ data: mockPending });

      const result = await getPendingApprovals();

      expect(result.totalPending).toBe(1);
      expect(result.nursePending).toHaveLength(1);
    });
  });
});
