"""
AI Services API endpoints - Powered by Google Gemini.

Uses structured JSON output with Pydantic models for type-safe responses.
Documentation: https://ai.google.dev/gemini-api/docs/structured-output
"""
from typing import Optional, Dict, Any, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models import Patient, ProtocolTemplate
from app.api.deps import get_current_user, allow_doctors, allow_medical_staff
from app.services.gemini_ai import (
    generate_protocol as ai_generate_protocol,
    calculate_dose_with_ai,
    check_drug_interactions as ai_check_interactions,
    analyze_labs_for_treatment,
    analyze_patient_symptoms,
    get_treatment_recommendations,
    ProtocolGenerationResult,
    DoseCalculationResult,
    DrugInteractionResult,
    LabAnalysisResult,
    SymptomAnalysisResult,
)

router = APIRouter(prefix="/ai", tags=["AI Services (Gemini)"])


# =============================================================================
# REQUEST SCHEMAS
# =============================================================================

class GenerateProtocolRequest(BaseModel):
    """Request for AI protocol generation."""
    patient_id: str = Field(description="UUID of the patient")
    protocol_template_id: str = Field(description="UUID of the protocol template to base on")
    recent_labs: Dict[str, float] = Field(
        description="Recent lab values (e.g., {'hemoglobin': 12.5, 'wbc': 5000, 'platelets': 180000})"
    )
    doctor_notes: Optional[str] = Field(
        default=None,
        description="Optional notes from the prescribing doctor"
    )


class DoseCalculationRequest(BaseModel):
    """Request for AI-assisted dose calculation."""
    drug_name: str = Field(description="Name of the chemotherapy drug")
    dose_per_m2: float = Field(description="Standard dose per m² of BSA")
    bsa: float = Field(description="Patient's body surface area in m²")
    patient_age: int = Field(description="Patient's age in years")
    renal_function: Optional[Dict[str, float]] = Field(
        default=None,
        description="Renal function values (e.g., {'creatinine': 1.2, 'egfr': 85})"
    )
    hepatic_function: Optional[Dict[str, float]] = Field(
        default=None,
        description="Hepatic function values (e.g., {'bilirubin': 0.8, 'alt': 25, 'ast': 30})"
    )
    comorbidities: Optional[List[str]] = Field(
        default=None,
        description="List of patient comorbidities"
    )


class DrugInteractionRequest(BaseModel):
    """Request for drug interaction check."""
    chemo_drugs: List[str] = Field(description="List of planned chemotherapy drugs")
    current_medications: List[str] = Field(description="List of patient's current medications")


class LabAnalysisRequest(BaseModel):
    """Request for lab analysis."""
    patient_id: str = Field(description="UUID of the patient")
    labs: Dict[str, float] = Field(
        description="Lab values to analyze (e.g., {'hemoglobin': 12.5, 'anc': 1800})"
    )
    planned_protocol: Optional[str] = Field(
        default=None,
        description="Name of the planned protocol"
    )
    planned_drugs: Optional[List[str]] = Field(
        default=None,
        description="List of planned chemotherapy drugs"
    )


class SymptomAnalysisRequest(BaseModel):
    """Request for symptom analysis."""
    symptoms: Dict[str, Any] = Field(
        description="Symptom data (e.g., {'has_fever': true, 'nausea_score': 5, 'pain_score': 3})"
    )
    current_treatment: str = Field(description="Current chemotherapy protocol name")
    days_since_last_cycle: int = Field(description="Days since last chemotherapy cycle")
    patient_history: Optional[str] = Field(
        default=None,
        description="Relevant patient history notes"
    )


class RiskAssessmentRequest(BaseModel):
    """Request for risk assessment."""
    patient_id: str = Field(description="UUID of the patient")
    protocol_name: str = Field(description="Name of the chemotherapy protocol")
    cycle_number: int = Field(description="Current cycle number")


class RecommendationRequest(BaseModel):
    """Request for treatment recommendations."""
    patient_id: str = Field(description="UUID of the patient")


# =============================================================================
# API ENDPOINTS
# =============================================================================

