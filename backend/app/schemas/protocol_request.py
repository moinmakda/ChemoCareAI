"""
Protocol Request Schemas

Defines Pydantic schemas for the protocol request workflow:
- Creating protocol requests
- Updating clinical data
- Approval workflow
- Response models
"""
from datetime import datetime, date
from typing import Dict, Any, Optional, List
from uuid import UUID
from pydantic import BaseModel, Field
from enum import Enum


# =============================================================================
# ENUMS
# =============================================================================

class ProtocolRequestStatusEnum(str, Enum):
    """Protocol request status enum for API."""
    DRAFT = "draft"
    NURSE_COLLECTING = "nurse_collecting"
    NURSE_REVIEW = "nurse_review"
    DOCTOR_REVIEW = "doctor_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    # Legacy aliases
    PENDING_DATA = "pending_data"
    PENDING_GENERATION = "pending_generation"
    GENERATED = "generated"
    PENDING_NURSE_APPROVAL = "pending_nurse_approval"
    NURSE_APPROVED = "nurse_approved"
    PENDING_DOCTOR_APPROVAL = "pending_doctor_approval"
    REVISION_NEEDED = "revision_needed"


# =============================================================================
# CLINICAL DATA SCHEMAS
# =============================================================================

class LabReportBase(BaseModel):
    """Base lab report schema."""
    report_date: Optional[date] = None
    report_type: Optional[str] = None
    
    # Core values
    gfr: Optional[float] = Field(None, description="GFR (eGFR)")
    creatinine: Optional[float] = Field(None, description="Serum creatinine")
    bilirubin: Optional[float] = Field(None, description="Total bilirubin")
    hba1c: Optional[float] = Field(None, description="HbA1c")
    glucose: Optional[float] = Field(None, description="Blood glucose")
    ldh: Optional[float] = Field(None, description="LDH")
    esr: Optional[float] = Field(None, description="ESR")
    urate: Optional[float] = Field(None, description="Uric acid")
    calcium: Optional[float] = Field(None, description="Calcium")
    vitamin_d: Optional[float] = Field(None, description="Vitamin D")
    magnesium: Optional[float] = Field(None, description="Magnesium")
    b2_microglobulin: Optional[float] = Field(None, description="Beta-2 microglobulin")
    
    # Panels as nested dicts
    full_blood_count: Optional[Dict[str, float]] = Field(
        None, 
        description="FBC: wbc, hb, platelets, neutrophils"
    )
    liver_function: Optional[Dict[str, float]] = Field(
        None, 
        description="LFT: alt, ast, alp, ggt, bilirubin"
    )
    urea_electrolytes: Optional[Dict[str, float]] = Field(
        None, 
        description="U&E: sodium, potassium, urea"
    )
    immunoglobulins: Optional[Dict[str, float]] = Field(
        None, 
        description="Igs: igg, iga, igm"
    )
    
    # Viral markers
    hep_b_core: Optional[bool] = None
    hep_b_surface: Optional[bool] = None
    hep_c_antibody: Optional[bool] = None


class MedicalHistoryBase(BaseModel):
    """Base medical history schema."""
    allergies: List[str] = Field(default=[])
    comorbidities: List[str] = Field(default=[])
    current_medications: List[str] = Field(default=[])
    prior_chemo_regimens: List[str] = Field(default=[])
    prior_radiation: Optional[str] = None
    surgical_history: List[str] = Field(default=[])
    family_cancer_history: List[str] = Field(default=[])
    ecog_score: Optional[int] = Field(None, ge=0, le=5)
    karnofsky_score: Optional[int] = Field(None, ge=0, le=100)


class ClinicalDataCollectionBase(BaseModel):
    """Base clinical data collection schema (extended for SOPHIA engine)."""
    # SOPHIA protocol selection
    protocol_code: Optional[str] = Field(None, description="SOPHIA protocol code (e.g., LYMPHOMA-RCHOP21)")
    cycle_number: Optional[int] = Field(None, ge=1, description="Current cycle number")
    excluded_drugs: Optional[List[str]] = Field(default=None, description="Drug IDs to exclude")

    # Patient measurements
    height_cm: Optional[float] = Field(None, ge=50, le=300)
    weight_kg: Optional[float] = Field(None, ge=10, le=500)
    bsa: Optional[float] = Field(None, description="Calculated BSA")

    # Cancer details
    cancer_type: Optional[str] = None
    cancer_subtype: Optional[str] = None
    disease_stage: Optional[str] = None
    histology: Optional[str] = None
    molecular_markers: Optional[Dict[str, Any]] = None

    # SOPHIA mandatory labs (individual values for dose calculations)
    neutrophils: Optional[float] = Field(None, description="Neutrophils x10^9/L")
    platelets: Optional[float] = Field(None, description="Platelets x10^9/L")
    hemoglobin: Optional[float] = Field(None, description="Haemoglobin g/dL")
    bilirubin: Optional[float] = Field(None, description="Bilirubin umol/L")
    gfr: Optional[float] = Field(None, description="GFR / CrCl ml/min")
    creatinine: Optional[float] = Field(None, description="Serum creatinine umol/L")

    # Optional labs
    ast: Optional[float] = Field(None, description="AST U/L")
    alt: Optional[float] = Field(None, description="ALT U/L")
    ldh: Optional[float] = Field(None, description="LDH U/L")

    # Lab panels (nested dicts from document extraction)
    full_blood_count: Optional[Dict[str, float]] = Field(None, description="FBC: wbc, hb, platelets, neutrophils")
    liver_function: Optional[Dict[str, float]] = Field(None, description="LFT: alt, ast, alp, ggt, bilirubin")
    urea_electrolytes: Optional[Dict[str, float]] = Field(None, description="U&E: sodium, potassium, urea")
    immunoglobulins: Optional[Dict[str, float]] = Field(None, description="Igs: igg, iga, igm")

    # Lab reports (structured)
    lab_reports: List[LabReportBase] = Field(default=[])
    latest_labs: Optional[LabReportBase] = None

    # Safety assessment
    known_allergies: Optional[List[str]] = Field(default=None, description="Known drug allergies")
    active_infection: Optional[bool] = Field(None, description="Active infection / fever")
    pregnancy_status: Optional[str] = Field(None, description="not_pregnant, pregnant, unknown, not_applicable")
    tls_risk: Optional[str] = Field(None, description="Tumor lysis risk: low, intermediate, high")
    lvef_percent: Optional[float] = Field(None, description="Left ventricular ejection fraction %")
    peripheral_neuropathy_grade: Optional[int] = Field(None, ge=0, le=4, description="CTCAE neuropathy grade")
    prior_anthracycline_dose: Optional[float] = Field(None, description="Lifetime anthracycline mg/m2")
    prior_cardiac_history: Optional[bool] = None

    # Virology (string: positive/negative/unknown)
    hep_b_surface: Optional[str] = None
    hep_b_core: Optional[str] = None
    hep_c_antibody: Optional[str] = None

    # History
    medical_history: Optional[MedicalHistoryBase] = None

    # Current status
    current_symptoms: List[str] = Field(default=[])
    performance_status: Optional[str] = None


