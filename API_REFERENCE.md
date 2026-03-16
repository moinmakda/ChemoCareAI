# ChemoCare AI - API Reference

## Base URL

```
Development: http://localhost:8000/api/v1
Production:  https://api.chemocare.ai/api/v1
```

## Authentication

All endpoints (except `/auth/register` and `/auth/login`) require a Bearer token:

```http
Authorization: Bearer <access_token>
```

## Response Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Invalid/expired token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found |
| 422 | Validation Error |
| 500 | Internal Server Error |

---

## Authentication Endpoints

### Register User

```http
POST /auth/register
```

**Request Body:**
```json
{
  "email": "patient@example.com",
  "password": "SecurePassword123!",
  "full_name": "John Doe",
  "role": "patient"
}
```

**Response (201):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "patient@example.com",
  "full_name": "John Doe",
  "role": "patient",
  "is_active": true,
  "is_verified": false,
  "created_at": "2026-01-25T10:30:00Z"
}
```

### Login

```http
POST /auth/login
```

**Request Body:**
```json
{
  "email": "patient@example.com",
  "password": "SecurePassword123!"
}
```

**Response (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 1800,
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "patient@example.com",
    "full_name": "John Doe",
    "role": "patient"
  }
}
```

### Refresh Token

```http
POST /auth/refresh
```

**Request Body:**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 1800
}
```

### Get Current User

```http
GET /auth/me
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "patient@example.com",
  "full_name": "John Doe",
  "role": "patient",
  "is_active": true,
  "is_verified": true,
  "avatar": "https://...",
  "created_at": "2026-01-25T10:30:00Z",
  "last_login": "2026-01-26T08:00:00Z"
}
```

### Update Push Token

```http
PUT /auth/push-token
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "push_token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Push token updated"
}
```

---

## Patient Endpoints

### Get Patient Profile (Self)

```http
GET /patients/me
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "first_name": "John",
  "last_name": "Doe",
  "date_of_birth": "1965-03-15",
  "gender": "male",
  "blood_group": "B+",
  "phone": "+91 9876543210",
  "address": "123 Main Street",
  "city": "Mumbai",
  "state": "Maharashtra",
  "pincode": "400001",
  "emergency_contact_name": "Jane Doe",
  "emergency_contact_phone": "+91 9876543211",
  "emergency_contact_relation": "Wife",
  "height_cm": 172.0,
  "weight_kg": 78.5,
  "bsa": 1.92,
  "allergies": ["Sulfa drugs"],
  "comorbidities": ["Type 2 Diabetes", "Hypertension"],
  "current_medications": [
    {"name": "Metformin", "dose": "500mg", "frequency": "twice daily"}
  ],
  "cancer_type": "Colorectal Cancer",
  "cancer_stage": "Stage III",
  "diagnosis_date": "2025-10-15",
  "histopathology_details": "Moderately differentiated adenocarcinoma",
  "insurance_provider": "Star Health Insurance",
  "insurance_policy_number": "STH-2024-876543",
  "insurance_validity": "2027-03-31",
  "created_at": "2025-10-20T10:30:00Z",
  "updated_at": "2026-01-25T14:00:00Z"
}
```

### Create Patient Profile

```http
POST /patients/
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "date_of_birth": "1965-03-15",
  "gender": "male",
  "blood_group": "B+",
  "phone": "+91 9876543210",
  "address": "123 Main Street",
  "city": "Mumbai",
  "state": "Maharashtra",
  "pincode": "400001",
  "emergency_contact_name": "Jane Doe",
  "emergency_contact_phone": "+91 9876543211",
  "emergency_contact_relation": "Wife",
  "height_cm": 172.0,
  "weight_kg": 78.5,
  "allergies": ["Sulfa drugs"],
  "comorbidities": ["Type 2 Diabetes"],
  "cancer_type": "Colorectal Cancer",
  "cancer_stage": "Stage III",
  "diagnosis_date": "2025-10-15"
}
```

### List Patients (Staff Only)

```http
GET /patients/?skip=0&limit=20&search=john
Authorization: Bearer <token>
```

**Query Parameters:**
- `skip` (int): Pagination offset (default: 0)
- `limit` (int): Items per page (default: 20, max: 100)
- `search` (string): Search by name
- `cancer_type` (string): Filter by cancer type
- `status` (string): Filter by treatment status

**Response (200):**
```json
{
  "items": [
    { /* Patient object */ }
  ],
  "total": 45,
  "skip": 0,
  "limit": 20
}
```

---

## Clinical Endpoints

### Get Vitals (Self)

```http
GET /clinical/vitals/me?days=30
Authorization: Bearer <token>
```

**Query Parameters:**
- `days` (int): Number of days to look back (default: 30)

**Response (200):**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440010",
    "patient_id": "550e8400-e29b-41d4-a716-446655440001",
    "blood_pressure_systolic": 130,
    "blood_pressure_diastolic": 82,
    "heart_rate": 74,
    "temperature": 36.6,
    "temperature_f": 97.9,
    "oxygen_saturation": 98,
    "respiratory_rate": 16,
    "weight_kg": 78.2,
    "pain_score": 2,
    "blood_sugar": 125,
    "recorded_at": "2026-01-25T08:00:00Z",
    "recorded_by": null,
    "timing": "routine",
    "notes": "Morning vitals",
    "ai_alerts": []
  }
]
```

