"""
Gemini AI Service - Google Gemini integration with structured JSON output.

Uses the google-genai SDK with Pydantic models for type-safe structured outputs.
Documentation: https://ai.google.dev/gemini-api/docs/structured-output
"""
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from google import genai
from google.genai import types

from app.core.config import settings


# Initialize Gemini client
client = genai.Client(api_key=settings.GEMINI_API_KEY)


# =============================================================================
# PYDANTIC MODELS FOR STRUCTURED OUTPUT
# =============================================================================

class DrugDose(BaseModel):
    """Calculated drug dose with adjustments."""
    drug_name: str = Field(description="Name of the chemotherapy drug")
    dose_per_m2: float = Field(description="Standard dose per square meter of BSA")
    calculated_dose: float = Field(description="Final calculated dose for patient")
    unit: str = Field(description="Unit of measurement (mg, units, etc.)")
    route: str = Field(description="Route of administration (IV, PO, SC, etc.)")
    infusion_duration_minutes: Optional[int] = Field(description="Duration of infusion in minutes")
    dose_adjustments: List[str] = Field(description="List of dose adjustments applied")
    warnings: List[str] = Field(description="Safety warnings for this drug")


class PreMedication(BaseModel):
    """Pre-medication details."""
    drug_name: str = Field(description="Name of pre-medication drug")
    dose: str = Field(description="Dose with units")
    route: str = Field(description="Route of administration")
    timing: str = Field(description="When to administer relative to chemo")


class RiskFactor(BaseModel):
    """Individual risk assessment."""
    risk: str = Field(description="Type of risk identified")
    severity: str = Field(description="Severity level: low, moderate, high, critical")
    probability: float = Field(description="Probability of occurrence (0.0 to 1.0)")
    mitigation: str = Field(description="Recommended mitigation strategy")


class ScheduleDay(BaseModel):
    """Treatment schedule for a single day."""
    day: int = Field(description="Day number in cycle")
    drugs: List[str] = Field(description="Drugs to administer on this day")
    notes: Optional[str] = Field(description="Special instructions for this day")


class ProtocolGenerationResult(BaseModel):
    """Complete AI-generated protocol recommendation."""
    protocol_name: str = Field(description="Name of the chemotherapy protocol")
    regimen_type: str = Field(description="Type of regimen (curative, palliative, adjuvant, neoadjuvant)")
    cycle_length_days: int = Field(description="Length of one cycle in days")
    total_cycles: int = Field(description="Recommended total number of cycles")
    drugs: List[DrugDose] = Field(description="List of drugs with calculated doses")
    pre_medications: List[PreMedication] = Field(description="Pre-medications to administer")
    schedule: List[ScheduleDay] = Field(description="Daily treatment schedule")
    ai_recommendations: List[str] = Field(description="AI-generated recommendations")
    ai_risk_assessment: List[RiskFactor] = Field(description="Risk factors identified")
    required_monitoring: List[str] = Field(description="Required monitoring parameters")
    confidence_score: float = Field(description="AI confidence in this recommendation (0.0 to 1.0)")


class DoseCalculationResult(BaseModel):
    """Result of AI-assisted dose calculation."""
    drug_name: str = Field(description="Name of the drug")
    base_dose: float = Field(description="Base dose before adjustments")
    final_dose: float = Field(description="Final recommended dose")
    unit: str = Field(description="Unit of measurement")
    adjustments_applied: List[str] = Field(description="Adjustments applied to the dose")
    safety_warnings: List[str] = Field(description="Safety warnings")
    confidence: float = Field(description="Confidence in calculation (0.0 to 1.0)")


class DrugInteraction(BaseModel):
    """Drug-drug interaction details."""
    drug_pair: List[str] = Field(description="The two drugs that interact")
    severity: str = Field(description="Severity: low, moderate, high, critical")
    mechanism: str = Field(description="Mechanism of interaction")
    clinical_effect: str = Field(description="Clinical effect of the interaction")
    recommendation: str = Field(description="Clinical recommendation")


class DrugInteractionResult(BaseModel):
    """Result of drug interaction analysis."""
    interactions: List[DrugInteraction] = Field(description="List of identified interactions")
    overall_risk: str = Field(description="Overall risk level: safe, caution, warning, contraindicated")
    summary: str = Field(description="Summary of interaction analysis")
    recommendations: List[str] = Field(description="Clinical recommendations")


class LabInterpretation(BaseModel):
    """Interpretation of a single lab value."""
    parameter: str = Field(description="Lab parameter name")
    value: float = Field(description="Measured value")
    unit: str = Field(description="Unit of measurement")
    status: str = Field(description="Status: normal, low, high, critical")
    clinical_significance: str = Field(description="Clinical significance for chemotherapy")