# =============================================================================
# PROTOCOL REQUEST SCHEMAS
# =============================================================================

class ProtocolRequestCreate(BaseModel):
    """Create a new protocol request."""
    patient_id: UUID
    protocol_template_id: Optional[UUID] = None
    notes: Optional[str] = None


class ProtocolRequestUpdate(BaseModel):
    """Update protocol request."""
    notes: Optional[str] = None
    protocol_template_id: Optional[UUID] = None


class ClinicalDataUpdate(BaseModel):
    """Update clinical data collection."""
    clinical_data: ClinicalDataCollectionBase


class NurseApproval(BaseModel):
    """Nurse approval/rejection."""
    action: str = Field(..., pattern="^(approve|reject)$")
    notes: Optional[str] = None


class DoctorApproval(BaseModel):
    """Doctor approval/rejection with optional modifications."""
    action: str = Field(..., pattern="^(approve|reject|modify)$")
    notes: Optional[str] = None
    modified_protocol: Optional[Dict[str, Any]] = Field(
        None,
        description="Modified protocol if action is 'modify'"
    )


# =============================================================================
# DOCUMENT UPLOAD SCHEMAS
# =============================================================================

class DocumentUploadResponse(BaseModel):
    """Response after document upload and extraction."""
    document_id: UUID
    document_type: str
    extraction_success: bool
    extracted_data: Optional[Dict[str, Any]] = None
    clinical_data_updates: Optional[Dict[str, Any]] = None
    needs_verification: bool = False
    overall_confidence: float = 0.0
    message: str


# =============================================================================
# RESPONSE SCHEMAS
# =============================================================================

class ApprovalStepResponse(BaseModel):
    """Approval step in response."""
    step: str
    approved_by_id: Optional[UUID] = None
    approved_by_role: Optional[str] = None
    approved_at: Optional[datetime] = None
    notes: Optional[str] = None
    status: str = "pending"


class ProtocolRequestResponse(BaseModel):
    """Protocol request response."""
    id: UUID
    patient_id: UUID
    protocol_template_id: Optional[UUID] = None
    
    status: ProtocolRequestStatusEnum
    clinical_data: Optional[Dict[str, Any]] = None
    
    # Nurse data
    nurse_collected_data: Optional[Dict[str, Any]] = None
    nurse_review_notes: Optional[str] = None
    nurse_reviewed_by_id: Optional[UUID] = None
    nurse_reviewed_at: Optional[datetime] = None
    
    # Doctor data
    doctor_review_notes: Optional[str] = None
    doctor_reviewed_by_id: Optional[UUID] = None
    doctor_reviewed_at: Optional[datetime] = None
    
    # Generated protocol
    generated_protocol: Optional[Dict[str, Any]] = None
    
    # Metadata
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class ProtocolRequestListResponse(BaseModel):
    """List of protocol requests."""
    items: List[ProtocolRequestResponse]
    total: int
    page: int
    page_size: int


class ProtocolGenerationResponse(BaseModel):
    """Response after AI protocol generation."""
    success: bool
    protocol: Optional[Dict[str, Any]] = None
    ai_recommendations: Optional[List[str]] = None
    warnings: Optional[List[str]] = None
    message: str


# =============================================================================
# WORKFLOW STATUS SCHEMAS
# =============================================================================

class WorkflowStatusResponse(BaseModel):
    """Current workflow status for a protocol request."""
    request_id: str
    current_status: ProtocolRequestStatusEnum
    
    # Stage completion
    data_collection_complete: bool = False
    nurse_review_complete: bool = False
    doctor_review_complete: bool = False
    
    # Who needs to act
    pending_action_by: Optional[str] = None  # "nurse" or "doctor" or None
    
    # Timeline
    created_at: datetime
    last_updated: Optional[datetime] = None
    estimated_completion: Optional[datetime] = None


class PendingApprovalsResponse(BaseModel):
    """Pending approvals for a user."""
    nurse_pending: List[ProtocolRequestResponse] = []
    doctor_pending: List[ProtocolRequestResponse] = []
    total_pending: int = 0
