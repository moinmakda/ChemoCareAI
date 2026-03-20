"""
Pydantic schemas for treatment plans and protocols.
"""
from datetime import date, datetime
from typing import Optional, List, Any, Dict
from uuid import UUID
from pydantic import BaseModel
from app.models.treatment import PlanStatus, CycleStatus, AdminStatus


# Protocol Template Schemas
class DrugSchema(BaseModel):
    """Schema for a drug in a protocol."""
    drug_name: str
    generic_name: Optional[str] = None
    dose_per_m2: float
    unit: str
    route: str
    infusion_duration_mins: Optional[int] = None
    days: List[int]
    dilution: Optional[str] = None
    special_instructions: Optional[str] = None
    max_lifetime_dose: Optional[float] = None
    max_lifetime_dose_m2: Optional[float] = None


class MedicationSchema(BaseModel):
    """Schema for pre/post medications."""
    drug_name: str
    dose: str
    route: str
    timing: str


class DoseModificationRule(BaseModel):
    """Schema for dose modification rules."""
    parameter: str
    condition: str
    action: str
    dose_reduction: Optional[float] = None


class ProtocolTemplateBase(BaseModel):
    """Base protocol template schema."""
    name: str
    full_name: Optional[str] = None
    cancer_types: List[str] = []
    cycle_days: int
    total_cycles: Optional[int] = None


class ProtocolTemplateCreate(ProtocolTemplateBase):
    """Schema for creating a protocol template."""
    drugs: List[DrugSchema]
    pre_medications: List[MedicationSchema] = []
    post_medications: List[MedicationSchema] = []
    required_labs: List[str] = []
    monitoring_parameters: List[str] = []
    dose_modification_rules: List[DoseModificationRule] = []
    common_side_effects: List[str] = []
    serious_side_effects: List[str] = []
    reference_guidelines: Optional[str] = None


class ProtocolTemplateResponse(ProtocolTemplateBase):
    """Schema for protocol template response."""
    id: UUID
    drugs: List[Dict[str, Any]]
    pre_medications: List[Dict[str, Any]]
    post_medications: List[Dict[str, Any]]
    required_labs: List[str]
    monitoring_parameters: List[str]
    dose_modification_rules: List[Dict[str, Any]]
    common_side_effects: List[str]
    serious_side_effects: List[str]
    reference_guidelines: Optional[str] = None
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


# Treatment Plan Schemas
class TreatmentPlanCreate(BaseModel):
    """Schema for creating a treatment plan."""
    patient_id: UUID
    protocol_template_id: Optional[UUID] = None
    protocol_name: str
    custom_protocol: Dict[str, Any]
    start_date: Optional[date] = None
    planned_cycles: int
    opd_notes: Optional[str] = None


class TreatmentPlanUpdate(BaseModel):
    """Schema for updating a treatment plan."""
    protocol_name: Optional[str] = None
    custom_protocol: Optional[Dict[str, Any]] = None
    start_date: Optional[date] = None
    planned_cycles: Optional[int] = None
    status: Optional[PlanStatus] = None
    opd_notes: Optional[str] = None
    daycare_notes: Optional[str] = None


class TreatmentPlanResponse(BaseModel):
    """Schema for treatment plan response."""
    id: UUID
    patient_id: UUID
    protocol_template_id: Optional[UUID] = None
    protocol_name: str
    custom_protocol: Optional[Dict[str, Any]] = None
    start_date: Optional[date] = None
    planned_cycles: int
    completed_cycles: int
    status: PlanStatus
    ai_recommendations: Optional[str] = None
    ai_risk_assessment: Optional[Dict[str, Any]] = None
    ai_confidence_score: Optional[float] = None
    created_by_doctor_id: Optional[UUID] = None
    opd_approved_by: Optional[UUID] = None
    opd_approved_at: Optional[datetime] = None
    opd_notes: Optional[str] = None
    daycare_approved_by: Optional[UUID] = None
    daycare_approved_at: Optional[datetime] = None
    daycare_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# Treatment Cycle Schemas
class TreatmentCycleCreate(BaseModel):
    """Schema for creating a treatment cycle."""
    treatment_plan_id: UUID
    cycle_number: int
    scheduled_date: date


