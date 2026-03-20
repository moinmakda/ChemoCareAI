"""
Pydantic schemas for day care management.
"""
from typing import Optional, List
from pydantic import BaseModel, Field


class VitalsStatus(BaseModel):
    """Last recorded vitals for a patient."""
    temperature: Optional[float] = None
    blood_pressure: Optional[str] = None
    heart_rate: Optional[int] = None
    oxygen_saturation: Optional[int] = None


class AlertInfo(BaseModel):
    """Alert information for a patient session."""
    id: str
    type: str
    message: str
    patient_id: str
    patient_name: str
    chair_number: Optional[int] = None
    timestamp: str
    acknowledged: bool = False
    severity: str


class ActivePatientResponse(BaseModel):
    """Active patient in day care."""
    id: str
    patient_id: str
    patient_name: str
    chair_number: Optional[int] = None
    protocol_name: str
    current_drug: Optional[str] = None
    status: str
    progress: int
    start_time: Optional[str] = None
    estimated_end_time: Optional[str] = None
    nurse_assigned: Optional[str] = None
    nurse_id: Optional[str] = None
    vitals_status: str = "normal"
    last_vitals: Optional[VitalsStatus] = None
    alerts: List[AlertInfo] = []


class ChairSchedule(BaseModel):
    """Scheduled session for a chair."""
    time: str
    patient_name: str
    duration: int


class ChairStatus(BaseModel):
    """Status of a day care chair."""
    id: int
    status: str
    current_patient_id: Optional[str] = None
    current_patient_name: Optional[str] = None
    scheduled_sessions: List[ChairSchedule] = []


class InfusionDrug(BaseModel):
    """Drug in an infusion session."""
    name: str
    dose: str
    duration: int
    order: int
    status: str


class InfusionSessionResponse(BaseModel):
    """Detailed infusion session information."""
    id: str
    patient_id: str
    patient_name: str
    protocol_id: Optional[str] = None
    protocol_name: str
    cycle_number: int
    chair_number: Optional[int] = None
    scheduled_start: str
    actual_start: Optional[str] = None
    estimated_end: str
    actual_end: Optional[str] = None
    status: str
    drugs: List[InfusionDrug] = []
    reactions: List[dict] = []
    notes: Optional[str] = None


class ReactionReport(BaseModel):
    """Report an adverse reaction during infusion."""
    reaction_type: str = Field(..., description="Type of reaction")
    severity: str = Field(..., description="Severity: mild, moderate, severe, life_threatening")
    description: str = Field(..., description="Description of the reaction")
    action_taken: Optional[str] = None
    vital_signs: Optional[dict] = None


class ReactionResponse(BaseModel):
    """Response after reporting a reaction."""
    message: str
    reaction_id: str
    severity: str


class SessionCompletionResponse(BaseModel):
    """Response after completing a session."""
    message: str
    session_id: str


class DaycareStatsResponse(BaseModel):
    """Dashboard stats for the day care unit."""
    total_patients: int
    today_appointments: int
    active_treatments: int
    pending_alerts: int