class LabAnalysisResult(BaseModel):
    """Result of lab analysis for treatment fitness."""
    interpretations: List[LabInterpretation] = Field(description="Interpretation of each lab")
    fit_for_treatment: bool = Field(description="Whether patient is fit for treatment")
    concerns: List[str] = Field(description="List of clinical concerns")
    recommendations: List[str] = Field(description="Clinical recommendations")
    required_actions: List[str] = Field(description="Actions required before treatment")


class SymptomAlert(BaseModel):
    """Alert generated from symptom analysis."""
    symptom: str = Field(description="The symptom triggering the alert")
    severity: str = Field(description="Severity: low, moderate, high, critical")
    likely_cause: str = Field(description="Most likely cause related to chemotherapy")
    action_required: str = Field(description="Immediate action required")


class SymptomAnalysisResult(BaseModel):
    """Result of symptom analysis."""
    alerts: List[SymptomAlert] = Field(description="Generated alerts")
    overall_severity: str = Field(description="Overall severity: stable, concerning, urgent, critical")
    likely_diagnoses: List[str] = Field(description="Most likely diagnoses to consider")
    recommendations: List[str] = Field(description="Clinical recommendations")
    requires_immediate_attention: bool = Field(description="Whether immediate medical attention is needed")


# =============================================================================
# GEMINI AI FUNCTIONS
# =============================================================================

async def generate_protocol(
    patient_info: Dict[str, Any],
    diagnosis: str,
    stage: str,
    template_name: str,
    template_drugs: List[Dict[str, Any]],
    recent_labs: Dict[str, float],
    comorbidities: List[str],
    doctor_notes: Optional[str] = None,
) -> ProtocolGenerationResult:
    """
    Generate a personalized chemotherapy protocol using Gemini AI.
    
    Uses structured output with response_mime_type: application/json
    and Pydantic schema for type-safe response.
    """
    prompt = f"""
You are an expert oncology clinical decision support system. Generate a personalized 
chemotherapy protocol recommendation based on the following patient information.

PATIENT INFORMATION:
- Age: {patient_info.get('age', 'Unknown')}
- Gender: {patient_info.get('gender', 'Unknown')}
- Weight: {patient_info.get('weight', 'Unknown')} kg
- Height: {patient_info.get('height', 'Unknown')} cm
- BSA: {patient_info.get('bsa', 'Unknown')} m²
- ECOG Performance Status: {patient_info.get('ecog', 'Unknown')}

DIAGNOSIS:
- Cancer Type: {diagnosis}
- Stage: {stage}

PROTOCOL TEMPLATE: {template_name}
BASE DRUGS: {template_drugs}

RECENT LAB VALUES:
{recent_labs}

COMORBIDITIES: {comorbidities if comorbidities else 'None reported'}

DOCTOR'S NOTES: {doctor_notes if doctor_notes else 'None'}

Based on this information, generate a complete personalized protocol with:
1. Calculate appropriate doses based on BSA
2. Apply dose adjustments for age, organ function, and comorbidities
3. Identify risk factors and mitigation strategies
4. Provide pre-medication recommendations
5. Generate a treatment schedule
6. List required monitoring parameters
7. Provide your confidence score in this recommendation

IMPORTANT: Apply evidence-based oncology guidelines. Consider NCCN, ESMO, and ASCO guidelines.
For elderly patients (>70), consider dose reductions. Flag any concerning lab values.
"""

    response = client.models.generate_content(
        model=settings.GEMINI_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=ProtocolGenerationResult,
            temperature=0.3,  # Lower temperature for more consistent medical advice
        ),
    )
    
    return ProtocolGenerationResult.model_validate_json(response.text)


async def calculate_dose_with_ai(
    drug_name: str,
    standard_dose_per_m2: float,
    bsa: float,
    patient_age: int,
    renal_function: Optional[Dict[str, float]] = None,
    hepatic_function: Optional[Dict[str, float]] = None,
    comorbidities: Optional[List[str]] = None,
) -> DoseCalculationResult:
    """
    Calculate drug dose with AI-assisted adjustment recommendations.
    
    Uses structured output for type-safe response.
    """
    prompt = f"""
You are an expert oncology pharmacist. Calculate the appropriate dose for the following 
chemotherapy drug considering all patient factors.

DRUG: {drug_name}
STANDARD DOSE: {standard_dose_per_m2} mg/m² (or units/m² if applicable)
PATIENT BSA: {bsa} m²

PATIENT FACTORS:
- Age: {patient_age} years
- Renal Function: {renal_function if renal_function else 'Normal'}
- Hepatic Function: {hepatic_function if hepatic_function else 'Normal'}
- Comorbidities: {comorbidities if comorbidities else 'None'}

Calculate the final dose considering:
1. Standard BSA-based calculation
2. Drug-specific dose caps (e.g., Vincristine max 2mg)
3. Age-based adjustments (>70 years may need reduction)
4. Renal dose adjustments based on CrCl/eGFR
5. Hepatic dose adjustments based on bilirubin/transaminases
6. Any comorbidity-specific considerations

Provide your confidence level in this calculation.
"""

    response = client.models.generate_content(
        model=settings.GEMINI_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=DoseCalculationResult,
            temperature=0.1,  # Very low temperature for precise calculations
        ),
    )
    
    return DoseCalculationResult.model_validate_json(response.text)


