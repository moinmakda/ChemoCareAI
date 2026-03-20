"""
SOPHIA Protocol Engine Integration Tests

Tests the deterministic protocol generation engine:
- Protocol loading (15 curated NHS protocols)
- Dose calculations (BSA-based, weight-based, flat-dose)
- Safety checks (hard stops, warnings, allergy cross-reactivity)
- Clinical data mapping from ChemoCare format
"""

import pytest
from app.services.sophia.sophia_service import (
    get_sophia_engine,
    list_protocols,
    search_protocols,
    get_protocol_detail,
    get_protocol_categories,
    generate_protocol_from_clinical_data,
)


class TestProtocolLoading:
    """Tests that the 15 curated NHS protocols load correctly."""

    def test_engine_initializes(self):
        engine = get_sophia_engine()
        assert engine is not None
        assert len(engine.protocols) == 15

    def test_categories_exist(self):
        cats = get_protocol_categories()
        cat_names = [c["name"] for c in cats]
        assert "lymphoma" in cat_names
        assert "haematology" in cat_names

    def test_total_protocol_count(self):
        cats = get_protocol_categories()
        total = sum(c["count"] for c in cats)
        assert total == 15

    def test_known_protocols_present(self):
        engine = get_sophia_engine()
        codes = list(engine.protocols.keys())
        assert "LYMPHOMA-RCHOP21" in codes
        assert "ABVD" in codes
        assert "BEACOPP-ESCALATED" in codes
        assert "BENDAMUSTINE-RITUXIMAB" in codes
        assert "CVP" in codes


class TestProtocolSearch:
    """Tests protocol searching and filtering."""

    def test_search_by_code(self):
        results = list_protocols(search="RCHOP")
        assert len(results) >= 1
        codes = [r["code"] for r in results]
        assert any("RCHOP" in c for c in codes)

    def test_search_by_drug(self):
        results = list_protocols(search="rituximab")
        assert len(results) > 0
        has_drug = any(
            any("rituximab" in d.lower() for d in r["drugs"])
            for r in results
        )
        has_name = any("rituximab" in r["name"].lower() or "rituximab" in r["code"].lower() for r in results)
        assert has_drug or has_name

    def test_filter_by_category(self):
        results = list_protocols(category="lymphoma")
        assert len(results) == 10
        for r in results:
            assert r["category"] == "lymphoma"

    def test_search_with_category(self):
        results = list_protocols(search="vincristine", category="lymphoma")
        assert len(results) > 0

    def test_protocol_detail(self):
        detail = get_protocol_detail("LYMPHOMA-RCHOP21")
        assert detail is not None
        assert detail["protocol_code"] == "LYMPHOMA-RCHOP21"
        assert len(detail["drugs"]) == 5

    def test_unknown_protocol_returns_none(self):
        detail = get_protocol_detail("NONEXISTENT-PROTOCOL-XYZ")
        assert detail is None


class TestDoseCalculation:
    """Tests deterministic dose calculations."""

    def _generate(self, **overrides):
        """Helper to generate RCHOP21 with defaults."""
        defaults = {
            "protocol_code": "LYMPHOMA-RCHOP21",
            "clinical_data": {
                "weight_kg": 75,
                "height_cm": 175,
                "performance_status": "0",
                "neutrophils": 2.5,
                "platelets": 150,
                "hemoglobin": 12.0,
                "bilirubin": 15,
                "gfr": 85,
            },
            "patient_age": 55,
            "cycle_number": 1,
        }
        defaults.update(overrides)
        return generate_protocol_from_clinical_data(**defaults)

    def test_bsa_calculation(self):
        result = self._generate()
        # BSA = sqrt(175 * 75 / 3600) = 1.91 m²
        assert 1.85 < result["patient_bsa"] < 1.95
        assert result["patient_bsa_capped"] is False

    def test_bsa_capped_for_obese(self):
        result = self._generate(clinical_data={
            "weight_kg": 150,
            "height_cm": 175,
            "performance_status": "0",
            "neutrophils": 2.5,
            "platelets": 150,
            "hemoglobin": 12.0,
            "bilirubin": 15,
            "gfr": 85,
        })
        assert result["patient_bsa"] == 2.0
        assert result["patient_bsa_capped"] is True

    def test_vincristine_hard_cap(self):
        result = self._generate()
        vincristine = next(
            d for d in result["chemotherapy_drugs"]
            if d["drug_name"] == "Vincristine"
        )
        # Vincristine max 2.0 mg regardless of BSA
        assert vincristine["calculated_dose"] == 2.0
        assert vincristine["dose_modified"] is True
        assert "cap" in vincristine["modification_reason"].lower()

    def test_rituximab_dose(self):
        result = self._generate()
        rituximab = next(
            d for d in result["chemotherapy_drugs"]
            if d["drug_name"] == "Rituximab"
        )
        # 375 mg/m² × ~1.91 m² ≈ 716 mg
        assert 700 < rituximab["calculated_dose"] < 730

    def test_no_delay_normal_labs(self):
        result = self._generate()
        assert result["treatment_delay_recommended"] is False
        assert result["treatment_absolutely_contraindicated"] is False


