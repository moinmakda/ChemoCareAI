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
}

export interface ProtocolRequest {
  id: string;
  patient_id: string;
  protocol_template_id?: number;
  status: 'draft' | 'pending_nurse_approval' | 'nurse_approved' | 'pending_doctor_approval' | 'approved' | 'rejected';
  clinical_data?: ClinicalDataCollection;
  nurse_collected_data?: Record<string, any>;
  nurse_review_notes?: string;
  nurse_reviewed_by_id?: string;
  nurse_reviewed_at?: string;
  doctor_review_notes?: string;
  doctor_reviewed_by_id?: string;
  doctor_reviewed_at?: string;
  generated_protocol?: Record<string, any>;
  created_at: string;
  updated_at?: string;
}

export interface DocumentUploadResponse {
  document_id: number;
  document_type: string;
  extraction_success: boolean;
  extracted_data?: Record<string, any>;
  clinical_data_updates?: Record<string, any>;
  needs_verification: boolean;
  overall_confidence: number;
  message: string;
}

export interface ProtocolGenerationResponse {
  success: boolean;
  protocol?: Record<string, any>;
  ai_recommendations?: string[];
  warnings?: string[];
  message: string;
}

export interface WorkflowStatus {
  request_id: number;
  current_status: string;
  data_collection_complete: boolean;
  nurse_review_complete: boolean;
  doctor_review_complete: boolean;
  pending_action_by?: 'nurse' | 'doctor';
  created_at: string;
  last_updated?: string;
}

export interface PendingApprovals {
  nurse_pending: ProtocolRequest[];
  doctor_pending: ProtocolRequest[];
  total_pending: number;
}

// API Functions

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
