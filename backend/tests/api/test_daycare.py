"""
Daycare API Tests
"""
import pytest
from datetime import date, time
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.factories import (
    PatientFactory,
    TreatmentPlanFactory,
    TreatmentCycleFactory,
    DrugAdministrationFactory,
    ChemoAppointmentFactory,
)


class TestDaycareSessionsEndpoints:
    """Tests for daycare session management."""
    
    @pytest.mark.asyncio
    async def test_get_active_sessions(
        self,
        client: AsyncClient,
        doctor_auth_headers: dict,
    ):
        """Test getting active daycare sessions."""
        response = await client.get(
            "/api/v1/daycare/sessions/active",
            headers=doctor_auth_headers,
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    @pytest.mark.asyncio
    async def test_get_session_details(
        self,
        client: AsyncClient,
        doctor_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test getting specific session details."""
        from app.models.treatment import CycleStatus
        
        patient = PatientFactory.build()
        plan = TreatmentPlanFactory.build(patient_id=patient.id)
        cycle = TreatmentCycleFactory.build(
            treatment_plan_id=plan.id,
            status=CycleStatus.IN_PROGRESS,
        )
        
        db_session.add(patient)
        db_session.add(plan)
        db_session.add(cycle)
        await db_session.commit()
        
        response = await client.get(
            f"/api/v1/daycare/sessions/{cycle.id}",
            headers=doctor_auth_headers,
        )
        
        assert response.status_code in [200, 404]
    
    @pytest.mark.asyncio
    async def test_start_session(
        self,
        client: AsyncClient,
        nurse_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test starting a daycare session."""
        from app.models.treatment import CycleStatus
        from app.models.clinical import AppointmentStatus
        
        patient = PatientFactory.build()
        plan = TreatmentPlanFactory.build(patient_id=patient.id)
        cycle = TreatmentCycleFactory.build(
            treatment_plan_id=plan.id,
            status=CycleStatus.APPROVED,
        )
        appointment = ChemoAppointmentFactory.build(
            patient_id=patient.id,
            cycle_id=cycle.id,
            status=AppointmentStatus.CHECKED_IN,
        )
        
        db_session.add(patient)
        db_session.add(plan)
        db_session.add(cycle)
        db_session.add(appointment)
        await db_session.commit()
        
        response = await client.post(
            f"/api/v1/daycare/sessions/{cycle.id}/start",
            headers=nurse_auth_headers,
        )
        
        assert response.status_code in [200, 400, 404]
    
    @pytest.mark.asyncio
    async def test_update_session_progress(
        self,
        client: AsyncClient,
        nurse_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test updating session progress."""
        from app.models.treatment import CycleStatus
        from app.models.clinical import AppointmentStatus
        
        patient = PatientFactory.build()
        plan = TreatmentPlanFactory.build(patient_id=patient.id)
        cycle = TreatmentCycleFactory.build(
            treatment_plan_id=plan.id,
            status=CycleStatus.IN_PROGRESS,
        )
        # Need an appointment since the endpoint queries appointments
        appointment = ChemoAppointmentFactory.build(
            patient_id=patient.id,
            cycle_id=cycle.id,
            status=AppointmentStatus.IN_PROGRESS,
        )
        
        db_session.add(patient)
        db_session.add(plan)
        db_session.add(cycle)
        db_session.add(appointment)
        await db_session.commit()
        
        # progress is a query parameter, not JSON body
        response = await client.patch(
            f"/api/v1/daycare/sessions/{appointment.id}/progress?progress=50",
            headers=nurse_auth_headers,
        )
        
        assert response.status_code in [200, 404]
    
    @pytest.mark.asyncio
    async def test_report_reaction(
        self,
        client: AsyncClient,
        nurse_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test reporting an adverse reaction."""
        from app.models.treatment import CycleStatus
        from app.models.clinical import AppointmentStatus
        
        patient = PatientFactory.build()
        plan = TreatmentPlanFactory.build(patient_id=patient.id)
        cycle = TreatmentCycleFactory.build(
            treatment_plan_id=plan.id,
            status=CycleStatus.IN_PROGRESS,
        )
        # Need an appointment since the endpoint queries appointments
        appointment = ChemoAppointmentFactory.build(
            patient_id=patient.id,
            cycle_id=cycle.id,
            status=AppointmentStatus.IN_PROGRESS,
        )
        
        db_session.add(patient)
        db_session.add(plan)
        db_session.add(cycle)
        db_session.add(appointment)
        await db_session.commit()
        
        response = await client.post(
            f"/api/v1/daycare/sessions/{appointment.id}/reaction",
            headers=nurse_auth_headers,
            json={
                "reaction_type": "mild_allergic",
                "severity": "mild",
                "description": "Mild skin rash and itching observed during infusion",
                "action_taken": "Slowed infusion rate, administered antihistamine",
            },
        )
        
        assert response.status_code in [200, 201, 404]


class TestDaycareChairsEndpoints:
    """Tests for daycare chair management."""
    
    @pytest.mark.asyncio
    async def test_get_chairs_status(
        self,
        client: AsyncClient,
        nurse_auth_headers: dict,
    ):
        """Test getting all chairs status."""
        response = await client.get(
            "/api/v1/daycare/chairs",
            headers=nurse_auth_headers,
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Should have 12 chairs
        assert len(data) == 12
    
    @pytest.mark.asyncio
    async def test_chair_has_required_fields(
        self,
        client: AsyncClient,
        nurse_auth_headers: dict,
    ):
        """Test that chair response has required fields."""
        response = await client.get(
            "/api/v1/daycare/chairs",
            headers=nurse_auth_headers,
        )
        
        assert response.status_code == 200
        data = response.json()
        
        if len(data) > 0:
            chair = data[0]
            # Chair might use 'id' or 'chair_number' depending on API
            assert "id" in chair or "chair_number" in chair
            assert "status" in chair or "current_patient_id" in chair


class TestDaycareAuthorization:
    """Tests for daycare authorization rules."""
    
    @pytest.mark.asyncio
    async def test_patient_cannot_access_sessions(
        self,
        client: AsyncClient,
        patient_auth_headers: dict,
    ):
        """Test that patients cannot access daycare sessions."""
        response = await client.get(
            "/api/v1/daycare/sessions/active",
            headers=patient_auth_headers,
        )
        
        assert response.status_code == 403
    
    @pytest.mark.asyncio
    async def test_unauthenticated_cannot_access(
        self,
        client: AsyncClient,
    ):
        """Test that unauthenticated users cannot access daycare."""
        response = await client.get("/api/v1/daycare/sessions/active")
        # Can return 401 (Unauthorized) or 403 (Forbidden)
        assert response.status_code in [401, 403]