### Submit Vitals

```http
POST /clinical/vitals
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "blood_pressure_systolic": 128,
  "blood_pressure_diastolic": 80,
  "heart_rate": 72,
  "temperature": 36.5,
  "oxygen_saturation": 98,
  "respiratory_rate": 16,
  "weight_kg": 78.0,
  "pain_score": 1,
  "blood_sugar": 120,
  "timing": "routine",
  "notes": "Feeling well today"
}
```

**Response (201):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440011",
  "patient_id": "550e8400-e29b-41d4-a716-446655440001",
  "blood_pressure_systolic": 128,
  "blood_pressure_diastolic": 80,
  "heart_rate": 72,
  "temperature": 36.5,
  "oxygen_saturation": 98,
  "respiratory_rate": 16,
  "weight_kg": 78.0,
  "pain_score": 1,
  "blood_sugar": 120,
  "recorded_at": "2026-01-26T10:30:00Z",
  "timing": "routine",
  "notes": "Feeling well today",
  "ai_alerts": []
}
```

### Get Appointments (Self)

```http
GET /clinical/appointments/me?status=upcoming
Authorization: Bearer <token>
```

**Query Parameters:**
- `status`: `upcoming`, `past`, `all` (default: upcoming)
- `limit`: Max results (default: 10)

**Response (200):**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440020",
    "patient_id": "550e8400-e29b-41d4-a716-446655440001",
    "appointment_type": "daycare_chemo",
    "scheduled_date": "2026-01-27",
    "scheduled_time": "09:00:00",
    "duration_mins": 360,
    "chair_number": 5,
    "doctor_id": "550e8400-e29b-41d4-a716-446655440100",
    "nurse_id": "550e8400-e29b-41d4-a716-446655440200",
    "status": "confirmed",
    "notes": "Cycle 5 FOLFOX scheduled",
    "doctor_name": "Dr. Arun Mehta",
    "nurse_name": "Sister Mary Thomas"
  }
]
```

### Log Symptoms

```http
POST /clinical/symptoms
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "symptoms": [
    {
      "symptom_type": "nausea",
      "severity": 3,
      "notes": "Mild nausea after meals"
    },
    {
      "symptom_type": "fatigue",
      "severity": 5,
      "notes": "Feeling tired in the afternoon"
    }
  ],
  "overall_wellness": 7
}
```

**Response (201):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440030",
  "patient_id": "550e8400-e29b-41d4-a716-446655440001",
  "symptoms": [
    {"symptom_type": "nausea", "severity": 3, "notes": "Mild nausea after meals"},
    {"symptom_type": "fatigue", "severity": 5, "notes": "Feeling tired in the afternoon"}
  ],
  "overall_wellness": 7,
  "recorded_at": "2026-01-26T10:30:00Z",
  "ai_analysis": {
    "concern_level": "low",
    "recommendations": ["Stay hydrated", "Rest when needed"],
    "alert_doctor": false
  }
}
```

---

## Protocol Workflow Endpoints

### Create Protocol Request

```http
POST /protocol-workflow/requests
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "patient_id": "550e8400-e29b-41d4-a716-446655440001",
  "cancer_type": "Colorectal Cancer",
  "cancer_stage": "Stage III",
  "histology": "Adenocarcinoma",
  "notes": "Post-surgery adjuvant chemotherapy needed"
}
```

**Response (201):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440040",
  "patient_id": "550e8400-e29b-41d4-a716-446655440001",
  "status": "draft",
  "cancer_type": "Colorectal Cancer",
  "cancer_stage": "Stage III",
  "created_at": "2026-01-26T10:30:00Z",
  "clinical_data_id": null,
  "ai_generated_protocol": null
}
```

