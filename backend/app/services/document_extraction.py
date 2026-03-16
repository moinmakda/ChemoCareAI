"""
Intelligent Document Extraction Service

Uses Google Gemini Vision API to extract structured clinical data from:
- Lab reports (blood tests, metabolic panels)
- Imaging reports (CT, MRI, PET scans)
- Pathology reports
- Discharge summaries
- Prescription documents

The service intelligently identifies document types and extracts relevant
clinical parameters for protocol generation.
"""
import re
from typing import Dict, Any, Optional, List
from pydantic import BaseModel, Field
from google import genai
from google.genai import types

from app.core.config import settings


# Initialize Gemini client
client = genai.Client(api_key=settings.GEMINI_API_KEY)


# =============================================================================
# PYDANTIC MODELS FOR STRUCTURED EXTRACTION
# =============================================================================

class ExtractedLabValue(BaseModel):
    """Single extracted lab value."""
    parameter: str = Field(description="Name of the lab parameter")
    value: Optional[float] = Field(description="Numeric value extracted")
    unit: Optional[str] = Field(description="Unit of measurement")
    reference_range: Optional[str] = Field(description="Normal reference range if found")
    status: Optional[str] = Field(description="Status: normal, high, low, critical")
    confidence: float = Field(description="Confidence in extraction (0.0 to 1.0)")


class ExtractedVitalSign(BaseModel):
    """Extracted vital sign."""
    vital_type: str = Field(description="Type of vital: bp, hr, temp, spo2, rr, weight, height")
    value: str = Field(description="Value as string (e.g., '120/80' for BP)")
    unit: Optional[str] = Field(description="Unit if applicable")
    confidence: float = Field(description="Confidence in extraction")


class ExtractedDiagnosis(BaseModel):
    """Extracted diagnosis information."""
    diagnosis: str = Field(description="Primary diagnosis text")
    icd_code: Optional[str] = Field(description="ICD-10 code if found")
    stage: Optional[str] = Field(description="Disease stage if applicable")
    histology: Optional[str] = Field(description="Histology type for cancer")
    confidence: float = Field(description="Confidence in extraction")


class ExtractedMedication(BaseModel):
    """Extracted medication information."""
    drug_name: str = Field(description="Name of medication")
    dose: Optional[str] = Field(description="Dose with units")
    frequency: Optional[str] = Field(description="Dosing frequency")
    route: Optional[str] = Field(description="Route of administration")
    confidence: float = Field(description="Confidence in extraction")


class DocumentExtractionResult(BaseModel):
    """Complete extraction result from a clinical document."""
    document_type: str = Field(description="Type of document: lab_report, imaging_report, pathology, prescription, discharge_summary, other")
    document_date: Optional[str] = Field(description="Date of the document if found (YYYY-MM-DD)")
    
    # Extracted data
    lab_values: List[ExtractedLabValue] = Field(default=[], description="Extracted laboratory values")
    vital_signs: List[ExtractedVitalSign] = Field(default=[], description="Extracted vital signs")
    diagnoses: List[ExtractedDiagnosis] = Field(default=[], description="Extracted diagnoses")
    medications: List[ExtractedMedication] = Field(default=[], description="Extracted medications")
    
    # Cancer-specific extractions
    cancer_type: Optional[str] = Field(description="Type of cancer if mentioned")
    cancer_stage: Optional[str] = Field(description="Cancer staging if found")
    histology: Optional[str] = Field(description="Histopathology findings")
    tumor_markers: Dict[str, float] = Field(default={}, description="Tumor marker values")
    
    # Raw text for reference
    key_findings: List[str] = Field(default=[], description="Key clinical findings extracted")
    recommendations: List[str] = Field(default=[], description="Clinical recommendations found")
    
    # Metadata
    overall_confidence: float = Field(description="Overall confidence in extraction")
    needs_verification: bool = Field(description="Whether human verification is recommended")
    extraction_notes: List[str] = Field(default=[], description="Notes about the extraction process")


class LabPanelMapping(BaseModel):
    """Mapping of extracted labs to clinical data model fields."""
    gfr: Optional[float] = None
    creatinine: Optional[float] = None
    bilirubin: Optional[float] = None
    hba1c: Optional[float] = None
    glucose: Optional[float] = None
    ldh: Optional[float] = None
    esr: Optional[float] = None
    urate: Optional[float] = None
    calcium: Optional[float] = None
    vitamin_d: Optional[float] = None
    magnesium: Optional[float] = None
    b2_microglobulin: Optional[float] = None
    
    # Complex panels as dicts
    full_blood_count: Optional[Dict[str, float]] = None  # {wbc, hb, platelets, neutrophils}
    liver_function: Optional[Dict[str, float]] = None  # {alt, ast, alp, ggt, bilirubin}
    urea_electrolytes: Optional[Dict[str, float]] = None  # {sodium, potassium, urea}
    immunoglobulins: Optional[Dict[str, float]] = None  # {igg, iga, igm}
    
    # Viral markers
    hep_b_core: Optional[bool] = None
    hep_b_surface: Optional[bool] = None
    hep_c_antibody: Optional[bool] = None


