"""
Discharge Summary Generator

Generates structured discharge summaries when a treatment cycle is completed.
Purely deterministic — no AI involved. Assembles data from the cycle, plan,
patient, vitals, and drug administrations into a printable summary.
"""
import json
from datetime import datetime, date, timedelta
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    TreatmentCycle,
    TreatmentPlan,
    Patient,
    DrugAdministration,
    Vital,
)


# Standard chemotherapy warning signs — always included
STANDARD_WARNING_SIGNS = [
    "Fever above 100.4°F (38°C) or chills",
    "Uncontrolled nausea or vomiting lasting more than 24 hours",
    "Severe diarrhea (more than 4 episodes per day)",
    "Signs of infection: redness, swelling, or pus at IV site",
    "Unusual bleeding or bruising",
    "Difficulty breathing or shortness of breath",
    "Severe mouth sores preventing eating or drinking",
    "Signs of dehydration: dark urine, dizziness, dry mouth",
    "Numbness or tingling in hands or feet that worsens",
    "Allergic reaction: rash, hives, swelling of face or throat",
]


async def generate_discharge_summary(
    db: AsyncSession, cycle_id: UUID
) -> Dict[str, Any]:
    """
    Generate a structured discharge summary for a completed treatment cycle.

    Args:
        db: Async database session
        cycle_id: UUID of the completed TreatmentCycle

    Returns:
        Dict with all discharge summary fields

    Raises:
        ValueError: If cycle or related data not found
    """
    # 1. Load the cycle with drug administrations
    result = await db.execute(
        select(TreatmentCycle)
        .options(selectinload(TreatmentCycle.drug_administrations))
        .where(TreatmentCycle.id == cycle_id)
    )
    cycle = result.scalar_one_or_none()
    if not cycle:
        raise ValueError(f"Treatment cycle not found: {cycle_id}")

    # 2. Load the treatment plan
    result = await db.execute(
        select(TreatmentPlan).where(TreatmentPlan.id == cycle.treatment_plan_id)
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise ValueError(f"Treatment plan not found for cycle: {cycle_id}")

    # 3. Load the patient
    result = await db.execute(
        select(Patient).where(Patient.id == plan.patient_id)
    )
    patient = result.scalar_one_or_none()
    if not patient:
        raise ValueError(f"Patient not found for plan: {plan.id}")

    # 4. Load latest vitals for this patient (most recent first, limit 1)
    result = await db.execute(
        select(Vital)
        .where(Vital.patient_id == patient.id)
        .order_by(Vital.recorded_at.desc())
        .limit(1)
    )
    latest_vital = result.scalar_one_or_none()

    # 5. Build drugs administered list
    drugs_administered = _build_drugs_administered(cycle.drug_administrations)

    # 6. Build vitals dict
    vitals = _build_vitals_dict(latest_vital, cycle)

    # 7. Extract reactions from drug administrations
    reactions = _extract_reactions(cycle)

    # 8. Build dose modifications info
    dose_modifications = _build_dose_modifications(cycle)

    # 9. Calculate next cycle date and number
    next_cycle_date, next_cycle_number = await _get_next_cycle_info(
        db, plan, cycle.cycle_number
    )

    # 10. Extract take-home medications from protocol
    take_home_medications = _extract_take_home_medications(plan.custom_protocol)

    # 11. Extract pre-medications given
    pre_medications = _extract_protocol_drugs(plan.custom_protocol, "pre_medications")

    # 12. Extract rescue medications (PRN)
    rescue_medications = _extract_protocol_drugs(plan.custom_protocol, "rescue_medications")

    # 13. Extract monitoring requirements
    monitoring = _extract_monitoring(plan.custom_protocol)

    # 14. Extract special instructions / warnings from protocol
    protocol_warnings = _extract_protocol_warnings(plan.custom_protocol)

    # 15. Build follow-up instructions
    follow_up = _build_follow_up_instructions(
        cycle, plan, next_cycle_date
    )

    # 16. Assemble the summary
    summary = {
        "patient_name": patient.full_name,
        "patient_age": patient.age,
        "diagnosis": _build_diagnosis(patient),
        "protocol_name": plan.protocol_name or "Unknown Protocol",
        "cycle_number": cycle.cycle_number,
        "total_cycles": plan.planned_cycles,
        "cycle_date": str(cycle.actual_date or cycle.scheduled_date),
        "drugs_administered": drugs_administered,
        "pre_medications_given": pre_medications,
        "vitals": vitals,
        "reactions": reactions,
        "dose_modifications": dose_modifications,
        "next_cycle_date": str(next_cycle_date) if next_cycle_date else None,
        "next_cycle_number": next_cycle_number,
        "take_home_medications": take_home_medications,
        "rescue_medications": rescue_medications,
        "monitoring_requirements": monitoring,
        "protocol_warnings": protocol_warnings,
        "follow_up_instructions": follow_up,
        "warning_signs": STANDARD_WARNING_SIGNS,
        "generated_at": datetime.utcnow().isoformat(),
    }

    return summary


def _build_drugs_administered(
    drug_admins: List[DrugAdministration],
) -> List[Dict[str, Any]]:
    """Build list of drugs administered with details."""
    drugs = []
    for da in drug_admins:
        drug = {
            "drug_name": da.drug_name,
            "planned_dose": float(da.planned_dose) if da.planned_dose else 0,
            "actual_dose": float(da.actual_dose) if da.actual_dose else None,
            "unit": da.unit,
            "route": da.route,
            "status": da.status.value if hasattr(da.status, "value") else str(da.status),
            "planned_duration_mins": da.planned_duration_mins,
            "actual_duration_mins": da.actual_duration_mins,
        }
        drugs.append(drug)
    return drugs


def _build_vitals_dict(
    latest_vital: Optional[Vital], cycle: TreatmentCycle
) -> Optional[Dict[str, Any]]:
    """Build vitals dictionary from latest vital record or pre-chemo vitals."""
    # Prefer pre-chemo vitals stored on the cycle
    if cycle.pre_chemo_vitals:
        return cycle.pre_chemo_vitals

    if not latest_vital:
        return None

    vitals: Dict[str, Any] = {}
    if latest_vital.temperature_f:
        vitals["temperature_f"] = float(latest_vital.temperature_f)
    if latest_vital.pulse_bpm:
        vitals["pulse_bpm"] = latest_vital.pulse_bpm
    if latest_vital.blood_pressure_systolic and latest_vital.blood_pressure_diastolic:
        vitals["blood_pressure"] = (
            f"{latest_vital.blood_pressure_systolic}/{latest_vital.blood_pressure_diastolic}"
        )
    if latest_vital.respiratory_rate:
        vitals["respiratory_rate"] = latest_vital.respiratory_rate
    if latest_vital.oxygen_saturation:
        vitals["oxygen_saturation"] = latest_vital.oxygen_saturation
    if latest_vital.weight_kg:
        vitals["weight_kg"] = float(latest_vital.weight_kg)
    if latest_vital.pain_score is not None:
        vitals["pain_score"] = latest_vital.pain_score

    return vitals if vitals else None


def _extract_reactions(cycle: TreatmentCycle) -> Optional[List[str]]:
    """Extract reactions from cycle and drug administrations."""
    reactions = []

    # Check immediate_reactions on the cycle
    if cycle.immediate_reactions:
        if isinstance(cycle.immediate_reactions, list):
            for r in cycle.immediate_reactions:
                if isinstance(r, str):
                    reactions.append(r)
                elif isinstance(r, dict):
                    desc = r.get("description") or r.get("reaction") or str(r)
                    reactions.append(desc)
        elif isinstance(cycle.immediate_reactions, dict):
            for key, val in cycle.immediate_reactions.items():
                reactions.append(f"{key}: {val}")

    # Check drug administration reactions
    for da in cycle.drug_administrations:
        if da.reactions:
            for r in da.reactions:
                if isinstance(r, str):
                    reactions.append(f"{da.drug_name}: {r}")
                elif isinstance(r, dict):
                    desc = r.get("description") or r.get("reaction") or str(r)
                    severity = r.get("severity", "")
                    prefix = f"{da.drug_name}"
                    if severity:
                        prefix += f" ({severity})"
                    reactions.append(f"{prefix}: {desc}")

    return reactions if reactions else None


def _build_dose_modifications(cycle: TreatmentCycle) -> Optional[str]:
    """Build dose modification description."""
    parts = []
    if cycle.dose_modifications:
        if isinstance(cycle.dose_modifications, dict):
            for drug, mod in cycle.dose_modifications.items():
                if isinstance(mod, dict):
                    pct = mod.get("reduction_percent", mod.get("percentage", ""))
                    reason = mod.get("reason", "")
                    parts.append(
                        f"{drug}: {pct}% reduction" + (f" ({reason})" if reason else "")
                    )
                else:
                    parts.append(f"{drug}: {mod}")
        elif isinstance(cycle.dose_modifications, str):
            parts.append(cycle.dose_modifications)

    if cycle.modification_reason and not parts:
        parts.append(cycle.modification_reason)

    return "; ".join(parts) if parts else None


async def _get_next_cycle_info(
    db: AsyncSession, plan: TreatmentPlan, current_cycle_number: int
) -> tuple[Optional[date], Optional[int]]:
    """Find the next scheduled cycle after the current one."""
    next_number = current_cycle_number + 1

    # If we've completed all planned cycles, no next cycle
    if next_number > plan.planned_cycles:
        return None, None

    result = await db.execute(
        select(TreatmentCycle)
        .where(
            TreatmentCycle.treatment_plan_id == plan.id,
            TreatmentCycle.cycle_number == next_number,
        )
    )
    next_cycle = result.scalar_one_or_none()

    if next_cycle:
        return next_cycle.scheduled_date, next_cycle.cycle_number

    # Estimate from protocol cycle length if no cycle row exists
    protocol = plan.custom_protocol or {}
    cycle_length = protocol.get("cycle_length_days", 21)
    estimated_date = date.today() + timedelta(days=cycle_length)
    return estimated_date, next_number


def _extract_take_home_medications(
    custom_protocol: Optional[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Extract take-home medications from protocol data."""
    if not custom_protocol:
        return []

    take_home = (
        custom_protocol.get("take_home_medicines")
        or custom_protocol.get("take_home_medications")
        or []
    )

    medications = []
    for med in take_home:
        medications.append(
            {
                "drug_name": med.get("drug_name") or med.get("drugName") or med.get("name", "Unknown"),
                "dose": med.get("calculated_dose") or med.get("calculatedDose") or med.get("dose", ""),
                "unit": med.get("calculated_dose_unit") or med.get("calculatedDoseUnit") or med.get("unit", ""),
                "route": med.get("route", "Oral"),
                "frequency": med.get("frequency", ""),
                "duration": med.get("duration", ""),
                "instructions": med.get("special_instructions") or med.get("instructions", ""),
            }
        )

    return medications


def _extract_protocol_drugs(
    custom_protocol: Optional[Dict[str, Any]],
    key: str,
) -> List[Dict[str, Any]]:
    """Extract a list of drugs (pre_medications, rescue_medications) from protocol."""
    if not custom_protocol:
        return []

    drugs_list = custom_protocol.get(key, [])
    result = []
    for d in drugs_list:
        result.append({
            "name": d.get("drug_name") or d.get("drugName") or d.get("name", ""),
            "dose": d.get("calculated_dose") or d.get("calculatedDose") or d.get("dose", ""),
            "unit": d.get("calculated_dose_unit") or d.get("calculatedDoseUnit") or d.get("dose_unit") or d.get("unit", ""),
            "route": d.get("route", ""),
            "instructions": d.get("special_instructions") or d.get("specialInstructions") or d.get("timing") or "",
            "prn": d.get("prn", False),
        })
    return result


def _extract_monitoring(
    custom_protocol: Optional[Dict[str, Any]],
) -> List[str]:
    """Extract monitoring requirements from protocol."""
    if not custom_protocol:
        return []

    monitoring = custom_protocol.get("monitoring_requirements") or custom_protocol.get("monitoring") or []
    if isinstance(monitoring, list):
        return [str(m) for m in monitoring]
    return []


def _extract_protocol_warnings(
    custom_protocol: Optional[Dict[str, Any]],
) -> List[str]:
    """Extract special warnings/instructions from protocol."""
    if not custom_protocol:
        return []

    result = []

    # Warnings array
    warnings = custom_protocol.get("warnings") or []
    for w in warnings:
        if isinstance(w, str):
            result.append(w)
        elif isinstance(w, dict):
            msg = w.get("message", "")
            if msg:
                result.append(msg)

    # Special instructions
    instructions = custom_protocol.get("special_instructions") or []
    for i in instructions:
        if isinstance(i, str) and i not in result:
            result.append(i)

    # Dose modifications applied
    mods = custom_protocol.get("dose_modifications_applied") or []
    for m in mods:
        if isinstance(m, str) and m not in result:
            result.append(f"Dose modification: {m}")

    return result


def _build_diagnosis(patient: Patient) -> Optional[str]:
    """Build diagnosis string from patient data."""
    parts = []
    if patient.cancer_type:
        parts.append(patient.cancer_type)
    if patient.cancer_stage:
        parts.append(f"Stage {patient.cancer_stage}")
    return " - ".join(parts) if parts else None


def _build_follow_up_instructions(
    cycle: TreatmentCycle,
    plan: TreatmentPlan,
    next_cycle_date: Optional[date],
) -> str:
    """Build follow-up instruction text."""
    instructions = []

    # Include custom follow-up instructions if provided
    if cycle.follow_up_instructions:
        instructions.append(cycle.follow_up_instructions)

    # Standard post-chemo instructions
    instructions.append("Stay well hydrated — aim for 8-10 glasses of water daily.")
    instructions.append(
        "Take all prescribed take-home medications as directed."
    )
    instructions.append(
        "Monitor your temperature twice daily for the first week."
    )
    instructions.append(
        "Avoid crowds and contact with sick individuals for the first 7-10 days."
    )
    instructions.append(
        "Maintain a balanced diet; eat small, frequent meals if nauseous."
    )

    if next_cycle_date:
        instructions.append(
            f"Next treatment cycle scheduled for {next_cycle_date.strftime('%d %B %Y')}. "
            "Please get pre-chemo blood work done 2-3 days before."
        )
    else:
        # Last cycle
        instructions.append(
            "This was your final planned cycle. Your oncologist will schedule a "
            "follow-up appointment to review your treatment response."
        )

    instructions.append(
        "Contact the hospital immediately if you experience any of the warning signs listed above."
    )

    return "\n".join(instructions)
