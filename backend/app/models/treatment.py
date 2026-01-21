"""
SQLAlchemy models for chemotherapy protocols and treatment plans.
"""
import uuid
from datetime import datetime, date
from enum import Enum as PyEnum
from sqlalchemy import Column, String, Boolean, DateTime, Date, Text, ForeignKey, Integer, Numeric, Enum
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import relationship
from app.core.database import Base


class PlanStatus(str, PyEnum):
    """Treatment plan status options."""
    DRAFT = "draft"
    PENDING_OPD_APPROVAL = "pending_opd_approval"
    PENDING_DAYCARE_APPROVAL = "pending_daycare_approval"
    APPROVED = "approved"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    ON_HOLD = "on_hold"


class CycleStatus(str, PyEnum):
    """Treatment cycle status options."""
    SCHEDULED = "scheduled"
    PRE_ASSESSMENT = "pre_assessment"
    APPROVED = "approved"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    DELAYED = "delayed"
    CANCELLED = "cancelled"


class AdminStatus(str, PyEnum):
    """Drug administration status options."""
    PENDING = "pending"
    PREPARED = "prepared"
    VERIFIED = "verified"
    STARTED = "started"
    PAUSED = "paused"
    RESUMED = "resumed"
    COMPLETED = "completed"
    STOPPED = "stopped"


class ProtocolTemplate(Base):
    """Master chemotherapy protocol templates."""
    
    __tablename__ = "protocol_templates"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    name = Column(String(100), nullable=False)  # e.g., 'ABVD', 'CHOP'
    full_name = Column(String(500), nullable=True)
    cancer_types = Column(ARRAY(Text), nullable=True)
    
    # Protocol Structure
    cycle_days = Column(Integer, nullable=False)
    total_cycles = Column(Integer, nullable=True)
    
    # Drugs in protocol (JSONB)
    drugs = Column(JSONB, nullable=False)
    pre_medications = Column(JSONB, default=list)
    post_medications = Column(JSONB, default=list)
    
    # Monitoring requirements
    required_labs = Column(JSONB, default=list)
    monitoring_parameters = Column(JSONB, default=list)
    dose_modification_rules = Column(JSONB, default=list)
    
    # Side effects
    common_side_effects = Column(ARRAY(Text), nullable=True)
    serious_side_effects = Column(ARRAY(Text), nullable=True)
    
    reference_guidelines = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f"<ProtocolTemplate {self.name}>"


class TreatmentPlan(Base):
    """Patient-specific treatment plans."""
    
    __tablename__ = "treatment_plans"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    protocol_template_id = Column(UUID(as_uuid=True), ForeignKey("protocol_templates.id"), nullable=True)
    
    # AI Generated / Modified Protocol
    protocol_name = Column(String(100), nullable=False)
    custom_protocol = Column(JSONB, nullable=False)
    
    # Plan Details
    start_date = Column(Date, nullable=True)
    planned_cycles = Column(Integer, nullable=False)
    completed_cycles = Column(Integer, default=0)
    
    # Status
    status = Column(Enum(PlanStatus), default=PlanStatus.DRAFT)
    
    # AI Analysis
    ai_recommendations = Column(Text, nullable=True)
    ai_risk_assessment = Column(JSONB, nullable=True)
    ai_confidence_score = Column(Numeric(3, 2), nullable=True)
    
    # OPD Doctor
    created_by_doctor_id = Column(UUID(as_uuid=True), ForeignKey("doctors.id"), nullable=True)
    opd_approved_by = Column(UUID(as_uuid=True), ForeignKey("doctors.id"), nullable=True)
    opd_approved_at = Column(DateTime, nullable=True)
    opd_notes = Column(Text, nullable=True)
    
    # Day Care Doctor
    daycare_approved_by = Column(UUID(as_uuid=True), ForeignKey("doctors.id"), nullable=True)
    daycare_approved_at = Column(DateTime, nullable=True)
    daycare_notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    patient = relationship("Patient", backref="treatment_plans")
    protocol_template = relationship("ProtocolTemplate", backref="treatment_plans")
    cycles = relationship("TreatmentCycle", back_populates="treatment_plan", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<TreatmentPlan {self.protocol_name} for Patient {self.patient_id}>"


class TreatmentCycle(Base):
    """Individual treatment cycles within a plan."""
    
    __tablename__ = "treatment_cycles"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    treatment_plan_id = Column(UUID(as_uuid=True), ForeignKey("treatment_plans.id", ondelete="CASCADE"), nullable=False)
    
    cycle_number = Column(Integer, nullable=False)
    scheduled_date = Column(Date, nullable=False)
    actual_date = Column(Date, nullable=True)
    
    status = Column(Enum(CycleStatus), default=CycleStatus.SCHEDULED)
    
    # Pre-chemo assessment
    pre_chemo_labs = Column(JSONB, nullable=True)
    pre_chemo_vitals = Column(JSONB, nullable=True)
    patient_weight_kg = Column(Numeric(5, 2), nullable=True)
    calculated_bsa = Column(Numeric(4, 2), nullable=True)
    
    # Modifications
    dose_modifications = Column(JSONB, nullable=True)
    modification_reason = Column(Text, nullable=True)
    
    # Approvals
    daycare_doctor_id = Column(UUID(as_uuid=True), ForeignKey("doctors.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    approval_notes = Column(Text, nullable=True)
    
    # Administration
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    administered_by = Column(UUID(as_uuid=True), ForeignKey("nurses.id"), nullable=True)
    
    # Post-chemo
    immediate_reactions = Column(JSONB, nullable=True)
    discharge_notes = Column(Text, nullable=True)
    follow_up_instructions = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    treatment_plan = relationship("TreatmentPlan", back_populates="cycles")
    drug_administrations = relationship("DrugAdministration", back_populates="cycle", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<TreatmentCycle {self.cycle_number} of Plan {self.treatment_plan_id}>"


class DrugAdministration(Base):
    """Drug administration log for each cycle."""
    
    __tablename__ = "drug_administrations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cycle_id = Column(UUID(as_uuid=True), ForeignKey("treatment_cycles.id", ondelete="CASCADE"), nullable=False)
    
    drug_name = Column(String(200), nullable=False)
    planned_dose = Column(Numeric(10, 2), nullable=False)
    actual_dose = Column(Numeric(10, 2), nullable=True)
    unit = Column(String(20), nullable=False)
    route = Column(String(50), nullable=False)
    
    # Timing
    planned_duration_mins = Column(Integer, nullable=True)
    actual_duration_mins = Column(Integer, nullable=True)
    
    status = Column(Enum(AdminStatus), default=AdminStatus.PENDING)
    
    # Preparation
    prepared_by = Column(UUID(as_uuid=True), ForeignKey("nurses.id"), nullable=True)
    prepared_at = Column(DateTime, nullable=True)
    batch_number = Column(String(100), nullable=True)
    expiry_date = Column(Date, nullable=True)
    
    # Verification
    verified_by = Column(UUID(as_uuid=True), ForeignKey("nurses.id"), nullable=True)
    verified_at = Column(DateTime, nullable=True)
    
    # Administration
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    administered_by = Column(UUID(as_uuid=True), ForeignKey("nurses.id"), nullable=True)
    
    # IV Details
    iv_site = Column(String(100), nullable=True)
    flow_rate = Column(String(50), nullable=True)
    
    # Reactions
    reactions = Column(JSONB, default=list)
    notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    cycle = relationship("TreatmentCycle", back_populates="drug_administrations")
    
    def __repr__(self):
        return f"<DrugAdministration {self.drug_name} {self.planned_dose}{self.unit}>"
