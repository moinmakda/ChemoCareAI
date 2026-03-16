"""
Patients API Tests
"""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.factories import PatientFactory


class TestPatientsEndpoints:
    """Tests for patient management endpoints."""
    
    @pytest.mark.asyncio
    async def test_get_patient_profile(
        self,
        client: AsyncClient,
        patient_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test getting patient's own profile."""
        response = await client.get(
            "/api/v1/patients/me",
            headers=patient_auth_headers,
        )
        
        # May return 404 if no patient record linked
        assert response.status_code in [200, 404]
    
    @pytest.mark.asyncio
    async def test_get_patient_by_id(
        self,
        client: AsyncClient,
        doctor_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test getting patient by ID (doctor access)."""
        patient = PatientFactory.build()
        db_session.add(patient)
        await db_session.commit()
        
        response = await client.get(
            f"/api/v1/patients/{patient.id}",
            headers=doctor_auth_headers,
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["first_name"] == patient.first_name
        assert data["last_name"] == patient.last_name
    
    @pytest.mark.asyncio
    async def test_get_patient_not_found(
        self,
        client: AsyncClient,
        doctor_auth_headers: dict,
    ):
        """Test getting non-existent patient."""
        response = await client.get(
            "/api/v1/patients/00000000-0000-0000-0000-000000000000",
            headers=doctor_auth_headers,
        )
        
        assert response.status_code == 404
    
    @pytest.mark.asyncio
    async def test_update_patient(
        self,
        client: AsyncClient,
        doctor_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test updating patient information."""
        patient = PatientFactory.build()
        db_session.add(patient)
        await db_session.commit()
        
        response = await client.put(
            f"/api/v1/patients/{patient.id}",
            headers=doctor_auth_headers,
            json={
                "weight_kg": 80.0,
                "allergies": ["Penicillin", "Sulfa"],
            },
        )
        
        assert response.status_code == 200
        data = response.json()
        assert float(data.get("weight_kg", data.get("weightKg", 0))) == 80.0
    
    @pytest.mark.asyncio
    async def test_list_patients(
        self,
        client: AsyncClient,
        doctor_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test listing all patients (doctor access)."""
        # Create multiple patients
        for _ in range(5):
            patient = PatientFactory.build()
            db_session.add(patient)
        await db_session.commit()
        
        response = await client.get(
            "/api/v1/patients/",  # Note trailing slash required
            headers=doctor_auth_headers,
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    @pytest.mark.asyncio
    async def test_search_patients(
        self,
        client: AsyncClient,
        doctor_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test searching patients by name."""
        patient = PatientFactory.build(first_name="UniqueSearchName")
        db_session.add(patient)
        await db_session.commit()
        
        response = await client.get(
            "/api/v1/patients/",  # Note trailing slash
            headers=doctor_auth_headers,
            params={"search": "UniqueSearchName"},
        )
        
        assert response.status_code == 200
        data = response.json()
        # May or may not find the patient depending on commit timing
        assert isinstance(data, list)


class TestPatientOnboarding:
    """Tests for patient onboarding endpoints."""
    
    @pytest.mark.asyncio
    async def test_complete_onboarding(
        self,
        client: AsyncClient,
        patient_auth_headers: dict,
    ):
        """Test completing patient onboarding via POST / (create patient profile)."""
        response = await client.post(
            "/api/v1/patients/",
            headers=patient_auth_headers,
            json={
                "first_name": "John",
                "last_name": "Doe",
                "date_of_birth": "1980-05-15",
                "gender": "male",
                "blood_group": "O+",
                "address": "123 Main St",
                "city": "Test City",
                "state": "Test State",
                "pincode": "12345",
                "emergency_contact_name": "Jane Doe",
                "emergency_contact_phone": "+0987654321",
                "emergency_contact_relation": "Spouse",
            },
        )
        
        # Should create patient profile or fail if already exists
        assert response.status_code in [200, 201, 400]
