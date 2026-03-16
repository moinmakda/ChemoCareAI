"""
SQLAlchemy models for Protocol Requests and Clinical Data Collection.
"""
import uuid
from datetime import datetime, date
from enum import Enum as PyEnum
from sqlalchemy import Column, String, Boolean, DateTime, Date, Text, ForeignKey, Integer, Numeric, Enum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base


class ProtocolRequestStatus(str, PyEnum):
    """Status of protocol generation request."""
    DRAFT = "draft"
    NURSE_COLLECTING = "nurse_collecting"
    NURSE_REVIEW = "nurse_review"
    DOCTOR_REVIEW = "doctor_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    # Legacy aliases kept for any existing DB rows
    PENDING_DATA = "pending_data"
    PENDING_GENERATION = "pending_generation"
    GENERATED = "generated"
    PENDING_NURSE_APPROVAL = "pending_nurse_approval"
    NURSE_APPROVED = "nurse_approved"
    PENDING_DOCTOR_APPROVAL = "pending_doctor_approval"
    REVISION_NEEDED = "revision_needed"


class DataSource(str, PyEnum):
    """Source of clinical data."""
    PATIENT_ENTRY = "patient_entry"
    NURSE_ENTRY = "nurse_entry"
    DOCTOR_ENTRY = "doctor_entry"
    DOCUMENT_EXTRACTED = "document_extracted"
    LAB_INTEGRATION = "lab_integration"
    VERIFIED = "verified"


class PatientClinicalData(Base):
    """Comprehensive patient clinical data for protocol generation."""

    __tablename__ = "patient_clinical_data"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)

    age = Column(Integer, nullable=True)
    height_cm = Column(Numeric(5, 2), nullable=True)
    weight_kg = Column(Numeric(5, 2), nullable=True)
    date_collected = Column(Date, default=date.today)

    cancer_type = Column(String(200), nullable=True)
    cancer_subtype = Column(String(200), nullable=True)
    histology = Column(String(200), nullable=True)
    disease_stage = Column(String(50), nullable=True)
    ct_findings = Column(Text, nullable=True)

    gfr = Column(Numeric(5, 1), nullable=True)
    creatinine = Column(Numeric(5, 2), nullable=True)
    bilirubin = Column(Numeric(5, 2), nullable=True)
    lft = Column(JSONB, nullable=True)
    fb = Column(JSONB, nullable=True)
    ue = Column(JSONB, nullable=True)
    glucose = Column(Numeric(5, 1), nullable=True)
    hba1c = Column(Numeric(4, 1), nullable=True)
    ldh = Column(Numeric(6, 1), nullable=True)
    esr = Column(Numeric(5, 1), nullable=True)
    urate = Column(Numeric(5, 2), nullable=True)
    calcium = Column(Numeric(4, 2), nullable=True)
    vitamin_d = Column(Numeric(5, 1), nullable=True)
    magnesium = Column(Numeric(4, 2), nullable=True)
    igs = Column(JSONB, nullable=True)
    b2_microglobulin = Column(Numeric(5, 2), nullable=True)

    hep_b_core = Column(Boolean, nullable=True)
    hep_b_surface = Column(Boolean, nullable=True)
    hep_c_antibody = Column(Boolean, nullable=True)
    ebv = Column(Boolean, nullable=True)
    cmv = Column(Boolean, nullable=True)
    vzv = Column(Boolean, nullable=True)
    hiv = Column(Boolean, nullable=True)
    htlv1 = Column(Boolean, nullable=True)
    g6pd = Column(Boolean, nullable=True)

    is_smoker = Column(Boolean, default=False)
    has_heart_disease = Column(Boolean, default=False)
    has_lung_disease = Column(Boolean, default=False)
    has_hep_bc = Column(Boolean, default=False)
    lifetime_doxorubicin_mg = Column(Numeric(8, 2), nullable=True)

    cycle_number = Column(Integer, nullable=True)
    total_planned_cycles = Column(Integer, nullable=True)
    cycles_completed = Column(JSONB, default=list)
    post_cycle_data = Column(JSONB, default=list)

    data_source = Column(
        Enum(DataSource, native_enum=False, values_callable=lambda x: [e.value for e in x]),
        default=DataSource.PATIENT_ENTRY,
    )
    is_verified = Column(Boolean, default=False)
    verified_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    verified_at = Column(DateTime, nullable=True)
    extracted_from_documents = Column(JSONB, default=list)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    patient = relationship("Patient", backref="clinical_data_entries")

    def __repr__(self):
        return f"<PatientClinicalData for Patient {self.patient_id} dated {self.date_collected}>"


