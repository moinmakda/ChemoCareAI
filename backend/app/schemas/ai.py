"""
Pydantic schemas for AI service endpoints.
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class RiskAssessmentRequest(BaseModel):
    """Request for AI risk assessment."""
    patient_id: str
    protocol_name: str
    cycle_number: int = 1


class RiskAssessmentResponse(BaseModel):
    """Response from AI risk assessment."""
    patient_id: str
    protocol: str
    cycle_number: int
    risk_factors: List[Dict[str, Any]] = []
    overall_risk_level: Optional[str] = None
    recommendations: List[str] = []


class AIRecommendationsResponse(BaseModel):
    """Response from AI recommendations endpoint."""
    patient_id: str
    diagnosis: str
    recommendations: List[str] = []
    supportive_care: List[str] = []
    lifestyle: List[str] = []
    monitoring: List[str] = []
    warning_signs: List[str] = []


class AIHealthResponse(BaseModel):
    """AI service health check response."""
    status: str
    model: str
    provider: str
    features: List[str]
    structured_output: bool = True
    response_format: str = "application/json"