### Upload Document for Extraction

```http
POST /protocol-workflow/requests/{request_id}/documents
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Form Data:**
- `file`: Document file (PDF, PNG, JPG)
- `document_type`: `lab_report`, `imaging`, `pathology`, `other`

**Response (201):**
```json
{
  "document_id": "550e8400-e29b-41d4-a716-446655440050",
  "file_name": "lab_report_2026_01_25.pdf",
  "document_type": "lab_report",
  "extraction_status": "completed",
  "extracted_data": {
    "document_type": "lab_report",
    "document_date": "2026-01-25",
    "lab_values": [
      {
        "parameter": "WBC",
        "value": 5800,
        "unit": "/μL",
        "reference_range": "4000-11000",
        "status": "normal",
        "confidence": 0.95
      },
      {
        "parameter": "Hemoglobin",
        "value": 12.8,
        "unit": "g/dL",
        "reference_range": "12-16",
        "status": "normal",
        "confidence": 0.97
      }
    ],
    "confidence_score": 0.93
  }
}
```

### Update Clinical Data

```http
PUT /protocol-workflow/requests/{request_id}/clinical-data
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "gfr": 95,
  "creatinine": 0.9,
  "bilirubin": 0.8,
  "fb": {
    "wbc": 5800,
    "hb": 12.8,
    "platelets": 245000,
    "neutrophils": 3500
  },
  "lft": {
    "alt": 28,
    "ast": 25,
    "alp": 78
  },
  "is_smoker": false,
  "has_heart_disease": false,
  "lifetime_doxorubicin_mg": 0
}
```

**Response (200):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440060",
  "patient_id": "550e8400-e29b-41d4-a716-446655440001",
  "date_collected": "2026-01-26",
  "gfr": 95,
  "creatinine": 0.9,
  "bilirubin": 0.8,
  "fb": {"wbc": 5800, "hb": 12.8, "platelets": 245000, "neutrophils": 3500},
  "lft": {"alt": 28, "ast": 25, "alp": 78},
  "is_verified": false,
  "data_source": "nurse_entry",
  "updated_at": "2026-01-26T11:00:00Z"
}
```

### Generate AI Protocol

```http
POST /protocol-workflow/requests/{request_id}/generate
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "request_id": "550e8400-e29b-41d4-a716-446655440040",
  "status": "generated",
  "ai_generated_protocol": {
    "recommended_protocol": "FOLFOX",
    "protocol_full_name": "5-Fluorouracil, Leucovorin, Oxaliplatin",
    "drugs": [
      {
        "name": "Oxaliplatin",
        "dose_per_m2": 85,
        "unit": "mg",
        "calculated_dose": 163.2,
        "infusion_time_mins": 120,
        "day": 1
      },
      {
        "name": "Leucovorin",
        "dose_per_m2": 400,
        "unit": "mg",
        "calculated_dose": 768,
        "infusion_time_mins": 120,
        "day": 1
      }
    ],
    "cycle_days": 14,
    "total_cycles": 12,
    "dose_modifications": [],
    "supportive_care": [
      "Ondansetron 8mg IV pre-treatment",
      "Dexamethasone 8mg IV pre-treatment"
    ],
    "monitoring_requirements": [
      "CBC before each cycle",
      "LFT every 2 cycles",
      "Monitor for peripheral neuropathy"
    ],
    "rationale": "FOLFOX is the standard adjuvant regimen for Stage III colorectal cancer based on NCCN guidelines. Patient has adequate renal and hepatic function.",
    "guideline_references": ["NCCN Colon Cancer v2.2025"],
    "confidence_score": 0.92,
    "warnings": []
  }
}
```