async def check_drug_interactions(
    chemotherapy_drugs: List[str],
    concurrent_medications: List[str],
) -> DrugInteractionResult:
    """
    Check for drug-drug interactions between chemo drugs and other medications.
    
    Uses structured output for type-safe response.
    """
    prompt = f"""
You are an expert clinical pharmacologist specializing in oncology. Analyze the following 
drug combinations for potential interactions.

CHEMOTHERAPY DRUGS:
{chemotherapy_drugs}

CONCURRENT MEDICATIONS:
{concurrent_medications}

Analyze for:
1. Drug-drug interactions between chemo drugs
2. Interactions between chemo drugs and concurrent medications
3. Pharmacokinetic interactions (CYP450, P-gp, etc.)
4. Pharmacodynamic interactions (additive toxicities)
5. Food-drug interactions to note

For each interaction found, provide:
- The drug pair involved
- Severity level
- Mechanism of interaction
- Clinical effect
- Specific recommendation

Provide an overall risk assessment and summary.
"""

    response = client.models.generate_content(
        model=settings.GEMINI_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=DrugInteractionResult,
            temperature=0.2,
        ),
    )
    
    return DrugInteractionResult.model_validate_json(response.text)


async def analyze_labs_for_treatment(
    lab_values: Dict[str, float],
    planned_protocol: str,
    planned_drugs: List[str],
) -> LabAnalysisResult:
    """
    Analyze lab values to determine treatment fitness.
    
    Uses structured output for type-safe response.
    """
    prompt = f"""
You are an expert oncologist evaluating a patient's fitness for chemotherapy treatment.
Analyze the following lab values in the context of the planned treatment.

PLANNED PROTOCOL: {planned_protocol}
PLANNED DRUGS: {planned_drugs}

LAB VALUES:
{lab_values}

Evaluate each lab value considering:
1. Standard treatment thresholds for chemotherapy
2. Drug-specific requirements (e.g., renal function for Cisplatin)
3. Bone marrow reserve indicators
4. Organ function for drug metabolism
5. Infection risk indicators

For each lab value, provide:
- Clinical interpretation
- Significance for the planned chemotherapy
- Whether it's within acceptable limits for treatment

Determine overall treatment fitness and provide specific recommendations.
Include any required actions before treatment can proceed.
"""

    response = client.models.generate_content(
        model=settings.GEMINI_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=LabAnalysisResult,
            temperature=0.2,
        ),
    )
    
    return LabAnalysisResult.model_validate_json(response.text)


async def analyze_patient_symptoms(
    symptoms: Dict[str, Any],
    current_treatment: str,
    days_since_last_cycle: int,
    patient_history: Optional[str] = None,
) -> SymptomAnalysisResult:
    """
    Analyze patient-reported symptoms for concerning patterns.
    
    Uses structured output for type-safe response.
    """
    prompt = f"""
You are an expert oncology nurse practitioner evaluating patient-reported symptoms 
during chemotherapy treatment. Analyze the following symptoms for concerning patterns.

CURRENT TREATMENT: {current_treatment}
DAYS SINCE LAST CYCLE: {days_since_last_cycle}

REPORTED SYMPTOMS:
{symptoms}

PATIENT HISTORY: {patient_history if patient_history else 'Not provided'}

Analyze considering:
1. Expected side effects of the specific chemotherapy regimen
2. Timing relative to treatment (nadir period, etc.)
3. Signs of serious complications (febrile neutropenia, tumor lysis, etc.)
4. Signs of disease progression
5. Quality of life impact

Generate alerts for any concerning findings with:
- The triggering symptom
- Severity assessment
- Most likely cause
- Required action

Determine if immediate medical attention is needed.
Provide differential diagnoses and clinical recommendations.
"""

    response = client.models.generate_content(
        model=settings.GEMINI_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=SymptomAnalysisResult,
            temperature=0.3,
        ),
    )
    
    return SymptomAnalysisResult.model_validate_json(response.text)


