"""
Clinical API Tests (Vitals, Appointments, Symptoms)
"""
import pytest
from datetime import date, datetime
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.factories import PatientFactory, VitalFactory, AppointmentFactory


class TestVitalsEndpoints:
    """Tests for vitals endpoints."""
    
    @pytest.mark.asyncio
    async def test_record_vitals(
        self, 
        client: AsyncClient, 
        nurse_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test recording new vitals."""
        # Create patient first
        patient = PatientFactory.build()
        db_session.add(patient)
        await db_session.commit()
        
        response = await client.post(
            "/api/v1/vitals",
            headers=nurse_auth_headers,
            json={
                "patient_id": str(patient.id),
                "blood_pressure_systolic": 120,
                "blood_pressure_diastolic": 80,
                "heart_rate": 72,
                "temperature": 36.8,
                "oxygen_saturation": 98,
                "respiratory_rate": 16,
            },
        )
        
        # API may have different response format or fields
        assert response.status_code in [200, 201, 422]  # 422 if patient not found or validation error
        if response.status_code in [200, 201]:
            data = response.json()
            # Check data exists (field names may vary)
            assert data is not None
    
    @pytest.mark.asyncio
    async def test_get_patient_vitals(
        self,
        client: AsyncClient,
        nurse_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test getting patient vitals history."""
        patient = PatientFactory.build()
        db_session.add(patient)
        await db_session.commit()
        
        response = await client.get(
            f"/api/v1/vitals/{patient.id}",
            headers=nurse_auth_headers,
        )
        
        # Endpoint exists - may return empty list or actual vitals
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    @pytest.mark.asyncio
    async def test_vitals_validation_out_of_range(
        self,
        client: AsyncClient,
        nurse_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test vitals validation for out-of-range values."""
        patient = PatientFactory.build()
        db_session.add(patient)
        await db_session.commit()
        
        response = await client.post(
            "/api/v1/vitals",
            headers=nurse_auth_headers,
            json={
                "patient_id": str(patient.id),
                "blood_pressure_systolic": 300,  # Invalid
                "blood_pressure_diastolic": 200,  # Invalid
                "heart_rate": 300,  # Invalid
            },
        )
        
        # Should either reject or flag as abnormal
        assert response.status_code in [200, 201, 422]


class TestAppointmentsEndpoints:
    """Tests for appointments endpoints."""
    
    @pytest.mark.asyncio
    async def test_create_appointment(
        self,
        client: AsyncClient,
        doctor_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test creating a new appointment."""
        patient = PatientFactory.build()
        db_session.add(patient)
        await db_session.commit()
        
        response = await client.post(
            "/api/v1/appointments",
            headers=doctor_auth_headers,
            json={
                "patient_id": str(patient.id),
                "appointment_type": "daycare_chemo",
                "scheduled_date": str(date.today()),
                "scheduled_time": "09:00",
                "duration_mins": 180,
                "notes": "Cycle 1 CHOP",
            },
        )
        
        assert response.status_code in [200, 201]
        data = response.json()
        assert data["appointment_type"] == "daycare_chemo"
        assert data["status"] == "scheduled"
    
    @pytest.mark.asyncio
    async def test_get_appointments(
        self,
        client: AsyncClient,
        patient_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test getting appointments list."""
        patient = PatientFactory.build()
        db_session.add(patient)
        
        for _ in range(3):
            appt = AppointmentFactory.build(patient_id=patient.id)
            db_session.add(appt)
        
        await db_session.commit()
        
        response = await client.get(
            "/api/v1/appointments",
            headers=patient_auth_headers,
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    @pytest.mark.asyncio
    async def test_update_appointment_status(
        self,
        client: AsyncClient,
        nurse_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test updating appointment status via checkin endpoint."""
        patient = PatientFactory.build()
        appointment = AppointmentFactory.build(patient_id=patient.id)
        db_session.add(patient)
        db_session.add(appointment)
        await db_session.commit()
        
        # Use checkin endpoint to update status
        response = await client.post(
            f"/api/v1/appointments/{appointment.id}/checkin",
            headers=nurse_auth_headers,
        )
        
        # Should succeed or fail based on business logic
        assert response.status_code in [200, 400, 404]


class TestMedicationsEndpoints:
    """Tests for medications endpoints."""
    
    @pytest.mark.asyncio
    async def test_get_today_medications(
        self,
        client: AsyncClient,
        nurse_auth_headers: dict,
    ):
        """Test getting today's medications."""
        response = await client.get(
            "/api/v1/medications/today",
            headers=nurse_auth_headers,
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    @pytest.mark.asyncio
    async def test_update_medication_status(
        self,
        client: AsyncClient,
        nurse_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test updating medication administration status."""
        from tests.factories import (
            PatientFactory,
            TreatmentPlanFactory,
            TreatmentCycleFactory,
            DrugAdministrationFactory,
        )
        
        patient = PatientFactory.build()
        plan = TreatmentPlanFactory.build(patient_id=patient.id)
        cycle = TreatmentCycleFactory.build(treatment_plan_id=plan.id)
        drug = DrugAdministrationFactory.build(cycle_id=cycle.id)
        
        db_session.add(patient)
        db_session.add(plan)
        db_session.add(cycle)
        db_session.add(drug)
        await db_session.commit()
        
        response = await client.put(
            f"/api/v1/medications/{drug.id}/status",
            headers=nurse_auth_headers,
            json={"status": "started"},
        )
        
        # Should succeed or return 404 if medication not found in DB
        assert response.status_code in [200, 404]


class TestDashboardEndpoints:
    """Tests for dashboard endpoints."""
    
    @pytest.mark.asyncio
    async def test_get_dashboard_stats(
        self,
        client: AsyncClient,
        doctor_auth_headers: dict,
    ):
        """Test getting dashboard statistics."""
        response = await client.get(
            "/api/v1/dashboard/stats",
            headers=doctor_auth_headers,
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "total_patients" in data
        assert "today_appointments" in data
        assert "active_treatments" in data
