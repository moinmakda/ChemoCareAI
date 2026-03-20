"""
SOPHIA Engine Service

Wraps the SOPHIA protocol engine for use in ChemoCare.
Handles protocol loading, searching, and generation.
"""

from typing import Any, Dict, List, Optional

from app.services.sophia.engine import ProtocolEngine
from app.services.sophia.json_protocol_loader import load_all_json_protocols
from app.services.sophia.models import (
    PatientData,
    Protocol,
    ProtocolRequest,
    ProtocolResponse,
    ProtocolSummary,
    ECOGPerformanceStatus,
    LabUnitSystem,
)
from app.services.sophia.adapters import PatientStateAdapter

# Singleton engine instance
_engine: Optional[ProtocolEngine] = None


def get_sophia_engine() -> ProtocolEngine:
    """Get or create the singleton SOPHIA engine instance."""
    global _engine
    if _engine is None:
        protocols = load_all_json_protocols()
        _engine = ProtocolEngine(protocols)
        print(f"[SOPHIA] Engine initialized with {len(protocols)} protocols")
    return _engine


def list_protocols(
    search: Optional[str] = None,
    category: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """List all protocols with optional search and category filter."""
    engine = get_sophia_engine()
    protocols = list(engine.protocols.values())

    if category:
        cat_lower = category.lower()
        protocols = [
            p for p in protocols
            if _extract_category(p.source_file) == cat_lower
        ]

    if search:
        search_lower = search.lower()
        protocols = [
            p for p in protocols
            if (
                search_lower in p.code.lower()
                or search_lower in p.name.lower()
                or search_lower in p.indication.lower()
                or any(search_lower in d.drug_name.lower() for d in p.drugs)
            )
        ]

    return [
        {
            "id": p.id,
            "code": p.code,
            "name": p.name,
            "indication": p.indication,
            "drugs": [d.drug_name for d in p.drugs],
            "cycle_length_days": p.cycle_length_days,
            "total_cycles": p.total_cycles,
            "category": _extract_category(p.source_file),
            "source": p.source,
            "reference_url": p.reference_url,
        }
        for p in protocols
    ]


def search_protocols(query: str) -> List[Dict[str, Any]]:
    """Search protocols by code, name, indication, or drug name."""
    return list_protocols(search=query)


def get_protocol_detail(protocol_code: str) -> Optional[Dict[str, Any]]:
    """Get full protocol details by code."""
    engine = get_sophia_engine()
    protocol = engine.get_protocol(protocol_code)
    if not protocol:
        return None
    return protocol.model_dump(by_alias=True)


def get_protocol_categories() -> List[Dict[str, Any]]:
    """Get list of protocol categories with counts."""
    engine = get_sophia_engine()
    category_counts: Dict[str, int] = {}

    for p in engine.protocols.values():
        cat = _extract_category(p.source_file)
        category_counts[cat] = category_counts.get(cat, 0) + 1

    return [
        {"name": cat, "count": count}
        for cat, count in sorted(category_counts.items())
    ]


def generate_protocol_from_clinical_data(
    protocol_code: str,
    clinical_data: Dict[str, Any],
    patient_age: Optional[int] = None,
    cycle_number: int = 1,
    excluded_drugs: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Generate a protocol using the SOPHIA engine from ChemoCare clinical data.

    Maps ChemoCare's clinical_data dict to SOPHIA's PatientData model,
    then runs the deterministic engine for dose calculation and safety checks.

    Returns the full ProtocolResponse as a dict.
    """
    engine = get_sophia_engine()

    # Build patient data dict for the adapter
    patient_dict = _map_clinical_data_to_sophia(clinical_data, patient_age)

    # Use the adapter to convert to PatientData
    try:
        patient = PatientStateAdapter.adapt(patient_dict, target_cycle=cycle_number)
    except ValueError as e:
        raise ValueError(f"Missing required patient data: {e}")

    # Build the protocol request
    request = ProtocolRequest(
        protocol_code=protocol_code,
        patient=patient,
        cycle_number=cycle_number,
        excluded_drugs=excluded_drugs or [],
    )

    # Generate using deterministic engine
    response = engine.generate_protocol(request)

    return response.model_dump()


def _map_clinical_data_to_sophia(
    clinical_data: Dict[str, Any],
    patient_age: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Map ChemoCare's clinical_data JSON to SOPHIA adapter's expected format.

    ChemoCare stores clinical data as a flat/nested dict with keys like:
    - height_cm, weight_kg, cancer_type, disease_stage
    - full_blood_count: {wbc, hb, platelets, neutrophils}
    - liver_function: {alt, ast, alp, bilirubin}
    - gfr, creatinine, bilirubin, etc.
    - hep_b_core, hep_b_surface, etc.

    SOPHIA adapter expects:
    - weight, height, age, neutrophils, platelets, hemoglobin, bilirubin, gfr
    - hepbsurface, hepbcore, hiv, etc.
    """
    result: Dict[str, Any] = {}

    # Demographics
    result["weight"] = clinical_data.get("weight_kg")
    result["height"] = clinical_data.get("height_cm")
    result["age"] = patient_age or clinical_data.get("age") or 0

    # ECOG
    ps = clinical_data.get("performance_status") or clinical_data.get("ecog_score")
    if ps is not None:
        try:
            result["performance_status"] = int(ps)
        except (ValueError, TypeError):
            pass

    # Labs - extract from nested panels or top-level
    fbc = clinical_data.get("full_blood_count") or {}
    lft = clinical_data.get("liver_function") or {}

    result["neutrophils"] = (
        clinical_data.get("neutrophils")
        or fbc.get("neutrophils")
        or fbc.get("wbc")  # fallback to WBC if no neutrophils
    )
    result["platelets"] = clinical_data.get("platelets") or fbc.get("platelets")
    result["hemoglobin"] = clinical_data.get("hemoglobin") or fbc.get("hb") or fbc.get("hemoglobin")
    result["bilirubin"] = clinical_data.get("bilirubin") or lft.get("bilirubin")
    result["gfr"] = clinical_data.get("gfr") or clinical_data.get("creatinine_clearance")
    result["creatinine"] = clinical_data.get("creatinine")
    result["ast"] = clinical_data.get("ast") or lft.get("ast")
    result["alt"] = clinical_data.get("alt") or lft.get("alt")

    # Other labs
    for key in ["ldh", "esr", "urate", "calcium", "magnesium", "hba1c", "glucose"]:
        val = clinical_data.get(key)
        if val is not None:
            result[key] = val

    # Virology mapping (ChemoCare bool → SOPHIA string)
    viro_map = {
        "hep_b_surface": "hepbsurface",
        "hep_b_core": "hepbcore",
        "hep_c_antibody": "hepcantibody",
        "hiv": "hiv",
        "ebv": "ebv",
        "cmv": "cmv",
        "vzv": "vzv",
    }
    for cc_key, sophia_key in viro_map.items():
        val = clinical_data.get(cc_key)
        if val is True:
            result[sophia_key] = "positive"
        elif val is False:
            result[sophia_key] = "negative"
        elif isinstance(val, str) and val in ("positive", "negative", "unknown"):
            result[sophia_key] = val

    # G6PD
    g6pd = clinical_data.get("g6pd")
    if g6pd:
        result["g6pd"] = g6pd

    # Safety fields
    if clinical_data.get("known_allergies"):
        result["known_allergies"] = clinical_data["known_allergies"]

    # Cardiac / cumulative toxicity
    if clinical_data.get("prior_anthracycline_dose"):
        result["lifetimedoxorubicin"] = clinical_data["prior_anthracycline_dose"]
    if clinical_data.get("prior_cardiac_history"):
        result["heartDisease"] = True
    if clinical_data.get("lvef_percent") is not None:
        result["lvef_percent"] = clinical_data["lvef_percent"]
    if clinical_data.get("peripheral_neuropathy_grade") is not None:
        result["peripheral_neuropathy_grade"] = clinical_data["peripheral_neuropathy_grade"]
    if clinical_data.get("active_infection") is not None:
        result["active_infection"] = clinical_data["active_infection"]
    if clinical_data.get("pregnancy_status"):
        result["pregnancy_status"] = clinical_data["pregnancy_status"]
    if clinical_data.get("tls_risk"):
        result["tls_risk"] = clinical_data["tls_risk"]

    # Disease characterisation
    result["histology"] = clinical_data.get("histology")
    result["dstage"] = clinical_data.get("disease_stage")

    # Cycle tracking
    cycle_data = clinical_data.get("cycle_data") or {}
    for key, val in cycle_data.items():
        result[key] = val

    # Filter None values
    return {k: v for k, v in result.items() if v is not None}


def _extract_category(source_file: Optional[str]) -> str:
    """Extract category from source filename or protocol indication."""
    import re
    if not source_file:
        return "other"
    name = source_file.replace(".json", "").replace(".pdf", "").lower()
    # Strip date prefixes like 20260123_080318_
    name = re.sub(r"^\d{8}_\d{6}_", "", name)
    # Known category mappings
    if "lymphoma" in name:
        return "lymphoma"
    if "breast" in name:
        return "breast"
    if "lung" in name:
        return "lung"
    if "colorectal" in name or "gastrointestinal" in name or "folfox" in name or "folfiri" in name:
        return "gastrointestinal"
    if "myeloma" in name:
        return "myeloma"
    if "leukaemia" in name or "leukemia" in name or "all" in name.split("-") or "aml" in name.split("-"):
        return "haematology"
    if "car-t" in name or "tisacel" in name or "blinatumomab" in name or "inotuzumab" in name:
        return "haematology"
    if "cytarabine" in name or "etoposide" in name:
        return "haematology"
    if "sarcoma" in name:
        return "sarcoma"
    if "gynaecology" in name:
        return "gynaecology"
    if "urology" in name:
        return "urology"
    if "skin" in name:
        return "skin"
    if "cns" in name:
        return "cns"
    # Remove trailing numbers: breast-1 → breast
    cleaned = re.sub(r"[-_]\d+$", "", name)
    return cleaned or "other"