class TreatmentCycleUpdate(BaseModel):
    """Schema for updating a treatment cycle."""
    scheduled_date: Optional[date] = None
    actual_date: Optional[date] = None
    status: Optional[CycleStatus] = None
    pre_chemo_labs: Optional[Dict[str, Any]] = None
    pre_chemo_vitals: Optional[Dict[str, Any]] = None
    patient_weight_kg: Optional[float] = None
    calculated_bsa: Optional[float] = None
    dose_modifications: Optional[Dict[str, Any]] = None
    modification_reason: Optional[str] = None
    approval_notes: Optional[str] = None
    immediate_reactions: Optional[Dict[str, Any]] = None
    discharge_notes: Optional[str] = None
    follow_up_instructions: Optional[str] = None


class TreatmentCycleResponse(BaseModel):
    """Schema for treatment cycle response."""
    id: UUID
    treatment_plan_id: UUID
    cycle_number: int
    scheduled_date: date
    actual_date: Optional[date] = None
    status: CycleStatus
    pre_chemo_labs: Optional[Dict[str, Any]] = None
    pre_chemo_vitals: Optional[Dict[str, Any]] = None
    patient_weight_kg: Optional[float] = None
    calculated_bsa: Optional[float] = None
    dose_modifications: Optional[Dict[str, Any]] = None
    modification_reason: Optional[str] = None
    daycare_doctor_id: Optional[UUID] = None
    approved_at: Optional[datetime] = None
    approval_notes: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    administered_by: Optional[UUID] = None
    immediate_reactions: Optional[Dict[str, Any]] = None
    discharge_notes: Optional[str] = None
    follow_up_instructions: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# Drug Administration Schemas
# Treatment Calendar Schemas
class CalendarDaySchema(BaseModel):
    """A single day in the treatment calendar."""
    date: date
    day_in_cycle: int
    cycle_number: int
    day_type: str  # "treatment", "take_home", "lab", "rest"
    cycle_status: str
    drugs: List[Dict[str, Any]] = []
    appointments: List[Dict[str, Any]] = []
    notes: Optional[str] = None


class TreatmentCalendarResponse(BaseModel):
    """Calendar view of a treatment plan."""
    plan_id: UUID
    protocol_name: str
    cycle_length_days: int
    total_cycles: int
    completed_cycles: int
    current_cycle: Optional[int] = None
    next_treatment_date: Optional[date] = None
    calendar_days: List[CalendarDaySchema]


# Patient Registration (by OPD Doctor)
class PatientRegistrationWithPlan(BaseModel):
    """Register a new patient with a treatment plan in one step."""
    first_name: str
    last_name: str
    date_of_birth: date
    gender: str
    cancer_type: Optional[str] = None
    cancer_stage: Optional[str] = None
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    phone: Optional[str] = None
    patient_email: Optional[str] = None
    protocol_code: Optional[str] = None
    protocol_name: str
    custom_protocol: Optional[Dict[str, Any]] = None
    start_date: date
    planned_cycles: int
    cycle_length_days: int = 21
    opd_notes: Optional[str] = None


class PatientRegistrationResponse(BaseModel):
    """Response after registering a patient with plan."""
    patient_id: UUID
    patient_name: str
    treatment_plan_id: UUID
    protocol_name: str
    cycles_created: int
    login_email: str
    login_password: Optional[str] = None
    start_date: date
    next_treatment_date: Optional[date] = None
    email_sent_to: Optional[str] = None


class DischargeSummaryResponse(BaseModel):
    """Structured discharge summary for a completed treatment cycle."""
    patient_name: str
    patient_age: Optional[int] = None
    diagnosis: Optional[str] = None
    protocol_name: str
    cycle_number: int
    total_cycles: int
    cycle_date: str
    drugs_administered: List[Dict[str, Any]]
    pre_medications_given: List[Dict[str, Any]] = []
    vitals: Optional[Dict[str, Any]] = None
    reactions: Optional[List[str]] = None
    dose_modifications: Optional[str] = None
    next_cycle_date: Optional[str] = None
    next_cycle_number: Optional[int] = None
    take_home_medications: List[Dict[str, Any]]
    rescue_medications: List[Dict[str, Any]] = []
    monitoring_requirements: List[str] = []
    protocol_warnings: List[str] = []
    follow_up_instructions: str
    warning_signs: List[str]
    generated_at: str


