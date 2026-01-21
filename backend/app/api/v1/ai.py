"""
AI Services API endpoints.
"""
from typing import Optional, Dict, Any, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models import Patient, ProtocolTemplate
from app.api.deps import get_current_user, allow_doctors, allow_medical_staff

router = APIRouter(prefix="/ai", tags=["AI Services"])


class GenerateProtocolRequest(BaseModel):
    """Request for protocol generation."""
    patient_id: str
    protocol_template_id: str
    recent_labs: Dict[str, Any]
    doctor_notes: Optional[str] = None


class ProtocolGenerationResponse(BaseModel):
    """Response from protocol generation."""
    protocol_name: str
    patient_bsa: float
    drugs: List[Dict[str, Any]]
    pre_medications: List[Dict[str, Any]]
    post_medications: List[Dict[str, Any]]
    schedule: List[Dict[str, Any]]
    ai_recommendations: List[str]
    ai_risk_assessment: List[Dict[str, Any]]
    ai_confidence_score: float
    required_monitoring: List[str]
    dose_modification_rules: List[Dict[str, Any]]


class DoseCalculationRequest(BaseModel):
    """Request for dose calculation."""
    drug_name: str
    dose_per_m2: float
    bsa: float
    patient_age: int
    renal_function: Optional[float] = None
    liver_function: Optional[float] = None


class DoseCalculationResponse(BaseModel):
    """Response from dose calculation."""
    dose: float
    unit: str
    adjustments: List[str]
    warnings: List[str]


class RiskAssessmentRequest(BaseModel):
    """Request for risk assessment."""
    patient_id: str
    protocol_name: str
    cycle_number: int


class LabAnalysisRequest(BaseModel):
    """Request for lab analysis."""
    patient_id: str
    labs: Dict[str, float]


class DrugInteractionRequest(BaseModel):
    """Request for drug interaction check."""
    chemo_drugs: List[str]
    current_medications: List[str]


@router.post("/generate-protocol", response_model=ProtocolGenerationResponse)
async def generate_protocol(
    request: GenerateProtocolRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(allow_doctors),
):
    """Generate a personalized chemotherapy protocol using AI."""
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
    
    # Calculate BSA
    bsa = patient.bsa
    
    # Calculate doses for each drug
    drugs_with_doses = []
    for drug in protocol.drugs:
        dose_per_m2 = drug.get("dose_per_m2", 0)
        calculated_dose = round(dose_per_m2 * bsa, 2)
        
        adjustments = []
        warnings = []
        
        # Check dose caps
        if drug.get("drug_name", "").lower() == "vincristine":
            if calculated_dose > 2:
                calculated_dose = 2
                adjustments.append("Capped at 2mg (maximum dose)")
        
        # Age adjustment
        if patient.age > 70:
            adjustments.append("Consider 20% dose reduction for age >70")
            warnings.append("Elderly patient - monitor closely for toxicity")
        
        drugs_with_doses.append({
            **drug,
            "calculated_dose": calculated_dose,
            "dose_adjustments": adjustments,
            "warnings": warnings,
        })
    
    # Generate schedule
    schedule = []
    for drug in protocol.drugs:
        for day in drug.get("days", [1]):
            schedule.append({
                "day": day,
                "drug": drug.get("drug_name"),
                "dose": drug.get("dose_per_m2"),
                "route": drug.get("route"),
            })
    schedule = sorted(schedule, key=lambda x: x["day"])
    
    # AI recommendations (simplified)
    recommendations = []
    risks = []
    
    # Check for cardiotoxic drugs
    cardiotoxic_drugs = ["doxorubicin", "epirubicin", "trastuzumab"]
    for drug in protocol.drugs:
        if drug.get("drug_name", "").lower() in cardiotoxic_drugs:
            recommendations.append("Baseline echocardiogram recommended (cardiotoxic agent)")
            risks.append({
                "risk": "Cardiotoxicity",
                "severity": "moderate",
                "mitigation": "Monitor LVEF before and during treatment"
            })
            break
    
    # Check for pulmonary toxic drugs
    if any(d.get("drug_name", "").lower() == "bleomycin" for d in protocol.drugs):
        recommendations.append("Baseline PFTs recommended (Bleomycin)")
        risks.append({
            "risk": "Pulmonary toxicity",
            "severity": "moderate",
            "mitigation": "Monitor for respiratory symptoms, cumulative dose limit 400 units"
        })
    
    # Check labs
    labs = request.recent_labs
    if labs.get("anc", 10000) < 1500:
        recommendations.append("ANC low - consider delaying treatment")
        risks.append({
            "risk": "Neutropenia",
            "severity": "high",
            "mitigation": "Delay until ANC > 1500, consider G-CSF support"
        })
    
    if labs.get("platelets", 200000) < 100000:
        recommendations.append("Platelets low - consider dose reduction")
        risks.append({
            "risk": "Thrombocytopenia",
            "severity": "moderate",
            "mitigation": "Delay until platelets > 100,000"
        })
    
    # Add general recommendations
    recommendations.extend([
        "Ensure adequate hydration before and during treatment",
        "Pre-medication with antiemetics as per protocol",
        "Patient education on side effects and when to seek help"
    ])
    
    return ProtocolGenerationResponse(
        protocol_name=protocol.name,
        patient_bsa=bsa,
        drugs=drugs_with_doses,
        pre_medications=protocol.pre_medications or [],
        post_medications=protocol.post_medications or [],
        schedule=schedule,
        ai_recommendations=recommendations,
        ai_risk_assessment=risks,
        ai_confidence_score=0.92,
        required_monitoring=protocol.monitoring_parameters or [],
        dose_modification_rules=protocol.dose_modification_rules or [],
    )