@router.post(
    "/generate-protocol",
    response_model=ProtocolGenerationResult,
    summary="Generate AI-Powered Protocol",
    description="Generate a personalized chemotherapy protocol using Google Gemini AI with structured JSON output."
)
async def generate_protocol(
    request: GenerateProtocolRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(allow_doctors),
):
    """
    Generate a personalized chemotherapy protocol using Gemini AI.
    
    This endpoint uses Google Gemini's structured output feature to ensure
    type-safe JSON responses that conform to the ProtocolGenerationResult schema.
    
    The AI considers:
    - Patient demographics and BSA
    - Current lab values
    - Comorbidities
    - Evidence-based guidelines (NCCN, ESMO, ASCO)
    - Drug-specific dose caps and adjustments
    """
    # Get patient
    result = await db.execute(select(Patient).where(Patient.id == request.patient_id))
    patient = result.scalar_one_or_none()
    
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found",
        )
    
    # Get protocol template
    result = await db.execute(
        select(ProtocolTemplate).where(ProtocolTemplate.id == request.protocol_template_id)
    )
    protocol = result.scalar_one_or_none()
    
    if not protocol:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Protocol template not found",
        )
    
    # Prepare patient info for AI
    patient_info = {
        "age": patient.age,
        "gender": patient.gender,
        "weight": patient.weight,
        "height": patient.height,
        "bsa": patient.bsa,
        "ecog": getattr(patient, 'ecog_status', 'Unknown'),
    }
    
    try:
        # Call Gemini AI with structured output
        ai_result = await ai_generate_protocol(
            patient_info=patient_info,
            diagnosis=patient.diagnosis,
            stage=getattr(patient, 'stage', 'Unknown'),
            template_name=protocol.name,
            template_drugs=protocol.drugs or [],
            recent_labs=request.recent_labs,
            comorbidities=patient.comorbidities or [],
            doctor_notes=request.doctor_notes,
        )
        
        return ai_result
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI service error: {str(e)}",
        )


@router.post(
    "/dose-calculator",
    response_model=DoseCalculationResult,
    summary="AI-Assisted Dose Calculation",
    description="Calculate chemotherapy dose with AI-powered adjustments using Gemini structured output."
)
async def calculate_dose(
    request: DoseCalculationRequest,
    current_user = Depends(allow_medical_staff),
):
    """
    Calculate drug dose with AI-assisted adjustments.
    
    The AI considers:
    - BSA-based calculation
    - Drug-specific dose caps
    - Age-based adjustments
    - Renal function adjustments
    - Hepatic function adjustments
    - Comorbidity considerations
    """
    try:
        result = await calculate_dose_with_ai(
            drug_name=request.drug_name,
            standard_dose_per_m2=request.dose_per_m2,
            bsa=request.bsa,
            patient_age=request.patient_age,
            renal_function=request.renal_function,
            hepatic_function=request.hepatic_function,
            comorbidities=request.comorbidities,
        )
        
        return result
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI service error: {str(e)}",
        )


@router.post(
    "/drug-interactions",
    response_model=DrugInteractionResult,
    summary="Check Drug Interactions",
    description="Check for drug-drug interactions using Gemini AI with structured output."
)
async def check_drug_interactions(
    request: DrugInteractionRequest,
    current_user = Depends(allow_medical_staff),
):
    """
    Check for drug-drug interactions between chemotherapy and other medications.
    
    The AI analyzes:
    - Chemo-chemo interactions
    - Chemo-medication interactions
    - Pharmacokinetic interactions (CYP450, P-gp)
    - Pharmacodynamic interactions (additive toxicities)
    """
    try:
        result = await ai_check_interactions(
            chemotherapy_drugs=request.chemo_drugs,
            concurrent_medications=request.current_medications,
        )
        
        return result
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI service error: {str(e)}",
        )


@router.post(
    "/analyze-labs",
    response_model=LabAnalysisResult,
    summary="Analyze Labs for Treatment Fitness",
    description="Analyze lab values to determine treatment fitness using Gemini AI."
)
async def analyze_labs(
    request: LabAnalysisRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(allow_medical_staff),
):
    """
    Analyze lab values to determine if a patient is fit for treatment.
    
    The AI evaluates:
    - Standard treatment thresholds
    - Drug-specific requirements
    - Bone marrow reserve
    - Organ function
    - Infection risk indicators
    """
    # Get planned protocol info if patient_id is provided
    planned_protocol = request.planned_protocol or "Unknown"
    planned_drugs = request.planned_drugs or []
    
    try:
        result = await analyze_labs_for_treatment(
            lab_values=request.labs,
            planned_protocol=planned_protocol,
            planned_drugs=planned_drugs,
        )
        
        return result
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI service error: {str(e)}",
        )


