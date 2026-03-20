/**
 * Protocol Workflow Service
 * 
 * Handles protocol requests, document upload with AI extraction,
 * and nurse/doctor approval workflows.
 */
import api, { apiClient } from './api';

// Types
export interface LabReport {
  report_date?: string;
  report_type?: string;
  gfr?: number;
  creatinine?: number;
  bilirubin?: number;
  hba1c?: number;
  glucose?: number;
  ldh?: number;
  esr?: number;
  calcium?: number;
  vitamin_d?: number;
  full_blood_count?: {
    wbc?: number;
    hb?: number;
    platelets?: number;
    neutrophils?: number;
  };
  liver_function?: {
    alt?: number;
    ast?: number;
    alp?: number;
    ggt?: number;
    bilirubin?: number;
  };
}

export interface MedicalHistory {
  allergies: string[];
  comorbidities: string[];
  current_medications: string[];
  prior_chemo_regimens: string[];
  prior_radiation?: string;
  surgical_history: string[];
  family_cancer_history: string[];
  ecog_score?: number;
  karnofsky_score?: number;
}

export interface ClinicalDataCollection {
  protocol_code?: string;
  height_cm?: number;
  weight_kg?: number;
  bsa?: number;
  cancer_type?: string;
  cancer_subtype?: string;
  disease_stage?: string;
  histology?: string;
  molecular_markers?: Record<string, any>;
  lab_reports: LabReport[];
  latest_labs?: LabReport;
  medical_history?: MedicalHistory;
  current_symptoms: string[];
  performance_status?: string;
  neutrophils?: number;
  platelets?: number;
  hemoglobin?: number;
  bilirubin?: number;
  gfr?: number;
}

// All interfaces use camelCase — api.ts interceptor converts all response keys
export interface ProtocolRequest {
  id: string;
  patientId: string;
  protocolTemplateId?: number;
  status: string;
  clinicalData?: Record<string, any>;
  nurseCollectedData?: Record<string, any>;
  nurseReviewNotes?: string;
  nurseReviewedById?: string;
  nurseReviewedAt?: string;
  doctorReviewNotes?: string;
  doctorReviewedById?: string;
  doctorReviewedAt?: string;
  generatedProtocol?: Record<string, any>;
  createdAt: string;
  updatedAt?: string;
}

export interface DocumentUploadResponse {
  documentId: number;
  documentType: string;
  extractionSuccess: boolean;
  extractedData?: Record<string, any>;
  clinicalDataUpdates?: Record<string, any>;
  needsVerification: boolean;
  overallConfidence: number;
  message: string;
}

export interface ProtocolGenerationResponse {
  success: boolean;
  protocol?: Record<string, any>;
  aiRecommendations?: string[];
  warnings?: string[];
  message: string;
}

export interface WorkflowStatus {
  requestId: number;
  currentStatus: string;
  dataCollectionComplete: boolean;
  nurseReviewComplete: boolean;
  doctorReviewComplete: boolean;
  pendingActionBy?: 'nurse' | 'doctor';
  createdAt: string;
  lastUpdated?: string;
}

export interface PendingApprovals {
  nursePending: ProtocolRequest[];
  doctorPending: ProtocolRequest[];
  totalPending: number;
}

// =============================================================================
// SOPHIA Protocol Library Types & Functions
// =============================================================================

export interface SophiaProtocol {
  id: string;
  code: string;
  name: string;
  indication: string;
  drugs: string[];
  cycleLengthDays: number;
  totalCycles: number;
  category: string;
  source?: string;
  referenceUrl?: string;
}

export interface SophiaProtocolCategory {
  name: string;
  count: number;
}

/**
 * List all SOPHIA protocols with optional search and category filter.
 * Used by the protocol selector dropdown.
 */
export const getSophiaProtocols = async (params?: {
  search?: string;
  category?: string;
}): Promise<SophiaProtocol[]> => {
  const response = await apiClient.get('/sophia-protocols', { params });
  return response.data;
};

/**
 * Get SOPHIA protocol categories with counts.
 */
export const getSophiaCategories = async (): Promise<SophiaProtocolCategory[]> => {
  const response = await apiClient.get('/sophia-protocols/categories');
  return response.data;
};

