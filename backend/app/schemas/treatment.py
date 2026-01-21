"""
Pydantic schemas for treatment plans and protocols.
"""
from datetime import date, datetime
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, Field
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
    id: str
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
    patient_id: str
    protocol_template_id: Optional[str] = None
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
    id: str
    patient_id: str
    protocol_template_id: Optional[str] = None
    protocol_name: str
    custom_protocol: Dict[str, Any]
    start_date: Optional[date] = None
    planned_cycles: int
    completed_cycles: int
    status: PlanStatus
    ai_recommendations: Optional[str] = None
    ai_risk_assessment: Optional[Dict[str, Any]] = None
    ai_confidence_score: Optional[float] = None
    created_by_doctor_id: Optional[str] = None
    opd_approved_by: Optional[str] = None
    opd_approved_at: Optional[datetime] = None
    opd_notes: Optional[str] = None
    daycare_approved_by: Optional[str] = None
    daycare_approved_at: Optional[datetime] = None
    daycare_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# Treatment Cycle Schemas
class TreatmentCycleCreate(BaseModel):
    """Schema for creating a treatment cycle."""
    treatment_plan_id: str
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
    id: str
    treatment_plan_id: str
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
    daycare_doctor_id: Optional[str] = None
    approved_at: Optional[datetime] = None
    approval_notes: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    administered_by: Optional[str] = None
    immediate_reactions: Optional[Dict[str, Any]] = None
    discharge_notes: Optional[str] = None
    follow_up_instructions: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# Drug Administration Schemas
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
    id: str
    cycle_id: str
    drug_name: str
    planned_dose: float
    actual_dose: Optional[float] = None
    unit: str
    route: str
    planned_duration_mins: Optional[int] = None
    actual_duration_mins: Optional[int] = None
    status: AdminStatus
    prepared_by: Optional[str] = None
    prepared_at: Optional[datetime] = None
    batch_number: Optional[str] = None
    expiry_date: Optional[date] = None
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    administered_by: Optional[str] = None
    iv_site: Optional[str] = None
    flow_rate: Optional[str] = None
    reactions: List[Dict[str, Any]] = []
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
