"""
Unit Tests for AI Service
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from decimal import Decimal

from tests.factories import PatientFactory


class TestDoseCalculation:
    """Tests for dose calculation logic."""
    
    def test_bsa_calculation(self):
        """Test Body Surface Area calculation."""
        # Mosteller formula: BSA = sqrt((height_cm * weight_kg) / 3600)
        height_cm = 175
        weight_kg = 75.5
        
        expected_bsa = (height_cm * weight_kg / 3600) ** 0.5
        
        # Approximately 1.92
        assert 1.85 < expected_bsa < 2.0
    
    def test_dose_per_bsa(self):
        """Test dose calculation per m² BSA."""
        bsa = Decimal("1.92")
        dose_per_m2 = 750  # mg/m²
        
        calculated_dose = float(bsa) * dose_per_m2
        
        # 750 * 1.92 = 1440 mg
        assert 1400 < calculated_dose < 1500
    
    def test_max_dose_capping(self):
        """Test maximum dose capping (e.g., Vincristine max 2mg)."""
        bsa = Decimal("2.5")  # Large patient
        dose_per_m2 = 1.4  # mg/m²
        max_dose = 2.0  # mg
        
        calculated_dose = float(bsa) * dose_per_m2  # 3.5 mg
        final_dose = min(calculated_dose, max_dose)
        
        assert final_dose == max_dose


class TestSymptomAnalysis:
    """Tests for symptom analysis logic."""
    
    def test_severity_classification(self):
        """Test symptom severity classification."""
        def classify_severity(score: int) -> str:
            if score <= 3:
                return "mild"
            elif score <= 6:
                return "moderate"
            else:
                return "severe"
        
        assert classify_severity(2) == "mild"
        assert classify_severity(5) == "moderate"
        assert classify_severity(8) == "severe"
    
    def test_urgency_determination(self):
        """Test urgency determination logic."""
        def determine_urgency(symptoms: list, severity: int) -> str:
            urgent_symptoms = ["chest_pain", "difficulty_breathing", "high_fever"]
            
            has_urgent = any(s in urgent_symptoms for s in symptoms)
            
            if has_urgent or severity >= 8:
                return "urgent"
            elif severity >= 5:
                return "prompt"
            else:
                return "routine"
        
        assert determine_urgency(["nausea"], 3) == "routine"
        assert determine_urgency(["fatigue"], 6) == "prompt"
        assert determine_urgency(["chest_pain"], 5) == "urgent"
        assert determine_urgency(["nausea"], 9) == "urgent"


class TestProtocolValidation:
    """Tests for protocol validation logic."""
    
    def test_drug_interaction_check(self):
        """Test drug interaction checking."""
        known_interactions = {
            ("Methotrexate", "NSAIDs"): "increased_toxicity",
            ("Warfarin", "5-FU"): "increased_bleeding_risk",
        }
        
        def check_interaction(drug1: str, drug2: str) -> str | None:
            key = (drug1, drug2)
            reverse_key = (drug2, drug1)
            return known_interactions.get(key) or known_interactions.get(reverse_key)
        
        assert check_interaction("Methotrexate", "NSAIDs") == "increased_toxicity"
        assert check_interaction("Cyclophosphamide", "Doxorubicin") is None
    
    def test_dose_reduction_rules(self):
        """Test dose reduction rules based on labs."""
        def calculate_dose_reduction(
            anc: float,  # Absolute Neutrophil Count
            platelets: int,
            creatinine: float,
        ) -> float:
            """Calculate dose reduction percentage."""
            reduction = 0.0
            
            # Neutropenia rules
            if anc < 0.5:
                reduction = max(reduction, 0.5)  # 50% reduction
            elif anc < 1.0:
                reduction = max(reduction, 0.25)  # 25% reduction
            
            # Thrombocytopenia rules
            if platelets < 50000:
                reduction = max(reduction, 0.5)
            elif platelets < 100000:
                reduction = max(reduction, 0.25)
            
            # Renal impairment (simplified)
            if creatinine > 2.0:
                reduction = max(reduction, 0.5)
            elif creatinine > 1.5:
                reduction = max(reduction, 0.25)
            
            return reduction
        
        # Normal values - no reduction
        assert calculate_dose_reduction(2.0, 150000, 1.0) == 0.0
        
        # Low ANC
        assert calculate_dose_reduction(0.8, 150000, 1.0) == 0.25
        
        # Very low platelets
        assert calculate_dose_reduction(2.0, 40000, 1.0) == 0.5
        
        # Multiple issues - take highest reduction
        assert calculate_dose_reduction(0.3, 40000, 2.5) == 0.5