/**
 * Get full SOPHIA protocol detail by code.
 */
export const getSophiaProtocolDetail = async (protocolCode: string): Promise<Record<string, any>> => {
  const response = await apiClient.get(`/sophia-protocols/${protocolCode}`);
  return response.data;
};

/**
 * Get all drugs in a SOPHIA protocol.
 */
export const getSophiaProtocolDrugs = async (protocolCode: string): Promise<{
  protocolCode: string;
  protocolName: string;
  coreDrugs: Record<string, any>[];
  preMedications: Record<string, any>[];
  takeHomeMedicines: Record<string, any>[];
  rescueMedications: Record<string, any>[];
}> => {
  const response = await apiClient.get(`/sophia-protocols/${protocolCode}/drugs`);
  return response.data;
};


// =============================================================================
// Protocol Workflow API Functions
// =============================================================================

/**
 * Create a new protocol request
 */
export const createProtocolRequest = async (data: {
  patient_id: string;
  protocol_template_id?: number;
  notes?: string;
}): Promise<ProtocolRequest> => {
  const response = await apiClient.post('/protocol-workflow/requests', data);
  return response.data;
};

/**
 * Get all protocol requests with optional filters
 */
export const getProtocolRequests = async (params?: {
  status_filter?: string;
  patient_id?: string;
  page?: number;
  page_size?: number;
}): Promise<{ items: ProtocolRequest[]; total: number; page: number; page_size: number }> => {
  const response = await apiClient.get('/protocol-workflow/requests', { params });
  return response.data;
};

/**
 * Get a specific protocol request
 */
export const getProtocolRequest = async (requestId: string): Promise<ProtocolRequest> => {
  const response = await apiClient.get(`/protocol-workflow/requests/${requestId}`);
  return response.data;
};

/**
 * Upload a document with AI extraction
 */
export const uploadDocumentWithExtraction = async (
  requestId: string,
  file: FormData
): Promise<DocumentUploadResponse> => {
  const response = await apiClient.post(
    `/protocol-workflow/requests/${requestId}/upload-document`,
    file,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return response.data;
};

/**
 * Update clinical data for a protocol request
 */
export const updateClinicalData = async (
  requestId: string,
  clinicalData: Partial<ClinicalDataCollection>
): Promise<ProtocolRequest> => {
  const response = await apiClient.put(`/protocol-workflow/requests/${requestId}/clinical-data`, {
    clinical_data: clinicalData,
  });
  return response.data;
};

/**
 * Nurse submits collected data for review and protocol generation
 */
export const nurseSubmitForReview = async (
  requestId: string,
  notes?: string
): Promise<ProtocolRequest> => {
  const response = await apiClient.post(`/protocol-workflow/requests/${requestId}/nurse-submit`, null, {
    params: { notes },
  });
  return response.data;
};

/**
 * Nurse approves or rejects protocol
 */
export const nurseApproveProtocol = async (
  requestId: string,
  action: 'approve' | 'reject',
  notes?: string
): Promise<ProtocolRequest> => {
  const response = await apiClient.post(`/protocol-workflow/requests/${requestId}/nurse-approve`, {
    action,
    notes,
  });
  return response.data;
};

/**
 * Doctor approves, modifies, or rejects protocol
 */
export const doctorApproveProtocol = async (
  requestId: string,
  action: 'approve' | 'reject' | 'modify',
  notes?: string,
  modifiedProtocol?: Record<string, any>
): Promise<ProtocolRequest> => {
  const response = await apiClient.post(`/protocol-workflow/requests/${requestId}/doctor-approve`, {
    action,
    notes,
    modified_protocol: modifiedProtocol,
  });
  return response.data;
};

/**
 * Get workflow status for a protocol request
 */
export const getWorkflowStatus = async (requestId: string): Promise<WorkflowStatus> => {
  const response = await apiClient.get(`/protocol-workflow/requests/${requestId}/status`);
  return response.data;
};

/**
 * Get pending approvals for the current user
 */
export const getPendingApprovals = async (): Promise<PendingApprovals> => {
  const response = await apiClient.get('/protocol-workflow/pending-approvals');
  return response.data;
};