# =============================================================================
# EXTRACTION PROMPTS
# =============================================================================

DOCUMENT_EXTRACTION_PROMPT = """
You are an expert medical data extraction AI. Analyze this clinical document image 
and extract all relevant clinical data in a structured format.

EXTRACTION GUIDELINES:
1. Identify the document type (lab report, imaging report, pathology, prescription, etc.)
2. Extract ALL numerical lab values with their units and reference ranges
3. For blood counts, extract: WBC, Hemoglobin, Platelets, Neutrophils (ANC)
4. For metabolic panels, extract: Sodium, Potassium, Creatinine, GFR, Glucose
5. For liver function, extract: ALT, AST, ALP, GGT, Bilirubin
6. For cancer-related documents, extract: Cancer type, Stage, Histology
7. Extract any tumor markers found (CEA, AFP, CA-125, PSA, etc.)
8. For prescriptions, extract all medications with doses

IMPORTANT:
- Set confidence scores based on clarity of the text (1.0 = very clear, 0.5 = partially visible)
- Flag "needs_verification: true" if any values seem unusual or unclear
- Include the document date if visible
- Extract vital signs if present (BP, Heart Rate, Temperature, SpO2, Weight, Height)

Be thorough - extract every clinical value you can identify.
"""

LAB_MAPPING_PROMPT = """
Given the following extracted lab values, map them to our clinical data model fields.

EXTRACTED LABS:
{extracted_labs}

MAP TO THESE FIELDS (use null if not found):
- gfr: Glomerular Filtration Rate (eGFR, GFR)
- creatinine: Serum Creatinine
- bilirubin: Total Bilirubin
- hba1c: Hemoglobin A1c / Glycated hemoglobin
- glucose: Blood Glucose (fasting or random)
- ldh: Lactate Dehydrogenase
- esr: Erythrocyte Sedimentation Rate
- urate: Uric Acid
- calcium: Serum Calcium (total or corrected)
- vitamin_d: Vitamin D (25-OH)
- magnesium: Serum Magnesium
- b2_microglobulin: Beta-2 Microglobulin

For complex panels, group them:
- full_blood_count: {{wbc, hb, platelets, neutrophils}}
- liver_function: {{alt, ast, alp, ggt, bilirubin}}
- urea_electrolytes: {{sodium, potassium, urea}}
- immunoglobulins: {{igg, iga, igm}}

For viral markers, indicate positive (true) or negative (false).
"""


# =============================================================================
# EXTRACTION FUNCTIONS
# =============================================================================

async def extract_from_image(
    image_data: bytes,
    mime_type: str = "image/jpeg"
) -> DocumentExtractionResult:
    """
    Extract clinical data from a document image using Gemini Vision.
    
    Args:
        image_data: Raw image bytes
        mime_type: Image MIME type (image/jpeg, image/png, application/pdf)
    
    Returns:
        DocumentExtractionResult with all extracted data
    """
    response = client.models.generate_content(
        model=settings.GEMINI_MODEL,
        contents=[
            types.Part.from_text(DOCUMENT_EXTRACTION_PROMPT),
            types.Part.from_bytes(
                data=image_data,
                mime_type=mime_type
            ),
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=DocumentExtractionResult,
            temperature=0.1,  # Very low temperature for accurate extraction
        ),
    )
    
    return DocumentExtractionResult.model_validate_json(response.text)


async def extract_from_text(text_content: str) -> DocumentExtractionResult:
    """
    Extract clinical data from text content (e.g., OCR output, pasted text).
    
    Args:
        text_content: Raw text content from document
    
    Returns:
        DocumentExtractionResult with all extracted data
    """
    prompt = f"""
{DOCUMENT_EXTRACTION_PROMPT}

DOCUMENT TEXT:
{text_content}
"""
    
    response = client.models.generate_content(
        model=settings.GEMINI_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=DocumentExtractionResult,
            temperature=0.1,
        ),
    )
    
    return DocumentExtractionResult.model_validate_json(response.text)