class TestSafetyChecks:
    """Tests safety checks: hard stops, delays, warnings."""

    def _generate(self, clinical_data_overrides=None, **kwargs):
        base = {
            "weight_kg": 75,
            "height_cm": 175,
            "performance_status": "0",
            "neutrophils": 2.5,
            "platelets": 150,
            "hemoglobin": 12.0,
            "bilirubin": 15,
            "gfr": 85,
        }
        if clinical_data_overrides:
            base.update(clinical_data_overrides)
        defaults = {
            "protocol_code": "LYMPHOMA-RCHOP21",
            "clinical_data": base,
            "patient_age": 55,
            "cycle_number": 1,
        }
        defaults.update(kwargs)
        return generate_protocol_from_clinical_data(**defaults)

    def test_neutrophil_hard_stop(self):
        result = self._generate({"neutrophils": 0.3, "platelets": 40})
        assert result["treatment_absolutely_contraindicated"] is True
        critical = [w for w in result["warnings"] if w["level"] == "critical"]
        assert len(critical) >= 2  # neutrophils + platelets

    def test_treatment_delay_low_neutrophils(self):
        result = self._generate({"neutrophils": 0.8})
        assert result["treatment_delay_recommended"] is True
        assert any("neutrophil" in r.lower() for r in result["delay_reasons"])

    def test_platinum_allergy_cross_reactivity(self):
        result = self._generate(
            {"known_allergies": ["platinum"]},
            protocol_code="GDP",
        )
        critical = [w for w in result["warnings"] if w["level"] == "critical"]
        assert len(critical) >= 1
        assert any("allerg" in w["message"].lower() or "cross-react" in w["message"].lower() for w in critical)
        # Cisplatin should be omitted due to platinum allergy
        drug_names = [d["drug_name"] for d in result["chemotherapy_drugs"]]
        assert "Cisplatin" not in drug_names

    def test_hbv_warning_for_rituximab(self):
        result = self._generate({"hep_b_core": "positive", "hep_b_surface": "negative"})
        warnings = [w for w in result["warnings"] if "hbv" in w["message"].lower() or "hb" in w["message"].lower()]
        assert len(warnings) >= 1

    def test_lvef_warning_for_anthracycline(self):
        result = self._generate()
        warnings = [w for w in result["warnings"] if "lvef" in w["message"].lower()]
        assert len(warnings) >= 1  # Should recommend baseline LVEF

    def test_active_infection_warning(self):
        result = self._generate({"active_infection": True})
        # Engine issues a CRITICAL warning for active infection
        critical = [w for w in result["warnings"] if w["level"] == "critical"]
        assert any("infection" in w["message"].lower() for w in critical)


class TestClinicalDataMapping:
    """Tests that ChemoCare clinical data maps correctly to SOPHIA."""

    def test_missing_mandatory_labs_raises(self):
        with pytest.raises(ValueError, match="required"):
            generate_protocol_from_clinical_data(
                protocol_code="LYMPHOMA-RCHOP21",
                clinical_data={
                    "weight_kg": 75,
                    "height_cm": 175,
                    "performance_status": "0",
                    # Missing: neutrophils, platelets, hemoglobin, bilirubin, gfr
                },
                patient_age=55,
            )

    def test_missing_weight_raises(self):
        with pytest.raises(ValueError, match="weight"):
            generate_protocol_from_clinical_data(
                protocol_code="LYMPHOMA-RCHOP21",
                clinical_data={
                    "height_cm": 175,
                    "performance_status": "0",
                    "neutrophils": 2.5,
                    "platelets": 150,
                    "hemoglobin": 12.0,
                    "bilirubin": 15,
                    "gfr": 85,
                },
                patient_age=55,
            )

    def test_protocol_not_found_raises(self):
        with pytest.raises(ValueError, match="not found"):
            generate_protocol_from_clinical_data(
                protocol_code="NONEXISTENT-XYZ",
                clinical_data={
                    "weight_kg": 75,
                    "height_cm": 175,
                    "performance_status": "0",
                    "neutrophils": 2.5,
                    "platelets": 150,
                    "hemoglobin": 12.0,
                    "bilirubin": 15,
                    "gfr": 85,
                },
                patient_age=55,
            )