@router.post("/dose-calculator", response_model=DoseCalculationResponse)
async def calculate_dose(
    request: DoseCalculationRequest,
    current_user = Depends(allow_medical_staff),
):
    """Calculate drug dose with adjustments."""
    base_dose = request.dose_per_m2 * request.bsa
    adjustments = []
    warnings = []
    
    # Dose caps
    dose_caps = {
        "vincristine": 2.0,
        "bleomycin": 30.0,
    }
    
    drug_lower = request.drug_name.lower()
    if drug_lower in dose_caps:
        if base_dose > dose_caps[drug_lower]:
            adjustments.append(f"Capped at {dose_caps[drug_lower]}mg")
            base_dose = dose_caps[drug_lower]
    
    # Age adjustment
    if request.patient_age > 70:
        adjustments.append("Consider 20% reduction for elderly patient")
        warnings.append("Increased toxicity risk in elderly")
    
    # Renal adjustment
    if request.renal_function and request.renal_function > 1.5:
        if drug_lower in ["cisplatin", "carboplatin", "methotrexate"]:
            adjustments.append("Dose reduction recommended for renal impairment")
            warnings.append("Monitor renal function closely")
    
    # Hepatic adjustment
    if request.liver_function and request.liver_function > 2.0:
        if drug_lower in ["doxorubicin", "vincristine", "paclitaxel"]:
            adjustments.append("Dose reduction recommended for hepatic impairment")
            warnings.append("Monitor liver function closely")
    
    return DoseCalculationResponse(
        dose=round(base_dose, 2),
        unit="mg",
        adjustments=adjustments,
        warnings=warnings,
    )