class ProtocolRequest(Base):
    """Protocol generation request with approval workflow."""

    __tablename__ = "protocol_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    clinical_data_id = Column(UUID(as_uuid=True), ForeignKey("patient_clinical_data.id"), nullable=True)

    status = Column(
        Enum(ProtocolRequestStatus, native_enum=False, values_callable=lambda x: [e.value for e in x]),
        default=ProtocolRequestStatus.DRAFT,
    )

    # Store all collected clinical data as JSON blob (flexible)
    clinical_data = Column(JSONB, nullable=True)
    nurse_collected_data = Column(JSONB, nullable=True)

    requested_protocol = Column(String(200), nullable=True)
    protocol_template_id = Column(UUID(as_uuid=True), ForeignKey("protocol_templates.id"), nullable=True)

    # AI Generated Protocol
    generated_protocol = Column(JSONB, nullable=True)
    ai_confidence_score = Column(Numeric(3, 2), nullable=True)
    generated_at = Column(DateTime, nullable=True)

    # Nurse Review — field names consistent with workflow code
    nurse_id = Column(UUID(as_uuid=True), ForeignKey("nurses.id"), nullable=True)
    nurse_reviewed_at = Column(DateTime, nullable=True)
    nurse_review_notes = Column(Text, nullable=True)
    nurse_modifications = Column(JSONB, nullable=True)

    # Doctor Review — field names consistent with workflow code
    doctor_id = Column(UUID(as_uuid=True), ForeignKey("doctors.id"), nullable=True)
    doctor_reviewed_at = Column(DateTime, nullable=True)
    doctor_review_notes = Column(Text, nullable=True)
    doctor_modifications = Column(JSONB, nullable=True)

    # Final Protocol
    final_protocol = Column(JSONB, nullable=True)

    # Rejection
    rejected_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    rejected_at = Column(DateTime, nullable=True)

    # Linked Treatment Plan (created after approval)
    treatment_plan_id = Column(UUID(as_uuid=True), ForeignKey("treatment_plans.id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    patient = relationship("Patient", backref="protocol_requests")
    clinical_data_rel = relationship("PatientClinicalData", backref="protocol_requests", foreign_keys=[clinical_data_id])

    def __repr__(self):
        return f"<ProtocolRequest {self.id} for Patient {self.patient_id} - {self.status}>"


class PostCycleAssessment(Base):
    """Post-cycle assessment data for dose adjustments."""

    __tablename__ = "post_cycle_assessments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    cycle_id = Column(UUID(as_uuid=True), ForeignKey("treatment_cycles.id"), nullable=True)
    cycle_number = Column(Integer, nullable=False)

    assessment_date = Column(Date, default=date.today)

    gfr = Column(Numeric(5, 1), nullable=True)
    creatinine_clearance = Column(Numeric(5, 1), nullable=True)
    bilirubin = Column(Numeric(5, 2), nullable=True)

    weight_kg = Column(Numeric(5, 2), nullable=True)
    height_cm = Column(Numeric(5, 2), nullable=True)

    neutrophil_grade = Column(String(20), nullable=True)
    platelet_grade = Column(String(20), nullable=True)

    hba1c = Column(Numeric(4, 1), nullable=True)
    glucose = Column(Numeric(5, 1), nullable=True)

    has_heart_disease = Column(Boolean, default=False)
    has_motor_weakness = Column(Boolean, default=False)
    has_gross_hematuria = Column(Boolean, default=False)

    assessed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("Patient", backref="post_cycle_assessments")

    def __repr__(self):
        return f"<PostCycleAssessment Cycle {self.cycle_number} for Patient {self.patient_id}>"