class DrugAdministrationUpdate(BaseModel):
    """Schema for updating drug administration."""
    actual_dose: Optional[float] = None
    actual_duration_mins: Optional[int] = None
    status: Optional[AdminStatus] = None
    batch_number: Optional[str] = None
    expiry_date: Optional[date] = None
    iv_site: Optional[str] = None
    flow_rate: Optional[str] = None
    reactions: Optional[List[Dict[str, Any]]] = None
    notes: Optional[str] = None


class DrugAdministrationResponse(BaseModel):
    """Schema for drug administration response."""
    id: UUID
    cycle_id: UUID
    drug_name: str
    planned_dose: float
    actual_dose: Optional[float] = None
    unit: str
    route: str
    planned_duration_mins: Optional[int] = None
    actual_duration_mins: Optional[int] = None
    status: AdminStatus
    prepared_by: Optional[UUID] = None
    prepared_at: Optional[datetime] = None
    batch_number: Optional[str] = None
    expiry_date: Optional[date] = None
    verified_by: Optional[UUID] = None
    verified_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    administered_by: Optional[UUID] = None
    iv_site: Optional[str] = None
    flow_rate: Optional[str] = None
    reactions: List[Dict[str, Any]] = []
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CycleCompletionResponse(BaseModel):
    """Response after completing a treatment cycle."""
    cycle: TreatmentCycleResponse
    discharge_summary: Optional[Dict[str, Any]] = None


class SophiaProtocolDrugsResponse(BaseModel):
    """Response for SOPHIA protocol drugs endpoint."""
    protocol_code: str
    protocol_name: str
    core_drugs: List[Dict[str, Any]] = []
    pre_medications: List[Dict[str, Any]] = []
    take_home_medicines: List[Dict[str, Any]] = []
    rescue_medications: List[Dict[str, Any]] = []


# Pre-chemo Labs (Feature 1)
class PreChemoLabsInput(BaseModel):
    neutrophils: Optional[float] = None
    platelets: Optional[float] = None
    hemoglobin: Optional[float] = None
    wbc: Optional[float] = None
    gfr: Optional[float] = None
    creatinine: Optional[float] = None
    bilirubin: Optional[float] = None
    alt: Optional[float] = None
    ast: Optional[float] = None
    notes: Optional[str] = None


class LabSafetyResult(BaseModel):
    parameter: str
    value: float
    threshold: float
    status: str  # "block", "warn", "ok"
    message: str


class PreChemoLabsResponse(BaseModel):
    cycle_id: UUID
    labs: Dict[str, Any]
    safety_results: List[LabSafetyResult]
    can_proceed: bool
    warnings: List[str]


# Dose Recalculation (Feature 3)
class DoseRecalculationRequest(BaseModel):
    weight_kg: float
    height_cm: Optional[float] = None


class DoseRecalculationResponse(BaseModel):
    cycle_id: UUID
    old_bsa: Optional[float] = None
    new_bsa: float
    bsa_change_percent: float
    drugs: List[Dict[str, Any]]
    flagged: bool


# Timeline (Feature 5)
class TimelineItem(BaseModel):
    date: date
    type: str  # "treatment", "lab", "medication", "rest", "appointment"
    title: str
    description: Optional[str] = None
    status: Optional[str] = None
    cycle_number: Optional[int] = None
    is_action_required: bool = False


class TimelineResponse(BaseModel):
    plan_id: UUID
    protocol_name: str
    total_cycles: int
    completed_cycles: int
    items: List[TimelineItem]


# Cost Tracking (Feature 10)
class CycleCostUpdate(BaseModel):
    session_cost: Optional[float] = None
    lab_cost: Optional[float] = None
    other_charges: Optional[float] = None


class CycleCostDetail(BaseModel):
    cycle_number: int
    cycle_id: UUID
    session_cost: Optional[float] = None
    lab_cost: Optional[float] = None
    other_charges: Optional[float] = None
    drug_costs: List[Dict[str, Any]] = []
    cycle_total: float


class TreatmentCostResponse(BaseModel):
    plan_id: UUID
    protocol_name: str
    estimated_total_cost: Optional[float] = None
    total_spent: float
    cycles: List[CycleCostDetail]