### Nurse Approval

```http
POST /protocol-workflow/requests/{request_id}/nurse-approval
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "approved": true,
  "notes": "Clinical data verified. Labs within acceptable range for chemotherapy."
}
```

**Response (200):**
```json
{
  "request_id": "550e8400-e29b-41d4-a716-446655440040",
  "status": "nurse_approved",
  "nurse_reviewed_by": "550e8400-e29b-41d4-a716-446655440200",
  "nurse_reviewed_at": "2026-01-26T12:00:00Z",
  "nurse_approved": true,
  "nurse_notes": "Clinical data verified. Labs within acceptable range for chemotherapy.",
  "message": "Protocol forwarded to doctor for final approval"
}
```

### Doctor Approval

```http
POST /protocol-workflow/requests/{request_id}/doctor-approval
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "approved": true,
  "notes": "Protocol approved. Schedule for next Monday.",
  "modifications": null
}
```

**Response (200):**
```json
{
  "request_id": "550e8400-e29b-41d4-a716-446655440040",
  "status": "approved",
  "doctor_approved_by": "550e8400-e29b-41d4-a716-446655440100",
  "doctor_approved_at": "2026-01-26T14:00:00Z",
  "doctor_approved": true,
  "doctor_notes": "Protocol approved. Schedule for next Monday.",
  "treatment_plan_id": "550e8400-e29b-41d4-a716-446655440070",
  "message": "Treatment plan created. Patient notified."
}
```

### Get Pending Approvals

```http
GET /protocol-workflow/pending?role=nurse
Authorization: Bearer <token>
```

**Query Parameters:**
- `role`: `nurse` or `doctor`

**Response (200):**
```json
{
  "pending_count": 3,
  "requests": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440041",
      "patient_name": "Priya Sharma",
      "cancer_type": "Breast Cancer",
      "status": "pending_nurse_approval",
      "created_at": "2026-01-25T10:00:00Z",
      "waiting_hours": 28
    }
  ]
}
```

---

## Scheduling Endpoints

### Get Available Slots

```http
GET /scheduling/available-slots?date=2026-01-27&duration=180
Authorization: Bearer <token>
```

**Query Parameters:**
- `date`: Target date (YYYY-MM-DD)
- `duration`: Required duration in minutes
- `preferred_time`: Preferred start time (HH:MM)

**Response (200):**
```json
{
  "date": "2026-01-27",
  "slots": [
    {
      "start_time": "09:00",
      "end_time": "12:00",
      "chair_number": 3,
      "is_available": true
    },
    {
      "start_time": "09:00",
      "end_time": "12:00",
      "chair_number": 5,
      "is_available": true
    },
    {
      "start_time": "13:00",
      "end_time": "16:00",
      "chair_number": 1,
      "is_available": true
    }
  ],
  "total_available": 15
}
```

### Get Chair Availability

```http
GET /scheduling/chair-availability?date=2026-01-27&time=09:00
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "date": "2026-01-27",
  "time": "09:00",
  "chairs": [
    {
      "chair_number": 1,
      "is_available": false,
      "current_patient_id": "550e8400-e29b-41d4-a716-446655440001",
      "current_patient_name": "Rajesh Kumar",
      "current_treatment": "FOLFOX Cycle 5",
      "available_from": "15:00"
    },
    {
      "chair_number": 2,
      "is_available": true,
      "current_patient_id": null,
      "current_patient_name": null,
      "current_treatment": null,
      "available_from": null
    }
  ],
  "total_chairs": 20,
  "available_count": 12,
  "occupied_count": 8
}
```

### Schedule Appointment

```http
POST /scheduling/appointments
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "patient_id": "550e8400-e29b-41d4-a716-446655440001",
  "appointment_type": "daycare_chemo",
  "date": "2026-01-27",
  "time": "09:00",
  "duration_mins": 180,
  "chair_number": 5,
  "doctor_id": "550e8400-e29b-41d4-a716-446655440100",
  "nurse_id": "550e8400-e29b-41d4-a716-446655440200",
  "cycle_id": "550e8400-e29b-41d4-a716-446655440080",
  "notes": "Cycle 5 FOLFOX"
}
```