@router.post("/risk-assessment")
async def assess_risk(
    request: RiskAssessmentRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(allow_doctors),
):
    """Assess treatment risks for a patient."""
    # Get patient
    result = await db.execute(select(Patient).where(Patient.id == request.patient_id))
    patient = result.scalar_one_or_none()
    
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found",
        )
    
    risks = []
    
    # Age-based risk
    if patient.age > 65:
        risks.append({
            "category": "Age-related",
            "risk": "Increased toxicity",
            "probability": 0.35,
            "severity": "moderate",
            "recommendations": ["Closer monitoring", "Consider dose reduction"]
        })
    
    # Comorbidity-based risks
    comorbidities = patient.comorbidities or []
    if "diabetes" in [c.lower() for c in comorbidities]:
        risks.append({
            "category": "Comorbidity",
            "risk": "Steroid-induced hyperglycemia",
            "probability": 0.6,
            "severity": "moderate",
            "recommendations": ["Monitor blood glucose", "Adjust diabetes medications"]
        })
    
    if "hypertension" in [c.lower() for c in comorbidities]:
        risks.append({
            "category": "Comorbidity",
            "risk": "Blood pressure fluctuations",
            "probability": 0.4,
            "severity": "low",
            "recommendations": ["Regular BP monitoring", "Continue antihypertensives"]
        })
    
    # Neutropenia risk (higher in later cycles)
    neutropenia_risk = min(0.2 + (request.cycle_number * 0.05), 0.5)
    risks.append({
        "category": "Hematological",
        "risk": "Febrile neutropenia",
        "probability": neutropenia_risk,
        "severity": "high" if neutropenia_risk > 0.3 else "moderate",
        "recommendations": [
            "G-CSF prophylaxis if risk > 20%",
            "Patient education on fever management"
        ]
    })
    
    return {
        "patient_id": str(patient.id),
        "protocol": request.protocol_name,
        "cycle_number": request.cycle_number,
        "overall_risk_score": sum(r["probability"] for r in risks) / len(risks) if risks else 0,
        "risks": risks,
        "recommendations": [
            "Pre-treatment labs within 48 hours",
            "Ensure adequate baseline ECOG performance status",
            "Review current medications for interactions"
        ]
    }


@router.post("/analyze-labs")
async def analyze_labs(
    request: LabAnalysisRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(allow_medical_staff),
):
    """Analyze lab results for treatment fitness."""
    labs = request.labs
    
    # Normal ranges
    normal_ranges = {
        "hemoglobin": {"min": 12.0, "max": 16.0, "unit": "g/dL"},
        "wbc": {"min": 4000, "max": 11000, "unit": "/μL"},
        "anc": {"min": 1500, "max": 8000, "unit": "/μL"},
        "platelets": {"min": 150000, "max": 400000, "unit": "/μL"},
        "creatinine": {"min": 0.6, "max": 1.2, "unit": "mg/dL"},
        "bilirubin": {"min": 0.1, "max": 1.2, "unit": "mg/dL"},
        "alt": {"min": 7, "max": 56, "unit": "U/L"},
        "ast": {"min": 10, "max": 40, "unit": "U/L"},
    }
    
    results = []
    fit_for_treatment = True
    critical_flags = []
    
    for lab_name, value in labs.items():
        lab_lower = lab_name.lower()
        if lab_lower in normal_ranges:
            ranges = normal_ranges[lab_lower]
            status = "normal"
            
            if value < ranges["min"]:
                status = "low"
                if lab_lower in ["anc", "platelets"]:
                    fit_for_treatment = False
                    critical_flags.append(f"Low {lab_name}")
            elif value > ranges["max"]:
                status = "high"
                if lab_lower in ["creatinine", "bilirubin"]:
                    critical_flags.append(f"High {lab_name}")
            
            results.append({
                "parameter": lab_name,
                "value": value,
                "unit": ranges["unit"],
                "status": status,
                "normal_range": f"{ranges['min']}-{ranges['max']}",
            })
    
    recommendations = []
    if not fit_for_treatment:
        recommendations.append("Consider delaying treatment until values improve")
    if "Low anc" in critical_flags:
        recommendations.append("ANC < 1500: High risk of neutropenic complications")
    if "Low platelets" in critical_flags:
        recommendations.append("Platelets < 100,000: Risk of bleeding")
    if "High creatinine" in critical_flags:
        recommendations.append("Renal impairment: Consider dose adjustments for renally cleared drugs")
    
    return {
        "patient_id": request.patient_id,
        "analysis_results": results,
        "fit_for_treatment": fit_for_treatment,
        "critical_flags": critical_flags,
        "recommendations": recommendations,
    }