async def get_treatment_recommendations(
    patient_info: Dict[str, Any],
    diagnosis: str,
    current_status: str,
) -> Dict[str, Any]:
    """
    Get AI-powered treatment recommendations.
    
    This is a general recommendation endpoint that returns a dictionary.
    """
    prompt = f"""
You are an expert oncology clinical decision support system. Provide treatment 
recommendations based on the following patient information.

PATIENT INFORMATION:
{patient_info}

DIAGNOSIS: {diagnosis}
CURRENT STATUS: {current_status}

Provide:
1. Recommended treatment approaches based on current guidelines
2. Supportive care recommendations
3. Lifestyle modifications
4. Monitoring recommendations
5. Red flags to watch for

Base recommendations on NCCN, ESMO, and ASCO guidelines where applicable.
"""

    # For general recommendations, we use a simpler schema
    class RecommendationResult(BaseModel):
        treatment_options: List[str] = Field(description="Recommended treatment approaches")
        supportive_care: List[str] = Field(description="Supportive care recommendations")
        lifestyle_modifications: List[str] = Field(description="Lifestyle recommendations")
        monitoring: List[str] = Field(description="Monitoring recommendations")
        red_flags: List[str] = Field(description="Warning signs to watch for")
        references: List[str] = Field(description="Guideline references")

    response = client.models.generate_content(
        model=settings.GEMINI_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=RecommendationResult,
            temperature=0.4,
        ),
    )
    
    result = RecommendationResult.model_validate_json(response.text)
    return result.model_dump()


# =============================================================================
# PATIENT CHAT AI ASSISTANT
# =============================================================================

class PatientChatResponse(BaseModel):
    """Response from patient chat AI assistant."""
    message: str = Field(description="The AI's response message to the patient")
    is_urgent: bool = Field(description="Whether the response indicates an urgent situation")
    suggested_actions: List[str] = Field(description="Suggested actions for the patient")
    should_contact_care_team: bool = Field(description="Whether patient should contact their care team")
    symptom_severity: Optional[str] = Field(
        default=None,
        description="If symptoms mentioned: low, moderate, high, critical"
    )


async def patient_chat(
    patient_name: str,
    patient_diagnosis: Optional[str],
    current_treatment: Optional[str],
    message: str,
    conversation_history: Optional[List[Dict[str, str]]] = None,
) -> PatientChatResponse:
    """
    AI chat assistant for patients undergoing chemotherapy.
    
    Provides supportive, empathetic responses while identifying
    any concerning symptoms that may require medical attention.
    """
    history_text = ""
    if conversation_history:
        for msg in conversation_history[-5:]:  # Last 5 messages for context
            role = "Patient" if msg.get("role") == "user" else "Assistant"
            history_text += f"{role}: {msg.get('content', '')}\n"

    prompt = f"""
You are ChemoCare AI, a compassionate and knowledgeable AI assistant for cancer patients 
undergoing chemotherapy treatment. You provide supportive, empathetic responses while 
being vigilant about symptoms that may require medical attention.

PATIENT CONTEXT:
- Name: {patient_name}
- Diagnosis: {patient_diagnosis or 'Not specified'}
- Current Treatment: {current_treatment or 'Not specified'}

CONVERSATION HISTORY:
{history_text if history_text else 'This is the start of the conversation'}

PATIENT MESSAGE:
{message}

GUIDELINES FOR YOUR RESPONSE:
1. Be warm, supportive, and empathetic - acknowledge emotions
2. Provide accurate, helpful information about chemotherapy side effects and management
3. NEVER provide medical diagnoses or treatment recommendations
4. Encourage them to contact their care team for medical concerns
5. Identify any symptoms that might be concerning (fever, severe pain, bleeding, breathing difficulty)
6. Keep responses concise but caring (2-3 paragraphs max)
7. Use simple, non-medical language when possible
8. If they mention concerning symptoms, flag as urgent and recommend contacting their care team

IMPORTANT SYMPTOM RED FLAGS (mark as urgent if mentioned):
- Fever over 100.4°F (38°C)
- Severe or uncontrolled pain
- Difficulty breathing or shortness of breath
- Bleeding that won't stop
- Persistent vomiting (can't keep fluids down)
- Signs of infection
- Confusion or disorientation
- Chest pain

Respond as a caring healthcare companion, not a chatbot.
"""

    try:
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=PatientChatResponse,
                temperature=0.7,  # Slightly higher for more natural conversation
            ),
        )
        
        return PatientChatResponse.model_validate_json(response.text)
    except Exception as e:
        # Fallback to unstructured response if schema fails
        fallback_response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.7,
            ),
        )
        # Return a basic response
        return PatientChatResponse(
            message=fallback_response.text,
            is_urgent=False,
            suggested_actions=[],
            should_contact_care_team=False,
            symptom_severity=None,
        )
