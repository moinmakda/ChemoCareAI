#!/usr/bin/env python3
"""
Comprehensive API test script for ChemoCare backend.
Tests all major endpoints to catch errors before deployment.
"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import date, time
from httpx import AsyncClient, ASGITransport
from app.main import app

BASE_URL = "http://test"

# Test credentials
TEST_PATIENT = {"email": "patient@test.com", "password": "test1234"}
TEST_DOCTOR = {"email": "doctor@test.com", "password": "test1234"}
TEST_NURSE = {"email": "nurse@test.com", "password": "test1234"}


async def test_auth_endpoints(client: AsyncClient):
    """Test authentication endpoints."""
    print("\n=== AUTH ENDPOINTS ===")
    errors = []
    
    # Test login
    print("Testing POST /auth/login...")
    response = await client.post("/api/v1/auth/login", json=TEST_PATIENT)
    if response.status_code != 200:
        errors.append(f"Login failed: {response.status_code} - {response.text}")
        print(f"  ❌ Login failed: {response.status_code}")
        return None, errors
    
    tokens = response.json()
    access_token = tokens.get("access_token")
    refresh_token = tokens.get("refresh_token")
    print(f"  ✅ Login successful")
    
    # Test /auth/me
    print("Testing GET /auth/me...")
    response = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {access_token}"}
    )
    if response.status_code != 200:
        errors.append(f"Get me failed: {response.status_code} - {response.text}")
        print(f"  ❌ Get me failed: {response.status_code}")
    else:
        print(f"  ✅ Get me successful: {response.json().get('email')}")
    
    # Test refresh token
    print("Testing POST /auth/refresh...")
    response = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token}
    )
    if response.status_code != 200:
        errors.append(f"Refresh failed: {response.status_code} - {response.text}")
        print(f"  ❌ Refresh failed: {response.status_code}")
    else:
        new_tokens = response.json()
        access_token = new_tokens.get("access_token")
        print(f"  ✅ Refresh successful")
    
    return access_token, errors


async def test_patient_endpoints(client: AsyncClient, token: str):
    """Test patient endpoints."""
    print("\n=== PATIENT ENDPOINTS ===")
    errors = []
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test get my patient profile
    print("Testing GET /patients/me...")
    response = await client.get("/api/v1/patients/me", headers=headers)
    if response.status_code == 404:
        print(f"  ⚠️ No patient profile exists (expected for new users)")
    elif response.status_code != 200:
        errors.append(f"Get patient/me failed: {response.status_code} - {response.text}")
        print(f"  ❌ Get patient/me failed: {response.status_code}")
    else:
        patient = response.json()
        print(f"  ✅ Got patient profile: {patient.get('first_name')} {patient.get('last_name')}")
        return patient.get("id"), errors
    
    return None, errors


async def test_vitals_endpoints(client: AsyncClient, token: str, patient_id: str):
    """Test vitals endpoints."""
    print("\n=== VITALS ENDPOINTS ===")
    errors = []
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test patient self-logging vitals
    print("Testing POST /vitals/me...")
    vital_data = {
        "temperature_f": 98.6,
        "pulse_bpm": 72,
        "blood_pressure_systolic": 120,
        "blood_pressure_diastolic": 80,
        "weight_kg": 70.0,
        "notes": "Feeling good today"
    }
    response = await client.post("/api/v1/vitals/me", json=vital_data, headers=headers)
    if response.status_code not in [200, 201]:
        errors.append(f"Log vitals failed: {response.status_code} - {response.text}")
        print(f"  ❌ Log vitals failed: {response.status_code} - {response.text[:100]}")
    else:
        print(f"  ✅ Logged vitals successfully")
    
    # Test get my vitals
    print("Testing GET /vitals/me...")
    response = await client.get("/api/v1/vitals/me", headers=headers)
    if response.status_code != 200:
        errors.append(f"Get vitals failed: {response.status_code} - {response.text}")
        print(f"  ❌ Get vitals failed: {response.status_code}")
    else:
        vitals = response.json()
        print(f"  ✅ Got {len(vitals)} vital records")
    
    return errors


async def test_symptoms_endpoints(client: AsyncClient, token: str):
    """Test symptom endpoints."""
    print("\n=== SYMPTOMS ENDPOINTS ===")
    errors = []
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test patient self-logging symptoms
    print("Testing POST /symptoms/me...")
    symptom_data = {
        "nausea_score": 3,
        "fatigue_score": 4,
        "pain_score": 2,
        "has_fever": False,
        "has_mouth_sores": False,
        "mood_notes": "Feeling okay"
    }
    response = await client.post("/api/v1/symptoms/me", json=symptom_data, headers=headers)
    if response.status_code not in [200, 201]:
        errors.append(f"Log symptoms failed: {response.status_code} - {response.text}")
        print(f"  ❌ Log symptoms failed: {response.status_code} - {response.text[:100]}")
    else:
        print(f"  ✅ Logged symptoms successfully")
    
    # Test get my symptoms
    print("Testing GET /symptoms/me...")
    response = await client.get("/api/v1/symptoms/me", headers=headers)
    if response.status_code != 200:
        errors.append(f"Get symptoms failed: {response.status_code} - {response.text}")
        print(f"  ❌ Get symptoms failed: {response.status_code}")
    else:
        symptoms = response.json()
        print(f"  ✅ Got {len(symptoms)} symptom records")
    
    return errors


async def test_appointments_endpoints(client: AsyncClient, token: str):
    """Test appointment endpoints."""
    print("\n=== APPOINTMENTS ENDPOINTS ===")
    errors = []
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test list appointments
    print("Testing GET /appointments...")
    response = await client.get("/api/v1/appointments", headers=headers)
    if response.status_code != 200:
        errors.append(f"List appointments failed: {response.status_code} - {response.text}")
        print(f"  ❌ List appointments failed: {response.status_code}")
    else:
        appointments = response.json()
        print(f"  ✅ Got {len(appointments)} appointments")
    
    return errors


async def test_doctor_endpoints(client: AsyncClient):
    """Test doctor-specific endpoints."""
    print("\n=== DOCTOR ENDPOINTS ===")
    errors = []
    
    # Login as doctor
    response = await client.post("/api/v1/auth/login", json=TEST_DOCTOR)
    if response.status_code != 200:
        errors.append(f"Doctor login failed: {response.status_code}")
        print(f"  ❌ Doctor login failed")
        return errors
    
    tokens = response.json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    
    # Test list patients (staff only)
    print("Testing GET /patients/...")
    response = await client.get("/api/v1/patients/", headers=headers)
    if response.status_code != 200:
        errors.append(f"List patients failed: {response.status_code} - {response.text}")
        print(f"  ❌ List patients failed: {response.status_code}")
    else:
        patients = response.json()
        print(f"  ✅ Got {len(patients)} patients")
    
    # Test protocols list
    print("Testing GET /protocols...")
    response = await client.get("/api/v1/protocols", headers=headers)
    if response.status_code != 200:
        errors.append(f"List protocols failed: {response.status_code} - {response.text}")
        print(f"  ❌ List protocols failed: {response.status_code}")
    else:
        protocols = response.json()
        print(f"  ✅ Got {len(protocols)} protocols")
    
    return errors


async def test_nurse_endpoints(client: AsyncClient):
    """Test nurse-specific endpoints."""
    print("\n=== NURSE ENDPOINTS ===")
    errors = []
    
    # Login as nurse
    response = await client.post("/api/v1/auth/login", json=TEST_NURSE)
    if response.status_code != 200:
        errors.append(f"Nurse login failed: {response.status_code}")
        print(f"  ❌ Nurse login failed")
        return errors
    
    tokens = response.json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    print(f"  ✅ Nurse login successful")
    
    # Test list patients
    print("Testing GET /patients/...")
    response = await client.get("/api/v1/patients/", headers=headers)
    if response.status_code != 200:
        errors.append(f"Nurse list patients failed: {response.status_code} - {response.text}")
        print(f"  ❌ Nurse list patients failed: {response.status_code}")
    else:
        patients = response.json()
        print(f"  ✅ Got {len(patients)} patients")
    
    return errors


async def main():
    """Run all tests."""
    print("=" * 60)
    print("ChemoCare API Comprehensive Test")
    print("=" * 60)
    
    all_errors = []
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url=BASE_URL) as client:
        # Test auth
        token, errors = await test_auth_endpoints(client)
        all_errors.extend(errors)
        
        if token:
            # Test patient endpoints
            patient_id, errors = await test_patient_endpoints(client, token)
            all_errors.extend(errors)
            
            if patient_id:
                # Test vitals
                errors = await test_vitals_endpoints(client, token, patient_id)
                all_errors.extend(errors)
                
                # Test symptoms
                errors = await test_symptoms_endpoints(client, token)
                all_errors.extend(errors)
            
            # Test appointments
            errors = await test_appointments_endpoints(client, token)
            all_errors.extend(errors)
        
        # Test doctor endpoints
        errors = await test_doctor_endpoints(client)
        all_errors.extend(errors)
        
        # Test nurse endpoints
        errors = await test_nurse_endpoints(client)
        all_errors.extend(errors)
    
    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    
    if all_errors:
        print(f"\n❌ {len(all_errors)} ERRORS FOUND:\n")
        for i, error in enumerate(all_errors, 1):
            print(f"  {i}. {error[:200]}")
        print()
        sys.exit(1)
    else:
        print("\n✅ ALL TESTS PASSED!\n")
        sys.exit(0)


if __name__ == "__main__":
    asyncio.run(main())