**Response (201):**
```json
{
  "success": true,
  "appointment": {
    "id": "550e8400-e29b-41d4-a716-446655440090",
    "patient_id": "550e8400-e29b-41d4-a716-446655440001",
    "appointment_type": "daycare_chemo",
    "scheduled_date": "2026-01-27",
    "scheduled_time": "09:00:00",
    "duration_mins": 180,
    "chair_number": 5,
    "status": "scheduled"
  },
  "conflicts": [],
  "message": "Appointment scheduled successfully"
}
```

### Schedule Treatment Cycles

```http
POST /scheduling/treatment-plan/{plan_id}/schedule-cycles
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "start_date": "2026-01-27",
  "preferred_time": "09:00",
  "preferred_chair": 5
}
```

**Response (200):**
```json
{
  "success": true,
  "treatment_plan_id": "550e8400-e29b-41d4-a716-446655440070",
  "scheduled_cycles": [
    {
      "cycle_number": 1,
      "scheduled_date": "2026-01-27",
      "scheduled_time": "09:00",
      "chair_number": 5,
      "appointment_id": "550e8400-e29b-41d4-a716-446655440091"
    },
    {
      "cycle_number": 2,
      "scheduled_date": "2026-02-10",
      "scheduled_time": "09:00",
      "chair_number": 5,
      "appointment_id": "550e8400-e29b-41d4-a716-446655440092"
    }
  ],
  "conflicts": [],
  "message": "All 12 cycles scheduled successfully"
}
```

### Reschedule Appointment

```http
PUT /scheduling/appointments/{appointment_id}/reschedule
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "new_date": "2026-01-28",
  "new_time": "10:00",
  "reason": "Patient requested"
}
```

**Response (200):**
```json
{
  "success": true,
  "appointment": {
    "id": "550e8400-e29b-41d4-a716-446655440090",
    "scheduled_date": "2026-01-28",
    "scheduled_time": "10:00:00",
    "status": "scheduled"
  },
  "message": "Appointment rescheduled successfully"
}
```

### Cancel Appointment

```http
DELETE /scheduling/appointments/{appointment_id}
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "reason": "Patient unwell"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Appointment cancelled"
}
```

---

## Day Care Endpoints

### Get Active Patients

```http
GET /daycare/active-patients
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "active_count": 8,
  "patients": [
    {
      "patient_id": "550e8400-e29b-41d4-a716-446655440001",
      "patient_name": "Rajesh Kumar",
      "chair_number": 5,
      "treatment": "FOLFOX Cycle 5",
      "cycle_id": "550e8400-e29b-41d4-a716-446655440080",
      "started_at": "2026-01-27T09:15:00Z",
      "current_drug": "Oxaliplatin",
      "drug_progress": 45,
      "estimated_completion": "2026-01-27T15:00:00Z",
      "nurse_assigned": "Sister Mary Thomas",
      "alerts": []
    }
  ]
}
```

### Start Treatment Cycle

```http
POST /daycare/cycles/{cycle_id}/start
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "chair_number": 5,
  "nurse_id": "550e8400-e29b-41d4-a716-446655440200",
  "pre_chemo_vitals": {
    "bp_systolic": 130,
    "bp_diastolic": 82,
    "pulse": 74,
    "temperature": 98.4,
    "spo2": 98,
    "weight_kg": 78.2
  }
}
```

**Response (200):**
```json
{
  "cycle_id": "550e8400-e29b-41d4-a716-446655440080",
  "status": "in_progress",
  "started_at": "2026-01-27T09:15:00Z",
  "chair_number": 5,
  "drugs_to_administer": [
    {
      "drug_name": "Ondansetron",
      "dose": "8mg",
      "route": "IV",
      "type": "pre_medication"
    },
    {
      "drug_name": "Oxaliplatin",
      "dose": "163.2mg",
      "route": "IV infusion",
      "duration_mins": 120
    }
  ]
}
```

### Complete Treatment Cycle

```http
POST /daycare/cycles/{cycle_id}/complete
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "discharge_notes": "Tolerated well. Mild nausea controlled with ondansetron.",
  "follow_up_instructions": "Return in 14 days. Monitor for cold sensitivity.",
  "immediate_reactions": [],
  "post_chemo_vitals": {
    "bp_systolic": 128,
    "bp_diastolic": 80,
    "pulse": 72,
    "temperature": 98.6,
    "spo2": 98
  }
}
```