@router.post(
    "/symptom-analysis",
    response_model=SymptomAnalysisResult,
    summary="Analyze Patient Symptoms",
    description="Analyze patient-reported symptoms for concerning patterns using Gemini AI."
)
async def analyze_symptoms(
    request: SymptomAnalysisRequest,
    current_user = Depends(allow_medical_staff),
):
    """
    Analyze patient-reported symptoms for concerning patterns.
    
    The AI considers:
    - Expected side effects of the regimen
    - Timing relative to treatment (nadir period)
    - Signs of serious complications
    - Quality of life impact
    """
    try:
        result = await analyze_patient_symptoms(
            symptoms=request.symptoms,
            current_treatment=request.current_treatment,
            days_since_last_cycle=request.days_since_last_cycle,
            patient_history=request.patient_history,
        )
        
        return result
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI service error: {str(e)}",
        )


@router.post(
    "/risk-assessment",
    summary="Assess Treatment Risks",
    description="Assess treatment risks for a patient using Gemini AI."
)
async def assess_risk(
    request: RiskAssessmentRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(allow_doctors),
):
    """
    Assess treatment risks for a patient.
    
    Returns a comprehensive risk assessment including:
    - Age-related risks
    - Comorbidity-based risks
    - Protocol-specific risks
    - Cycle-specific considerations
    """
    # Get patient
    result = await db.execute(select(Patient).where(Patient.id == request.patient_id))
    patient = result.scalar_one_or_none()
    
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found",
        )
    
    # Prepare patient info for AI recommendations
    patient_info = {
        "age": patient.age,
        "gender": patient.gender,
        "comorbidities": patient.comorbidities or [],
        "ecog": getattr(patient, 'ecog_status', 'Unknown'),
        "cycle_number": request.cycle_number,
    }
    
    try:
        recommendations = await get_treatment_recommendations(
            patient_info=patient_info,
            diagnosis=patient.diagnosis,
            current_status=f"Cycle {request.cycle_number} of {request.protocol_name}",
        )
        
        return {
            "patient_id": str(patient.id),
            "protocol": request.protocol_name,
            "cycle_number": request.cycle_number,
            **recommendations,
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI service error: {str(e)}",
        )


@router.get(
    "/recommendations/{patient_id}",
    summary="Get AI Recommendations",
    description="Get personalized AI recommendations for a patient."
)
async def get_recommendations(
    patient_id: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(allow_medical_staff),
):
    """
    Get personalized AI recommendations for a patient.
    
    Returns evidence-based recommendations for:
    - Treatment approaches
    - Supportive care
    - Lifestyle modifications
    - Monitoring
    - Warning signs
    """
    # Get patient
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found",
        )
    
    patient_info = {
        "age": patient.age,
        "gender": patient.gender,
        "weight": patient.weight,
        "height": patient.height,
        "comorbidities": patient.comorbidities or [],
    }
    
    try:
        recommendations = await get_treatment_recommendations(
            patient_info=patient_info,
            diagnosis=patient.diagnosis,
            current_status=patient.treatment_status or "Active treatment",
        )
        
        return {
            "patient_id": str(patient.id),
            "diagnosis": patient.diagnosis,
            **recommendations,
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI service error: {str(e)}",
        )


@router.get(
    "/health",
    summary="AI Service Health Check",
    description="Check if the Gemini AI service is available."
)
async def health_check():
    """
    Check if the Gemini AI service is configured and available.
    """
    from app.core.config import settings
    
    return {
        "status": "healthy" if settings.GEMINI_API_KEY else "not_configured",
        "model": settings.GEMINI_MODEL,
        "provider": "Google Gemini",
        "features": [
            "Protocol Generation",
            "Dose Calculation",
            "Drug Interaction Check",
            "Lab Analysis",
            "Symptom Analysis",
            "Risk Assessment",
            "Treatment Recommendations",
        ],
        "structured_output": True,
        "response_format": "application/json",
    }