@router.post("/drug-interactions")
async def check_drug_interactions(
    request: DrugInteractionRequest,
    current_user = Depends(allow_medical_staff),
):
    """Check for drug-drug interactions."""
    # Known interaction database (simplified)
    interactions_db = {
        ("methotrexate", "nsaids"): {
            "severity": "high",
            "effect": "Increased methotrexate toxicity due to decreased renal clearance",
            "recommendation": "Avoid NSAIDs or use with extreme caution"
        },
        ("methotrexate", "ibuprofen"): {
            "severity": "high",
            "effect": "Increased methotrexate toxicity",
            "recommendation": "Avoid concomitant use"
        },
        ("5-fluorouracil", "warfarin"): {
            "severity": "high",
            "effect": "Increased anticoagulant effect and bleeding risk",
            "recommendation": "Monitor INR closely, may need warfarin dose reduction"
        },
        ("cisplatin", "aminoglycosides"): {
            "severity": "high",
            "effect": "Additive nephrotoxicity and ototoxicity",
            "recommendation": "Avoid combination if possible"
        },
        ("doxorubicin", "trastuzumab"): {
            "severity": "moderate",
            "effect": "Additive cardiotoxicity",
            "recommendation": "Monitor cardiac function closely"
        },
        ("paclitaxel", "ketoconazole"): {
            "severity": "moderate",
            "effect": "Increased paclitaxel levels",
            "recommendation": "Consider dose reduction or alternative antifungal"
        },
    }
    
    found_interactions = []
    
    chemo_lower = [d.lower() for d in request.chemo_drugs]
    meds_lower = [m.lower() for m in request.current_medications]
    
    for (drug1, drug2), interaction in interactions_db.items():
        if (drug1 in chemo_lower and drug2 in meds_lower) or \
           (drug2 in chemo_lower and drug1 in meds_lower) or \
           (drug1 in chemo_lower and drug2 in chemo_lower):
            found_interactions.append({
                "drugs": [drug1, drug2],
                **interaction
            })
    
    return {
        "chemo_drugs": request.chemo_drugs,
        "current_medications": request.current_medications,
        "interactions_found": len(found_interactions),
        "interactions": found_interactions,
        "recommendation": "Review with pharmacist" if found_interactions else "No significant interactions found"
    }


@router.post("/symptom-analysis")
async def analyze_symptoms(
    symptoms: Dict[str, Any],
    current_user = Depends(allow_medical_staff),
):
    """Analyze patient symptoms and provide recommendations."""
    severity_score = 0
    alerts = []
    recommendations = []
    
    # Analyze symptoms
    if symptoms.get("has_fever", False):
        severity_score += 0.4
        alerts.append({
            "type": "fever",
            "severity": "high",
            "message": "Fever during chemotherapy requires immediate evaluation"
        })
        recommendations.append("Check CBC immediately to rule out febrile neutropenia")
    
    nausea_score = symptoms.get("nausea_score", 0)
    if nausea_score >= 7:
        severity_score += 0.3
        alerts.append({
            "type": "nausea",
            "severity": "moderate",
            "message": "Severe nausea may require antiemetic adjustment"
        })
        recommendations.append("Consider adding/adjusting antiemetic regimen")
    
    pain_score = symptoms.get("pain_score", 0)
    if pain_score >= 7:
        severity_score += 0.3
        alerts.append({
            "type": "pain",
            "severity": "moderate",
            "message": "Severe pain requires attention"
        })
        recommendations.append("Assess pain and consider analgesia adjustment")
    
    fatigue_score = symptoms.get("fatigue_score", 0)
    if fatigue_score >= 8:
        severity_score += 0.2
        recommendations.append("Evaluate for anemia, consider energy conservation strategies")
    
    if symptoms.get("has_diarrhea", False):
        severity_score += 0.2
        recommendations.append("Assess hydration status, consider antidiarrheal medications")
    
    if symptoms.get("has_mouth_sores", False):
        severity_score += 0.15
        recommendations.append("Oral care protocol, consider magic mouthwash")
    
    # Determine alert level
    if severity_score > 0.6:
        alert_level = "urgent"
    elif severity_score > 0.3:
        alert_level = "monitor"
    else:
        alert_level = "normal"
    
    return {
        "symptoms_analyzed": symptoms,
        "severity_score": round(severity_score, 2),
        "alert_level": alert_level,
        "alerts": alerts,
        "recommendations": recommendations,
        "action_required": alert_level == "urgent"
    }
