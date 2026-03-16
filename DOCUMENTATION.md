# ChemoCare AI - Complete Technical Documentation

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Backend Documentation](#backend-documentation)
   - [API Reference](#api-reference)
   - [Data Models](#data-models)
   - [Services](#services)
   - [Authentication](#authentication)
4. [Mobile App Documentation](#mobile-app-documentation)
   - [Navigation Structure](#navigation-structure)
   - [State Management](#state-management)
   - [Services Layer](#services-layer)
5. [Workflows](#workflows)
   - [Protocol Generation Workflow](#protocol-generation-workflow)
   - [Approval Workflow](#approval-workflow)
   - [Scheduling Workflow](#scheduling-workflow)
6. [AI Integration](#ai-integration)
7. [Testing](#testing)
8. [Database Seeding](#database-seeding)
9. [Deployment](#deployment)
10. [API Endpoints Reference](#api-endpoints-reference)

---

## System Overview

ChemoCare AI is a comprehensive chemotherapy day care management system that streamlines the entire treatment workflow from protocol generation to treatment administration. The system uses Google Gemini AI for intelligent document extraction and protocol recommendations.

### Key Features

| Feature | Description |
|---------|-------------|
| **Intelligent Document Extraction** | AI-powered extraction of clinical data from lab reports, imaging, and pathology documents |
| **Protocol Generation** | AI-assisted chemotherapy protocol generation based on clinical guidelines (NCCN, ESMO, ASCO) |
| **Multi-Stage Approval Workflow** | Nurse → Doctor approval chain with notifications |
| **Smart Scheduling** | Intelligent chair allocation and treatment scheduling |
| **Push Notifications** | Real-time alerts via Expo Push Notifications |
| **Role-Based Access** | Patient, Nurse, OPD Doctor, Day Care Doctor portals |

### User Roles

| Role | Capabilities |
|------|--------------|
| **Patient** | View schedules, log vitals/symptoms, upload documents, receive notifications |
| **Nurse** | Collect clinical data, review protocols, approve for doctor review, record vitals |
| **Doctor (OPD)** | Create treatment plans, initial consultations, protocol approval |
| **Doctor (Day Care)** | Final protocol approval, manage active treatments, chair allocation |

---

## Architecture

### Technology Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                        Mobile App                                │
│   React Native + Expo SDK 54 + TypeScript + Zustand             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS/REST
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Backend API                                  │
│   FastAPI + SQLAlchemy 2.0 (async) + Pydantic v2                │
└─────────────────────────────────────────────────────────────────┘
          │                   │                    │
          ▼                   ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   PostgreSQL    │  │  Google Gemini  │  │   Expo Push     │
│   Database      │  │   AI API        │  │   Service       │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

### Directory Structure

```
chemo-daycare/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── deps.py                 # Dependency injection
│   │   │   └── v1/
│   │   │       ├── auth.py             # Authentication endpoints
│   │   │       ├── patients.py         # Patient CRUD
│   │   │       ├── protocols.py        # Protocol templates
│   │   │       ├── protocol_workflow.py # Full workflow with approvals
│   │   │       ├── clinical.py         # Vitals, appointments, etc.
│   │   │       ├── scheduling.py       # Scheduling endpoints
│   │   │       ├── daycare.py          # Day care operations
│   │   │       └── ai.py               # AI endpoints
│   │   ├── core/
│   │   │   ├── config.py               # Settings from env vars
│   │   │   ├── database.py             # Async DB connection
│   │   │   └── security.py             # JWT & password hashing
│   │   ├── models/                     # SQLAlchemy models
│   │   │   ├── user.py                 # User model
│   │   │   ├── patient.py              # Patient profile
│   │   │   ├── staff.py                # Doctor, Nurse
│   │   │   ├── treatment.py            # Plans, Cycles, Drugs
│   │   │   ├── clinical.py             # Vitals, Appointments, etc.
│   │   │   └── protocol_request.py     # Protocol workflow models
│   │   ├── schemas/                    # Pydantic schemas
│   │   ├── services/                   # Business logic
│   │   │   ├── gemini_ai.py            # AI protocol generation
│   │   │   ├── document_extraction.py  # Document AI extraction
│   │   │   ├── push_notifications.py   # Expo push service
│   │   │   └── scheduling.py           # Scheduling logic
│   │   └── main.py                     # FastAPI app entry
│   ├── scripts/
│   │   └── seed_test_data.py           # Database seeding
│   ├── tests/                          # pytest tests
│   └── requirements.txt
│
├── mobile/
│   ├── app/                            # Expo Router pages
│   │   ├── _layout.tsx                 # Root layout
│   │   ├── index.tsx                   # Entry point
│   │   ├── (auth)/                     # Auth group
│   │   │   ├── login.tsx
│   │   │   ├── register.tsx
│   │   │   └── forgot-password.tsx
│   │   ├── (patient)/                  # Patient portal tabs
│   │   │   ├── home.tsx
│   │   │   ├── schedule.tsx
│   │   │   ├── vitals.tsx
│   │   │   ├── symptoms.tsx
│   │   │   ├── chat.tsx
│   │   │   └── profile.tsx
│   │   ├── (nurse)/                    # Nurse portal tabs
│   │   ├── (doctor-opd)/               # OPD doctor portal
│   │   └── (doctor-daycare)/           # Day care doctor portal
│   ├── src/
│   │   ├── components/                 # Reusable UI components
│   │   ├── constants/                  # Theme, config
│   │   ├── services/                   # API services
│   │   ├── store/                      # Zustand stores
│   │   └── types/                      # TypeScript interfaces
│   └── package.json
│
└── README.md
```

---

## Backend Documentation

### API Reference

#### Base URL
```
http://localhost:8000/api/v1
```

#### Authentication

All endpoints (except `/auth/login` and `/auth/register`) require JWT authentication:

```http
Authorization: Bearer <access_token>
```

#### Response Format

All responses follow this structure:

```json
{
  "id": "uuid",
  "created_at": "2026-01-25T10:30:00Z",
  "updated_at": "2026-01-25T10:30:00Z",
  // ... other fields
}
```

Errors return:

```json
{
  "detail": "Error message"
}
```

---

### Data Models

#### User Model

```python
class User:
    id: UUID                    # Primary key
    email: str                  # Unique, indexed
    password_hash: str          # Bcrypt hashed
    full_name: str
    role: UserRole              # patient, doctor_opd, doctor_daycare, nurse
    is_active: bool             # Account active status
    is_verified: bool           # Email verified
    avatar: str | None          # Profile picture URL
    push_token: str | None      # Expo push notification token
    created_at: datetime
    last_login: datetime | None
```

#### Patient Model

```python
class Patient:
    id: UUID
    user_id: UUID               # FK to User
    first_name: str
    last_name: str
    date_of_birth: date
    gender: Gender              # male, female, other
    blood_group: BloodGroup     # A+, A-, B+, B-, AB+, AB-, O+, O-
    
    # Contact
    phone: str
    address: str
    city: str
    state: str
    pincode: str
    
    # Emergency Contact
    emergency_contact_name: str
    emergency_contact_phone: str
    emergency_contact_relation: str
    
    # Physical Measurements
    height_cm: Decimal
    weight_kg: Decimal
    bsa: Decimal                # Body Surface Area (calculated)
    
    # Medical Info (JSONB)
    allergies: List[str]
    comorbidities: List[str]
    current_medications: List[dict]
    
    # Cancer Details
    cancer_type: str
    cancer_stage: str
    diagnosis_date: date
    histopathology_details: str
    
    # Insurance
    insurance_provider: str | None
    insurance_policy_number: str | None
    insurance_validity: date | None
```

#### Treatment Plan Model

```python
class TreatmentPlan:
    id: UUID
    patient_id: UUID            # FK to Patient
    protocol_template_id: UUID  # FK to ProtocolTemplate
    protocol_name: str
    custom_protocol: dict | None  # JSONB for customizations
    
    start_date: date
    planned_cycles: int
    completed_cycles: int
    status: PlanStatus          # draft, pending_approval, approved, active, completed, cancelled
    
    # AI Fields
    ai_recommendations: str
    ai_risk_assessment: dict    # JSONB
    ai_confidence_score: Decimal
    
    # Approvals
    created_by_doctor_id: UUID
    opd_approved_by: str
    opd_approved_at: datetime
    opd_notes: str
    daycare_approved_by: str
    daycare_approved_at: datetime
    daycare_notes: str
```

#### Treatment Cycle Model

```python
class TreatmentCycle:
    id: UUID
    treatment_plan_id: UUID     # FK to TreatmentPlan
    cycle_number: int
    scheduled_date: date
    actual_date: date | None
    status: CycleStatus         # scheduled, approved, in_progress, completed, skipped
    
    # Pre-Chemo Data (JSONB)
    pre_chemo_labs: dict        # Lab values before treatment
    pre_chemo_vitals: dict      # Vitals before treatment
    
    # Patient Metrics
    patient_weight_kg: Decimal
    calculated_bsa: Decimal
    
    # Approval
    daycare_doctor_id: UUID
    approved_at: datetime
    approval_notes: str
    
    # Administration
    started_at: datetime
    completed_at: datetime
    administered_by: UUID       # Nurse ID
    
    # Post-Treatment (JSONB)
    immediate_reactions: list
    dose_modifications: dict
    discharge_notes: str
    follow_up_instructions: str
```

#### Appointment Model

```python
class Appointment:
    id: UUID
    patient_id: UUID
    cycle_id: UUID | None       # For chemo appointments
    
    appointment_type: AppointmentType  # opd_consultation, daycare_chemo, follow_up, lab_work
    scheduled_date: date
    scheduled_time: time
    duration_mins: int
    chair_number: int | None    # For day care
    
    doctor_id: UUID | None
    nurse_id: UUID | None
    
    status: AppointmentStatus   # scheduled, confirmed, in_progress, completed, cancelled, no_show
    
    checked_in_at: datetime
    checked_out_at: datetime
    cancellation_reason: str
    notes: str
```

#### Vital Model

```python
class Vital:
    id: UUID
    patient_id: UUID
    cycle_id: UUID | None       # For chemo-related vitals
    
    # Measurements
    blood_pressure_systolic: int
    blood_pressure_diastolic: int
    heart_rate: int
    temperature: Decimal        # Celsius
    temperature_f: Decimal      # Fahrenheit
    oxygen_saturation: int
    respiratory_rate: int
    weight_kg: Decimal
    
    # Optional
    pain_score: int             # 0-10
    pain_location: str
    blood_sugar: Decimal
    
    recorded_at: datetime
    recorded_by: UUID           # Staff ID
    timing: str                 # pre_chemo, post_chemo, routine
    notes: str
    
    ai_alerts: list             # JSONB - AI-detected concerns
```

#### Protocol Request Model (Workflow)

```python
class ProtocolRequest:
    id: UUID
    patient_id: UUID
    clinical_data_id: UUID      # FK to PatientClinicalData
    
    status: ProtocolRequestStatus
    # draft → pending_data → pending_generation → generated → 
    # pending_nurse_approval → nurse_approved → 
    # pending_doctor_approval → approved/rejected
    
    # AI Generated Protocol
    ai_generated_protocol: dict # JSONB
    ai_recommendations: list
    ai_warnings: list
    ai_confidence_score: Decimal
    
    # Nurse Approval
    nurse_reviewed_by: UUID
    nurse_reviewed_at: datetime
    nurse_approved: bool
    nurse_notes: str
    
    # Doctor Approval
    doctor_approved_by: UUID
    doctor_approved_at: datetime
    doctor_approved: bool
    doctor_notes: str
    
    # Final Result
    final_treatment_plan_id: UUID  # Created after approval
```

---

### Services

#### Document Extraction Service

**File:** `backend/app/services/document_extraction.py`

Extracts structured clinical data from uploaded documents using Gemini Vision API.

```python
# Extract from image (lab report, imaging, etc.)
result = await extract_from_image(
    image_bytes=bytes,
    image_type="image/png",  # or image/jpeg, application/pdf
    document_hint="lab_report"  # Optional hint for better extraction
)

# Extract from text (OCR'd document)
result = await extract_from_text(
    text_content="Patient labs...",
    document_type="lab_report"
)

# Full extraction with mapping to clinical data
result = await extract_and_map_document(
    document_id=uuid,
    db=session
)
```

**Extraction Result Structure:**

```python
class DocumentExtractionResult:
    document_type: str          # lab_report, imaging_report, pathology, etc.
    document_date: str | None
    
    lab_values: List[ExtractedLabValue]
    vital_signs: List[ExtractedVitalSign]
    diagnoses: List[ExtractedDiagnosis]
    medications: List[ExtractedMedication]
    
    # Cancer-specific
    cancer_type: str | None
    cancer_stage: str | None
    histology: str | None
    tumor_markers: dict | None
    
    # Quality metrics
    confidence_score: float     # 0.0 to 1.0
    extraction_warnings: List[str]
```

#### Push Notifications Service

**File:** `backend/app/services/push_notifications.py`

Handles Expo push notifications for real-time alerts.

```python
# Send single notification
result = await send_push_notification(
    push_token="ExponentPushToken[xxx]",
    title="Appointment Reminder",
    body="Your chemotherapy session is tomorrow at 9 AM",
    data={"appointment_id": "uuid"},
    sound="default",
    priority="high"
)

# Send to multiple users
result = await send_bulk_notifications(
    push_tokens=["ExponentPushToken[xxx]", ...],
    title="Alert",
    body="Message"
)

# Pre-built notification types
await send_appointment_reminder(db, appointment_id, hours_before=24)
await send_treatment_due_notification(db, patient_id, cycle_number)
await send_approval_required_notification(db, approver_id, request_id)
await send_protocol_approved_notification(db, patient_id)
```

#### Scheduling Service

**File:** `backend/app/services/scheduling.py`

Intelligent appointment scheduling with chair allocation.

```python
# Check chair availability
availability = await get_chair_availability(
    db=session,
    target_date=date.today(),
    target_time=time(9, 0)
)

# Find next available slot
slot = await find_next_available_slot(
    db=session,
    patient_id=uuid,
    duration_mins=180,
    preferred_date=date.today(),
    preferred_time=time(9, 0)
)

# Schedule appointment
result = await schedule_appointment(
    db=session,
    patient_id=uuid,
    appointment_type=AppointmentType.DAYCARE_CHEMO,
    date=date.today(),
    time=time(9, 0),
    duration_mins=180,
    doctor_id=uuid,
    nurse_id=uuid
)

# Schedule all cycles for a treatment plan
result = await schedule_treatment_cycles(
    db=session,
    treatment_plan_id=uuid,
    start_date=date.today(),
    preferred_time=time(9, 0),
    cycle_interval_days=21
)
```

**Configuration:**

```python
DAYCARE_OPEN_TIME = time(8, 0)   # 8 AM
DAYCARE_CLOSE_TIME = time(18, 0) # 6 PM
TOTAL_CHAIRS = 20

DEFAULT_TREATMENT_DURATIONS = {
    "chemotherapy": 180,         # 3 hours
    "immunotherapy": 120,        # 2 hours
    "blood_transfusion": 240,    # 4 hours
    "consultation": 30,
    "vitals_check": 15,
    "lab_draw": 15,
}
```

#### Gemini AI Service

**File:** `backend/app/services/gemini_ai.py`

AI-powered protocol generation using Google Gemini.

```python
# Generate protocol from clinical data
result = await generate_protocol(
    clinical_data=PatientClinicalData,
    protocol_templates=List[ProtocolTemplate]
)

# Analyze symptoms
result = await analyze_symptoms(
    symptoms=List[SymptomEntry],
    patient_history=dict
)

# Drug interaction check
result = await check_drug_interactions(
    drugs=List[str],
    patient_medications=List[str]
)

# Dose calculation with adjustments
result = await calculate_adjusted_dose(
    drug_name=str,
    base_dose_per_m2=float,
    bsa=float,
    gfr=float,
    bilirubin=float
)
```

---

### Authentication

#### JWT Token Structure

**Access Token (30 min expiry):**
```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "role": "patient",
  "exp": 1706190000,
  "type": "access"
}
```

**Refresh Token (7 day expiry):**
```json
{
  "sub": "user-uuid",
  "exp": 1706790000,
  "type": "refresh"
}
```

#### Password Hashing

Uses bcrypt with automatic salt:

```python
from app.core.security import get_password_hash, verify_password

hashed = get_password_hash("password123")
is_valid = verify_password("password123", hashed)
```

---

## Mobile App Documentation

### Navigation Structure

Uses Expo Router with file-based routing:

```
app/
├── _layout.tsx           # Root layout with auth check
├── index.tsx             # Entry point (redirect)
├── (auth)/               # Unauthenticated routes
│   ├── _layout.tsx       # Stack navigator
│   ├── login.tsx
│   ├── register.tsx
│   └── forgot-password.tsx
├── (patient)/            # Patient portal (tab navigator)
│   ├── _layout.tsx       # Tab layout
│   ├── home.tsx
│   ├── schedule.tsx
│   ├── vitals.tsx
│   ├── symptoms.tsx
│   ├── chat.tsx
│   └── profile.tsx
├── (nurse)/              # Nurse portal
├── (doctor-opd)/         # OPD doctor portal
└── (doctor-daycare)/     # Day care doctor portal
```

### State Management

Uses Zustand for state management:

#### Auth Store

```typescript
// src/store/authStore.ts
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
}
```

#### Patient Store

```typescript
// src/store/patientStore.ts
interface PatientState {
  patient: Patient | null;
  appointments: Appointment[];
  vitals: Vital[];
  treatmentPlan: TreatmentPlan | null;
  
  fetchPatientProfile: () => Promise<void>;
  fetchAppointments: () => Promise<void>;
  fetchVitals: (days?: number) => Promise<void>;
  submitVitals: (data: VitalsInput) => Promise<void>;
}
```

#### Day Care Store

```typescript
// src/store/dayCareStore.ts
interface DayCareState {
  activePatients: ActivePatient[];
  chairStatus: ChairStatus[];
  todayAppointments: Appointment[];
  
  fetchActivePatients: () => Promise<void>;
  fetchChairStatus: () => Promise<void>;
  startTreatment: (cycleId: string, chairNumber: number) => Promise<void>;
  completeTreatment: (cycleId: string) => Promise<void>;
}
```

### Services Layer

API services encapsulate all backend communication:

```typescript
// src/services/index.ts
export { apiClient, dayCareClient } from './api';
export * as authService from './authService';
export * as patientService from './patientService';
export * as doctorService from './doctorService';
export * as nurseService from './nurseService';
export * as appointmentsService from './appointmentsService';
export * as vitalsService from './vitalsService';
export * as symptomsService from './symptomsService';
export * as treatmentService from './treatmentService';
export * as aiService from './aiService';
export * as protocolService from './protocolService';
export * as schedulingService from './schedulingService';
export * as pushNotificationService from './pushNotificationService';
```

#### Example Service

```typescript
// src/services/vitalsService.ts
import { api } from './api';
import { Vital, VitalsInput } from '../types';

export const getMyVitals = async (days: number = 30): Promise<Vital[]> => {
  const response = await api.client.get(`/clinical/vitals/me?days=${days}`);
  return response.data;
};

export const submitVitals = async (data: VitalsInput): Promise<Vital> => {
  const response = await api.client.post('/clinical/vitals', data);
  return response.data;
};

export const getPatientVitals = async (
  patientId: string, 
  days: number = 30
): Promise<Vital[]> => {
  const response = await api.client.get(`/clinical/vitals/${patientId}?days=${days}`);
  return response.data;
};
```

---

## Workflows

### Protocol Generation Workflow

```
┌──────────────────────────────────────────────────────────────────────┐
│                    PROTOCOL GENERATION WORKFLOW                       │
└──────────────────────────────────────────────────────────────────────┘

┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   PATIENT   │────▶│    NURSE    │────▶│     AI      │────▶│   NURSE     │
│             │     │  Collects   │     │  Generates  │     │   Reviews   │
│  Uploads    │     │  Clinical   │     │  Protocol   │     │  & Approves │
│  Documents  │     │    Data     │     │             │     │             │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                                                                   │
                                                                   ▼
                          ┌─────────────┐     ┌─────────────────────────────┐
                          │   DOCTOR    │────▶│  TREATMENT PLAN CREATED     │
                          │  Approves   │     │  + Scheduling + Notify      │
                          └─────────────┘     └─────────────────────────────┘
```

**Statuses:**

1. `draft` - Initial creation
2. `pending_data` - Waiting for clinical data collection
3. `pending_generation` - Data complete, waiting for AI
4. `generated` - AI protocol generated
5. `pending_nurse_approval` - Waiting for nurse review
6. `nurse_approved` - Nurse approved, forwarded to doctor
7. `pending_doctor_approval` - Waiting for doctor final approval
8. `approved` - Fully approved → Treatment Plan created
9. `rejected` - Rejected at any stage

### Approval Workflow

```typescript
// 1. Create protocol request
POST /api/v1/protocol-workflow/requests
{
  "patient_id": "uuid",
  "cancer_type": "Breast Cancer",
  "cancer_stage": "Stage II"
}

// 2. Upload documents (AI extracts data)
POST /api/v1/protocol-workflow/requests/{id}/documents
Content-Type: multipart/form-data
file: <lab_report.pdf>

// 3. Nurse adds/verifies clinical data
PUT /api/v1/protocol-workflow/requests/{id}/clinical-data
{
  "gfr": 95,
  "creatinine": 0.9,
  "fb": {"wbc": 6200, "hb": 13.5, "platelets": 280000}
}

// 4. Request AI protocol generation
POST /api/v1/protocol-workflow/requests/{id}/generate

// 5. Nurse reviews and approves
POST /api/v1/protocol-workflow/requests/{id}/nurse-approval
{
  "approved": true,
  "notes": "Clinical data verified. Labs within acceptable range."
}
// → Notifies doctors

// 6. Doctor reviews and approves
POST /api/v1/protocol-workflow/requests/{id}/doctor-approval
{
  "approved": true,
  "notes": "Protocol approved. Start treatment next week."
}
// → Creates TreatmentPlan
// → Schedules cycles
// → Notifies patient
```

### Scheduling Workflow

```typescript
// 1. Find available slots
GET /api/v1/scheduling/available-slots?date=2026-01-27&duration=180

// Response:
{
  "slots": [
    {"start_time": "09:00", "end_time": "12:00", "chair_number": 3},
    {"start_time": "09:00", "end_time": "12:00", "chair_number": 5},
    {"start_time": "13:00", "end_time": "16:00", "chair_number": 1}
  ]
}

// 2. Schedule appointment
POST /api/v1/scheduling/appointments
{
  "patient_id": "uuid",
  "appointment_type": "daycare_chemo",
  "date": "2026-01-27",
  "time": "09:00",
  "duration_mins": 180,
  "chair_number": 5
}

// 3. Schedule all treatment cycles
POST /api/v1/scheduling/treatment-plan/{plan_id}/schedule-cycles
{
  "start_date": "2026-01-27",
  "preferred_time": "09:00",
  "cycle_interval_days": 21
}

// Response:
{
  "success": true,
  "scheduled_cycles": [
    {"cycle_number": 1, "date": "2026-01-27", "time": "09:00", "chair": 5},
    {"cycle_number": 2, "date": "2026-02-17", "time": "09:00", "chair": 5},
    // ...
  ]
}
```

---

## AI Integration

### Google Gemini Configuration

```python
# backend/app/services/gemini_ai.py
from google import genai
from google.genai import types

client = genai.Client(api_key=settings.GEMINI_API_KEY)

# Protocol generation with structured output
response = client.models.generate_content(
    model="gemini-2.0-flash",
    contents=prompt,
    config=types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=ProtocolGenerationResult,
        temperature=0.2,  # Low for medical accuracy
    )
)
```

### Document Extraction Prompt

```python
EXTRACTION_PROMPT = """
You are a medical data extraction AI. Extract structured clinical data from this document.

Identify and extract:
1. Lab Values: Name, value, unit, reference range, status (normal/high/low)
2. Vital Signs: BP, HR, Temp, SpO2, RR, Weight
3. Diagnoses: Primary diagnosis, ICD codes, staging
4. Medications: Drug name, dose, frequency, route

For cancer patients, also extract:
- Cancer type and subtype
- Histology/pathology findings
- Stage (TNM or clinical)
- Tumor markers

Return confidence scores (0.0-1.0) for each extraction.
"""
```

### Protocol Generation Schema

```python
class ProtocolGenerationResult(BaseModel):
    """AI-generated protocol recommendation."""
    
    recommended_protocol: str           # Protocol name
    protocol_full_name: str
    
    drugs: List[DrugRecommendation]
    cycle_days: int
    total_cycles: int
    
    dose_modifications: List[DoseModification]
    contraindication_warnings: List[str]
    
    supportive_care: List[str]
    monitoring_requirements: List[str]
    
    rationale: str                      # AI explanation
    guideline_references: List[str]     # NCCN, ESMO, etc.
    
    confidence_score: float
    alternative_protocols: List[str]
```

---

## Testing

### Backend Tests

```bash
cd backend
source ../venv/bin/activate

# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=html

# Run specific test file
pytest tests/api/test_auth.py

# Run with verbose output
pytest -v

# Run only unit tests
pytest tests/unit/

# Run only integration tests
pytest tests/integration/
```

**Test Structure:**

```
tests/
├── conftest.py              # Fixtures
├── factories.py             # Polyfactory model factories
├── api/
│   ├── test_auth.py
│   ├── test_patients.py
│   └── test_clinical.py
├── unit/
│   ├── test_ai_service.py
│   └── test_security.py
└── integration/
    └── test_workflow.py
```

### Mobile Tests

```bash
cd mobile

# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch

# Run specific test file
npm test -- vitalsService
```

**Test Structure:**

```
src/
├── __tests__/
│   ├── services/
│   │   ├── authService.test.ts
│   │   ├── patientService.test.ts
│   │   └── vitalsService.test.ts
│   ├── components/
│   │   └── Button.test.tsx
│   └── store/
│       └── authStore.test.ts
```

---

## Database Seeding

### Running the Seed Script

```bash
cd backend
source ../venv/bin/activate

# Full seed (clean + populate)
python scripts/seed_test_data.py

# Only clean database
python scripts/seed_test_data.py --clean-only

# Add data without cleaning (dangerous - may cause duplicates)
python scripts/seed_test_data.py --no-clean
```

### Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Patient 1 | patient@test.com | password123 |
| Patient 2 | patient2@test.com | password123 |
| Patient 3 | patient3@test.com | password123 |
| Daycare Doctor | doctor@test.com | password123 |
| OPD Doctor | opd.doctor@test.com | password123 |
| Nurse 1 | nurse@test.com | password123 |
| Nurse 2 | nurse2@test.com | password123 |

### Test Scenarios

1. **Patient 1 (Rajesh)**: Active FOLFOX treatment for colorectal cancer
   - 4 cycles completed, cycle 5 scheduled for today
   - Has today's appointment confirmed
   - 14 days of vital records

2. **Patient 2 (Priya)**: AC-T treatment for breast cancer
   - Just started, 1 cycle completed
   - Next cycle in 2 weeks

3. **Patient 3 (Amit)**: New patient with DLBCL
   - No treatment plan yet
   - OPD consultation scheduled

---

## Deployment

### Backend Deployment

#### Docker

```dockerfile
# backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```bash
docker build -t chemocare-backend .
docker run -p 8000:8000 \
  -e DATABASE_URL=postgresql+asyncpg://... \
  -e SECRET_KEY=your-secret \
  -e GEMINI_API_KEY=your-key \
  chemocare-backend
```

#### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'
services:
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: chemocare
      POSTGRES_USER: chemocare
      POSTGRES_PASSWORD: secret
    volumes:
      - postgres_data:/var/lib/postgresql/data

  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql+asyncpg://chemocare:secret@db:5432/chemocare
      SECRET_KEY: ${SECRET_KEY}
      GEMINI_API_KEY: ${GEMINI_API_KEY}
    depends_on:
      - db

volumes:
  postgres_data:
```

### Mobile Deployment

#### EAS Build

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure project
eas build:configure

# Build for iOS
eas build --platform ios --profile production

# Build for Android
eas build --platform android --profile production

# Submit to stores
eas submit --platform ios
eas submit --platform android
```

#### Environment Configuration

```json
// eas.json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {
      "env": {
        "EXPO_PUBLIC_API_URL": "https://api.chemocare.ai/api/v1"
      }
    }
  }
}
```

---

## API Endpoints Reference

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login and get tokens |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/logout` | Logout (invalidate refresh token) |
| GET | `/auth/me` | Get current user profile |
| PUT | `/auth/me` | Update profile |
| PUT | `/auth/push-token` | Update push notification token |

### Patients

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/patients/` | List patients (staff only) |
| GET | `/patients/me` | Get own patient profile |
| GET | `/patients/{id}` | Get patient by ID |
| POST | `/patients/` | Create patient profile |
| PUT | `/patients/{id}` | Update patient |

### Clinical

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/clinical/vitals/me` | Get own vitals |
| GET | `/clinical/vitals/{patient_id}` | Get patient vitals |
| POST | `/clinical/vitals` | Record vitals |
| GET | `/clinical/appointments/me` | Get own appointments |
| GET | `/clinical/appointments/{patient_id}` | Get patient appointments |
| POST | `/clinical/symptoms` | Log symptoms |
| GET | `/clinical/symptoms/me` | Get own symptom history |

### Protocols

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/protocols/templates` | List protocol templates |
| GET | `/protocols/templates/{id}` | Get template details |
| POST | `/protocols/templates` | Create template (admin) |
| GET | `/protocols/treatment-plans/{patient_id}` | Get treatment plans |
| POST | `/protocols/treatment-plans` | Create treatment plan |

### Protocol Workflow

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/protocol-workflow/requests` | Create protocol request |
| GET | `/protocol-workflow/requests/{id}` | Get request details |
| POST | `/protocol-workflow/requests/{id}/documents` | Upload document |
| PUT | `/protocol-workflow/requests/{id}/clinical-data` | Update clinical data |
| POST | `/protocol-workflow/requests/{id}/generate` | Generate AI protocol |
| POST | `/protocol-workflow/requests/{id}/nurse-approval` | Nurse approval |
| POST | `/protocol-workflow/requests/{id}/doctor-approval` | Doctor approval |
| GET | `/protocol-workflow/pending` | Get pending approvals |

### Scheduling

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/scheduling/available-slots` | Get available time slots |
| GET | `/scheduling/chair-availability` | Get chair status |
| POST | `/scheduling/appointments` | Schedule appointment |
| PUT | `/scheduling/appointments/{id}/reschedule` | Reschedule |
| DELETE | `/scheduling/appointments/{id}` | Cancel appointment |
| POST | `/scheduling/treatment-plan/{id}/schedule-cycles` | Schedule all cycles |

### Day Care

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/daycare/active-patients` | Get active treatments |
| GET | `/daycare/chair-status` | Get all chair statuses |
| POST | `/daycare/cycles/{id}/start` | Start treatment cycle |
| POST | `/daycare/cycles/{id}/complete` | Complete treatment |
| POST | `/daycare/cycles/{id}/pause` | Pause for reaction |

### AI

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/ai/analyze-symptoms` | Analyze symptom patterns |
| POST | `/ai/check-interactions` | Check drug interactions |
| POST | `/ai/calculate-dose` | Calculate adjusted dose |
| POST | `/ai/extract-document` | Extract data from document |

---

## Environment Variables

### Backend (.env)

```env
# Database
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/chemocare

# JWT Authentication
SECRET_KEY=your-super-secret-key-minimum-32-characters
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# Google Gemini AI
GEMINI_API_KEY=your-gemini-api-key

# Server
DEBUG=true
CORS_ORIGINS=["http://localhost:19006","http://localhost:3000"]

# Optional: Push Notifications
EXPO_ACCESS_TOKEN=your-expo-access-token
```

### Mobile

```env
# .env or app.config.js
EXPO_PUBLIC_API_URL=http://localhost:8000/api/v1
```

---

## Security Considerations

1. **Authentication**: All API endpoints require JWT authentication (except register/login)
2. **Authorization**: Role-based access control enforced at endpoint level
3. **Password Security**: Bcrypt hashing with automatic salt
4. **Token Expiry**: Short-lived access tokens (30 min), longer refresh tokens (7 days)
5. **CORS**: Restricted to known origins
6. **Input Validation**: Pydantic schemas validate all input
7. **SQL Injection**: SQLAlchemy ORM prevents injection attacks
8. **HIPAA Compliance**: Audit logging, data encryption recommendations

---

## Support

For issues or questions:
- GitHub Issues: [ChemoCareAI/issues](https://github.com/moinmakda/ChemoCareAI/issues)
- Email: support@chemocare.ai

---

*Documentation last updated: January 26, 2026*