**Response (200):**
```json
{
  "cycle_id": "550e8400-e29b-41d4-a716-446655440080",
  "status": "completed",
  "completed_at": "2026-01-27T15:30:00Z",
  "duration_hours": 6.25,
  "message": "Cycle completed successfully. Patient cleared for discharge."
}
```

---

## AI Endpoints

### Analyze Symptoms

```http
POST /ai/analyze-symptoms
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "patient_id": "550e8400-e29b-41d4-a716-446655440001",
  "symptoms": [
    {"symptom_type": "nausea", "severity": 5},
    {"symptom_type": "fatigue", "severity": 6},
    {"symptom_type": "numbness", "severity": 3, "location": "fingertips"}
  ],
  "current_cycle": 5,
  "protocol": "FOLFOX"
}
```

**Response (200):**
```json
{
  "analysis": {
    "concern_level": "moderate",
    "likely_causes": [
      "Chemotherapy-induced nausea (expected with FOLFOX)",
      "Treatment-related fatigue",
      "Early peripheral neuropathy (oxaliplatin-related)"
    ],
    "recommendations": [
      "Continue ondansetron for nausea",
      "Consider adding metoclopramide if nausea persists",
      "Monitor neuropathy - may need dose reduction if worsens"
    ],
    "alert_doctor": true,
    "urgency": "next_business_day",
    "follow_up_actions": [
      "Schedule call with oncologist",
      "Add neuropathy assessment to next visit"
    ]
  },
  "confidence_score": 0.88
}
```

### Check Drug Interactions

```http
POST /ai/check-interactions
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "protocol_drugs": ["Oxaliplatin", "5-Fluorouracil", "Leucovorin"],
  "patient_medications": ["Metformin", "Amlodipine", "Aspirin"]
}
```

**Response (200):**
```json
{
  "interactions": [
    {
      "drug1": "5-Fluorouracil",
      "drug2": "Metformin",
      "severity": "minor",
      "description": "5-FU may slightly increase hypoglycemia risk",
      "recommendation": "Monitor blood glucose more frequently during treatment"
    }
  ],
  "contraindications": [],
  "warnings": [
    "Avoid cold drinks/foods during oxaliplatin infusion and for 5 days after"
  ],
  "safe_to_proceed": true
}
```

### Calculate Adjusted Dose

```http
POST /ai/calculate-dose
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "drug_name": "Oxaliplatin",
  "base_dose_per_m2": 85,
  "bsa": 1.92,
  "gfr": 95,
  "bilirubin": 0.8,
  "previous_toxicity": null,
  "cycle_number": 5
}
```

**Response (200):**
```json
{
  "drug_name": "Oxaliplatin",
  "base_dose": 163.2,
  "adjusted_dose": 163.2,
  "dose_reduction_percent": 0,
  "adjustments_applied": [],
  "unit": "mg",
  "calculation_details": {
    "bsa": 1.92,
    "dose_per_m2": 85,
    "renal_adjustment": "none (GFR > 60)",
    "hepatic_adjustment": "none (bilirubin normal)"
  },
  "warnings": [],
  "max_lifetime_dose_remaining": null
}
```

---

## Error Responses

### Validation Error (422)

```json
{
  "detail": [
    {
      "loc": ["body", "email"],
      "msg": "value is not a valid email address",
      "type": "value_error.email"
    }
  ]
}
```

### Authentication Error (401)

```json
{
  "detail": "Could not validate credentials"
}
```

### Authorization Error (403)

```json
{
  "detail": "Not authorized to access this resource"
}
```

### Not Found Error (404)

```json
{
  "detail": "Patient not found"
}
```

---

## Rate Limits

| Endpoint Category | Rate Limit |
|-------------------|------------|
| Authentication | 10 requests/minute |
| Read operations | 100 requests/minute |
| Write operations | 30 requests/minute |
| AI operations | 10 requests/minute |
| File uploads | 5 requests/minute |

---

## Webhooks (Future)

*Webhook support planned for:*
- Treatment cycle completion
- Appointment reminders
- Lab result alerts
- Protocol approval status changes

---

*API Reference last updated: January 26, 2026*