async def map_labs_to_clinical_data(
    extraction_result: DocumentExtractionResult
) -> LabPanelMapping:
    """
    Map extracted lab values to our clinical data model fields.
    
    This is a second-stage extraction that normalizes lab names to our schema.
    """
    # Format extracted labs for the prompt
    labs_text = "\n".join([
        f"- {lab.parameter}: {lab.value} {lab.unit or ''} (confidence: {lab.confidence})"
        for lab in extraction_result.lab_values
    ])
    
    prompt = LAB_MAPPING_PROMPT.format(extracted_labs=labs_text)
    
    response = client.models.generate_content(
        model=settings.GEMINI_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=LabPanelMapping,
            temperature=0.1,
        ),
    )
    
    return LabPanelMapping.model_validate_json(response.text)


async def extract_and_map_document(
    image_data: Optional[bytes] = None,
    text_content: Optional[str] = None,
    mime_type: str = "image/jpeg"
) -> Dict[str, Any]:
    """
    Complete extraction pipeline: extract from document and map to clinical data fields.
    
    Args:
        image_data: Raw image bytes (optional)
        text_content: Text content (optional, used if no image)
        mime_type: Image MIME type
    
    Returns:
        Dictionary with:
        - extraction: Raw DocumentExtractionResult
        - mapped_labs: LabPanelMapping
        - clinical_data_updates: Dict ready to update PatientClinicalData
    """
    # Extract from document
    if image_data:
        extraction = await extract_from_image(image_data, mime_type)
    elif text_content:
        extraction = await extract_from_text(text_content)
    else:
        raise ValueError("Either image_data or text_content must be provided")
    
    # Map labs to our schema
    mapped_labs = await map_labs_to_clinical_data(extraction)
    
    # Build clinical data update dict
    clinical_data_updates = {
        # Direct lab mappings
        "gfr": mapped_labs.gfr,
        "creatinine": mapped_labs.creatinine,
        "bilirubin": mapped_labs.bilirubin,
        "hba1c": mapped_labs.hba1c,
        "glucose": mapped_labs.glucose,
        "ldh": mapped_labs.ldh,
        "esr": mapped_labs.esr,
        "urate": mapped_labs.urate,
        "calcium": mapped_labs.calcium,
        "vitamin_d": mapped_labs.vitamin_d,
        "magnesium": mapped_labs.magnesium,
        "b2_microglobulin": mapped_labs.b2_microglobulin,
        
        # Complex panels
        "fb": mapped_labs.full_blood_count,
        "lft": mapped_labs.liver_function,
        "ue": mapped_labs.urea_electrolytes,
        "igs": mapped_labs.immunoglobulins,
        
        # Viral markers
        "hep_b_core": mapped_labs.hep_b_core,
        "hep_b_surface": mapped_labs.hep_b_surface,
        "hep_c_antibody": mapped_labs.hep_c_antibody,
        
        # Cancer details from extraction
        "cancer_type": extraction.cancer_type,
        "disease_stage": extraction.cancer_stage,
        "histology": extraction.histology,
    }
    
    # Remove None values
    clinical_data_updates = {k: v for k, v in clinical_data_updates.items() if v is not None}
    
    # Extract vital signs for weight/height
    for vital in extraction.vital_signs:
        if vital.vital_type.lower() == "weight":
            try:
                clinical_data_updates["weight_kg"] = float(re.search(r'[\d.]+', vital.value).group())
            except (AttributeError, ValueError):
                pass  # value didn't contain a parseable number — skip
        elif vital.vital_type.lower() == "height":
            try:
                clinical_data_updates["height_cm"] = float(re.search(r'[\d.]+', vital.value).group())
            except (AttributeError, ValueError):
                pass  # value didn't contain a parseable number — skip
    
    return {
        "extraction": extraction.model_dump(),
        "mapped_labs": mapped_labs.model_dump(),
        "clinical_data_updates": clinical_data_updates,
        "document_type": extraction.document_type,
        "document_date": extraction.document_date,
        "needs_verification": extraction.needs_verification,
        "overall_confidence": extraction.overall_confidence,
    }


async def batch_extract_documents(
    documents: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Extract data from multiple documents and merge results.
    
    Args:
        documents: List of dicts with 'image_data' or 'text_content' and optional 'mime_type'
    
    Returns:
        List of extraction results, plus a merged clinical_data_updates dict
    """
    results = []
    merged_updates = {}
    
    for doc in documents:
        result = await extract_and_map_document(
            image_data=doc.get('image_data'),
            text_content=doc.get('text_content'),
            mime_type=doc.get('mime_type', 'image/jpeg')
        )
        results.append(result)
        
        # Merge updates (later documents override earlier ones)
        merged_updates.update(result['clinical_data_updates'])
    
    return {
        "individual_extractions": results,
        "merged_clinical_data": merged_updates,
    }
