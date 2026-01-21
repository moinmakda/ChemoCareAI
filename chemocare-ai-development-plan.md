# 🏥 ChemoCare AI - Complete Development Plan

## Project Overview

**ChemoCare AI** is an intelligent chemotherapy day care management system with 4 portals designed to streamline the entire chemotherapy treatment workflow - from OPD consultation to day care administration.

### Tech Stack
- **Frontend:** React Native (Expo) - iOS-first design
- **Backend:** FastAPI (Python 3.11+)
- **Database:** PostgreSQL with pgvector for AI embeddings
- **AI/ML:** OpenAI GPT-4 API + Custom protocol engine
- **Real-time:** WebSockets for live updates
- **Storage:** AWS S3 / Cloudinary for documents
- **Auth:** JWT + Refresh tokens

### Design Philosophy
- **Theme:** Blue (#0066CC primary) + White (#FFFFFF) + Soft grays
- **Style:** iOS-native finish, SF Pro fonts, subtle shadows, smooth animations
- **UX:** Minimal clicks, smart defaults, voice input support, accessibility-first

---

## 📁 Project Structure

```
chemocare/
├── mobile/                          # React Native App
│   ├── src/
│   │   ├── app/                     # Expo Router screens
│   │   │   ├── (auth)/              # Login, Register, Forgot Password
│   │   │   ├── (patient)/           # Patient Portal screens
│   │   │   ├── (doctor-opd)/        # OPD Doctor Portal screens
│   │   │   ├── (doctor-daycare)/    # Day Care Doctor Portal screens
│   │   │   ├── (nurse)/             # Nurse Portal screens
│   │   │   └── _layout.tsx
│   │   ├── components/
│   │   │   ├── ui/                  # Base UI components
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Card.tsx
│   │   │   │   ├── Input.tsx
│   │   │   │   ├── Modal.tsx
│   │   │   │   ├── Avatar.tsx
│   │   │   │   ├── Badge.tsx
│   │   │   │   ├── ProgressRing.tsx
│   │   │   │   ├── Skeleton.tsx
│   │   │   │   └── Toast.tsx
│   │   │   ├── patient/             # Patient-specific components
│   │   │   ├── doctor/              # Doctor-specific components
│   │   │   ├── nurse/               # Nurse-specific components
│   │   │   └── shared/              # Shared components
│   │   ├── hooks/                   # Custom React hooks
│   │   ├── services/                # API service layer
│   │   ├── store/                   # Zustand state management
│   │   ├── utils/                   # Helper functions
│   │   ├── constants/               # App constants, theme
│   │   └── types/                   # TypeScript types
│   ├── assets/
│   ├── app.json
│   └── package.json
│
├── backend/                         # FastAPI Backend
│   ├── app/
│   │   ├── api/
│   │   │   ├── v1/
│   │   │   │   ├── auth.py
│   │   │   │   ├── patients.py
│   │   │   │   ├── doctors.py
│   │   │   │   ├── nurses.py
│   │   │   │   ├── protocols.py
│   │   │   │   ├── appointments.py
│   │   │   │   ├── vitals.py
│   │   │   │   ├── documents.py
│   │   │   │   ├── ai.py
│   │   │   │   └── notifications.py
│   │   │   └── deps.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   ├── security.py
│   │   │   └── database.py
│   │   ├── models/                  # SQLAlchemy models
│   │   ├── schemas/                 # Pydantic schemas
│   │   ├── services/
│   │   │   ├── ai_protocol_engine.py
│   │   │   ├── dose_calculator.py
│   │   │   ├── drug_interaction_checker.py
│   │   │   ├── smart_scheduler.py
│   │   │   └── notification_service.py
│   │   ├── ml/
│   │   │   ├── protocol_generator.py
│   │   │   ├── risk_predictor.py
│   │   │   └── symptom_analyzer.py
│   │   └── main.py
│   ├── alembic/                     # Database migrations
│   ├── tests/
│   ├── requirements.txt
│   └── Dockerfile
│
└── docs/
    ├── api/
    ├── protocols/                   # Chemo protocol definitions
    └── setup.md
```

---

## 🎨 Design System

### Color Palette

```typescript
// constants/theme.ts
export const colors = {
  // Primary Blues
  primary: {
    50: '#E6F0FF',
    100: '#CCE0FF',
    200: '#99C2FF',
    300: '#66A3FF',
    400: '#3385FF',
    500: '#0066CC',      // Main primary
    600: '#0052A3',
    700: '#003D7A',
    800: '#002952',
    900: '#001429',
  },
  
  // Neutrals
  neutral: {
    0: '#FFFFFF',
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
  },
  
  // Semantic Colors
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
  
  // Status Colors for Chemo
  status: {
    pending: '#F59E0B',
    approved: '#10B981',
    inProgress: '#3B82F6',
    completed: '#6366F1',
    cancelled: '#EF4444',
    onHold: '#8B5CF6',
  },
  
  // Portal Accent Colors
  portal: {
    patient: '#0066CC',
    doctorOPD: '#059669',
    doctorDayCare: '#7C3AED',
    nurse: '#DB2777',
  }
};

export const shadows = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px rgba(0, 0, 0, 0.07)',
  lg: '0 10px 15px rgba(0, 0, 0, 0.1)',
  xl: '0 20px 25px rgba(0, 0, 0, 0.15)',
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};
```

### Typography (iOS Style)

```typescript
export const typography = {
  // Large Title - 34pt
  largeTitle: {
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: 0.37,
    lineHeight: 41,
  },
  // Title 1 - 28pt
  title1: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 0.36,
    lineHeight: 34,
  },
  // Title 2 - 22pt
  title2: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 0.35,
    lineHeight: 28,
  },
  // Title 3 - 20pt
  title3: {
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: 0.38,
    lineHeight: 25,
  },
  // Headline - 17pt semibold
  headline: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.41,
    lineHeight: 22,
  },
  // Body - 17pt
  body: {
    fontSize: 17,
    fontWeight: '400',
    letterSpacing: -0.41,
    lineHeight: 22,
  },
  // Callout - 16pt
  callout: {
    fontSize: 16,
    fontWeight: '400',
    letterSpacing: -0.32,
    lineHeight: 21,
  },
  // Subhead - 15pt
  subhead: {
    fontSize: 15,
    fontWeight: '400',
    letterSpacing: -0.24,
    lineHeight: 20,
  },
  // Footnote - 13pt
  footnote: {
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: -0.08,
    lineHeight: 18,
  },
  // Caption 1 - 12pt
  caption1: {
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 0,
    lineHeight: 16,
  },
  // Caption 2 - 11pt
  caption2: {
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 0.07,
    lineHeight: 13,
  },
};
```

---

## 🗄️ Database Schema

### PostgreSQL Tables

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgvector";

-- ============================================
-- USERS & AUTHENTICATION
-- ============================================

CREATE TYPE user_role AS ENUM ('patient', 'doctor_opd', 'doctor_daycare', 'nurse', 'admin');

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- ============================================
-- PATIENT INFORMATION
-- ============================================

CREATE TYPE gender AS ENUM ('male', 'female', 'other');
CREATE TYPE blood_group AS ENUM ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-');

CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Basic Info
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE NOT NULL,
    gender gender NOT NULL,
    blood_group blood_group,
    
    -- Contact
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(10),
    emergency_contact_name VARCHAR(200),
    emergency_contact_phone VARCHAR(20),
    emergency_contact_relation VARCHAR(50),
    
    -- Medical Info
    height_cm DECIMAL(5,2),
    weight_kg DECIMAL(5,2),
    bsa DECIMAL(4,2) GENERATED ALWAYS AS (
        SQRT((height_cm * weight_kg) / 3600)
    ) STORED,
    
    -- Allergies & Comorbidities (JSONB for flexibility)
    allergies JSONB DEFAULT '[]',
    comorbidities JSONB DEFAULT '[]',
    current_medications JSONB DEFAULT '[]',
    
    -- Cancer Info
    cancer_type VARCHAR(200),
    cancer_stage VARCHAR(50),
    diagnosis_date DATE,
    histopathology_details TEXT,
    
    -- Insurance
    insurance_provider VARCHAR(200),
    insurance_policy_number VARCHAR(100),
    insurance_validity DATE,
    
    -- Profile
    profile_photo_url TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- MEDICAL STAFF
-- ============================================

CREATE TABLE doctors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    specialization VARCHAR(200),
    qualification VARCHAR(500),
    registration_number VARCHAR(100) UNIQUE NOT NULL,
    experience_years INTEGER,
    
    -- Department
    is_opd_doctor BOOLEAN DEFAULT false,
    is_daycare_doctor BOOLEAN DEFAULT false,
    
    profile_photo_url TEXT,
    signature_url TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE nurses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    qualification VARCHAR(500),
    registration_number VARCHAR(100) UNIQUE NOT NULL,
    experience_years INTEGER,
    
    -- Certifications
    chemo_certified BOOLEAN DEFAULT false,
    certification_date DATE,
    
    profile_photo_url TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- DOCUMENTS
-- ============================================

CREATE TYPE document_type AS ENUM (
    'prescription', 'lab_report', 'pathology', 'radiology', 
    'discharge_summary', 'insurance', 'consent_form', 'other'
);

CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    
    document_type document_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    file_url TEXT NOT NULL,
    file_type VARCHAR(50),
    file_size_bytes INTEGER,
    
    -- AI Extracted Data
    extracted_text TEXT,
    extracted_data JSONB,
    embedding vector(1536),  -- For semantic search
    
    uploaded_by UUID REFERENCES users(id),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    is_verified BOOLEAN DEFAULT false,
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMP
);

-- ============================================
-- CHEMO PROTOCOLS (Master Data)
-- ============================================

CREATE TABLE protocol_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    name VARCHAR(100) NOT NULL,  -- e.g., 'ABVD', 'CHOP', 'R-CHOP'
    full_name VARCHAR(500),
    cancer_types TEXT[],  -- Array of applicable cancer types
    
    -- Protocol Structure
    cycle_days INTEGER NOT NULL,  -- Total days in one cycle
    total_cycles INTEGER,  -- Recommended total cycles
    
    -- Drugs in protocol (JSONB for complex structure)
    drugs JSONB NOT NULL,
    /*
    Example structure:
    [
        {
            "drug_name": "Doxorubicin",
            "generic_name": "Adriamycin",
            "dose_per_m2": 25,
            "unit": "mg",
            "route": "IV",
            "infusion_duration_mins": 30,
            "days": [1, 15],
            "dilution": "100ml NS",
            "special_instructions": "Vesicant - ensure proper line"
        },
        ...
    ]
    */
    
    -- Pre-medications
    pre_medications JSONB DEFAULT '[]',
    /*
    [
        {
            "drug_name": "Ondansetron",
            "dose": "8mg",
            "route": "IV",
            "timing": "30 mins before chemo"
        }
    ]
    */
    
    -- Post-medications / Take-home
    post_medications JSONB DEFAULT '[]',
    
    -- Monitoring requirements
    required_labs JSONB DEFAULT '[]',  -- Labs needed before each cycle
    monitoring_parameters JSONB DEFAULT '[]',
    
    -- Dose modification rules
    dose_modification_rules JSONB DEFAULT '[]',
    /*
    [
        {
            "parameter": "ANC",
            "condition": "< 1000",
            "action": "Delay 1 week",
            "dose_reduction": null
        },
        {
            "parameter": "Platelets",
            "condition": "< 75000",
            "action": "Reduce dose",
            "dose_reduction": 25
        }
    ]
    */
    
    -- Side effects to monitor
    common_side_effects TEXT[],
    serious_side_effects TEXT[],
    
    -- References
    reference_guidelines TEXT,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- PATIENT TREATMENT PLANS
-- ============================================

CREATE TYPE plan_status AS ENUM (
    'draft', 'pending_opd_approval', 'pending_daycare_approval', 
    'approved', 'active', 'completed', 'cancelled', 'on_hold'
);

CREATE TABLE treatment_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    protocol_template_id UUID REFERENCES protocol_templates(id),
    
    -- AI Generated / Modified Protocol
    protocol_name VARCHAR(100) NOT NULL,
    custom_protocol JSONB NOT NULL,  -- Full protocol with calculated doses
    
    -- Plan Details
    start_date DATE,
    planned_cycles INTEGER NOT NULL,
    completed_cycles INTEGER DEFAULT 0,
    
    -- Status & Approvals
    status plan_status DEFAULT 'draft',
    
    -- AI Analysis
    ai_recommendations TEXT,
    ai_risk_assessment JSONB,
    ai_confidence_score DECIMAL(3,2),
    
    -- OPD Doctor
    created_by_doctor_id UUID REFERENCES doctors(id),
    opd_approved_by UUID REFERENCES doctors(id),
    opd_approved_at TIMESTAMP,
    opd_notes TEXT,
    
    -- Day Care Doctor
    daycare_approved_by UUID REFERENCES doctors(id),
    daycare_approved_at TIMESTAMP,
    daycare_notes TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TREATMENT CYCLES
-- ============================================

CREATE TYPE cycle_status AS ENUM (
    'scheduled', 'pre_assessment', 'approved', 'in_progress', 
    'completed', 'delayed', 'cancelled'
);

CREATE TABLE treatment_cycles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    treatment_plan_id UUID REFERENCES treatment_plans(id) ON DELETE CASCADE,
    
    cycle_number INTEGER NOT NULL,
    scheduled_date DATE NOT NULL,
    actual_date DATE,
    
    status cycle_status DEFAULT 'scheduled',
    
    -- Pre-chemo assessment
    pre_chemo_labs JSONB,  -- Lab values before this cycle
    pre_chemo_vitals JSONB,
    patient_weight_kg DECIMAL(5,2),
    calculated_bsa DECIMAL(4,2),
    
    -- Modifications for this cycle
    dose_modifications JSONB,
    modification_reason TEXT,
    
    -- Approvals
    daycare_doctor_id UUID REFERENCES doctors(id),
    approved_at TIMESTAMP,
    approval_notes TEXT,
    
    -- Administration
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    administered_by UUID REFERENCES nurses(id),
    
    -- Post-chemo
    immediate_reactions JSONB,
    discharge_notes TEXT,
    follow_up_instructions TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- DRUG ADMINISTRATION LOG
-- ============================================

CREATE TYPE admin_status AS ENUM (
    'pending', 'prepared', 'verified', 'started', 'paused', 
    'resumed', 'completed', 'stopped'
);

CREATE TABLE drug_administrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cycle_id UUID REFERENCES treatment_cycles(id) ON DELETE CASCADE,
    
    drug_name VARCHAR(200) NOT NULL,
    planned_dose DECIMAL(10,2) NOT NULL,
    actual_dose DECIMAL(10,2),
    unit VARCHAR(20) NOT NULL,
    route VARCHAR(50) NOT NULL,
    
    -- Timing
    planned_duration_mins INTEGER,
    actual_duration_mins INTEGER,
    
    status admin_status DEFAULT 'pending',
    
    -- Preparation
    prepared_by UUID REFERENCES nurses(id),
    prepared_at TIMESTAMP,
    batch_number VARCHAR(100),
    expiry_date DATE,
    
    -- Verification (double-check)
    verified_by UUID REFERENCES nurses(id),
    verified_at TIMESTAMP,
    
    -- Administration
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    administered_by UUID REFERENCES nurses(id),
    
    -- IV Details
    iv_site VARCHAR(100),
    flow_rate VARCHAR(50),
    
    -- Reactions
    reactions JSONB DEFAULT '[]',
    
    notes TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- VITALS MONITORING
-- ============================================

CREATE TABLE vitals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    cycle_id UUID REFERENCES treatment_cycles(id),
    
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    recorded_by UUID REFERENCES nurses(id),
    
    -- Vitals
    temperature_f DECIMAL(4,1),
    pulse_bpm INTEGER,
    blood_pressure_systolic INTEGER,
    blood_pressure_diastolic INTEGER,
    respiratory_rate INTEGER,
    oxygen_saturation INTEGER,
    
    -- Pain Assessment
    pain_score INTEGER CHECK (pain_score >= 0 AND pain_score <= 10),
    pain_location VARCHAR(200),
    
    -- Additional
    blood_sugar DECIMAL(5,1),
    weight_kg DECIMAL(5,2),
    
    notes TEXT,
    
    -- Timing context
    timing VARCHAR(50),  -- 'pre_chemo', 'during_infusion', 'post_chemo', '15_min', '30_min', etc.
    
    -- AI Alerts
    ai_alerts JSONB DEFAULT '[]'
);

-- ============================================
-- APPOINTMENTS
-- ============================================

CREATE TYPE appointment_type AS ENUM (
    'opd_consultation', 'daycare_chemo', 'follow_up', 
    'lab_work', 'imaging', 'other'
);

CREATE TYPE appointment_status AS ENUM (
    'scheduled', 'confirmed', 'checked_in', 'in_progress',
    'completed', 'cancelled', 'no_show', 'rescheduled'
);

CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    
    appointment_type appointment_type NOT NULL,
    scheduled_date DATE NOT NULL,
    scheduled_time TIME NOT NULL,
    duration_mins INTEGER DEFAULT 30,
    
    -- For chemo appointments
    cycle_id UUID REFERENCES treatment_cycles(id),
    chair_number INTEGER,
    
    -- Staff assigned
    doctor_id UUID REFERENCES doctors(id),
    nurse_id UUID REFERENCES nurses(id),
    
    status appointment_status DEFAULT 'scheduled',
    
    -- Check-in/out
    checked_in_at TIMESTAMP,
    checked_out_at TIMESTAMP,
    
    notes TEXT,
    cancellation_reason TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- NOTIFICATIONS
-- ============================================

CREATE TYPE notification_type AS ENUM (
    'appointment_reminder', 'lab_reminder', 'approval_request',
    'approval_received', 'cycle_completed', 'vitals_alert',
    'reaction_alert', 'document_uploaded', 'message', 'system'
);

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    type notification_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    data JSONB,  -- Additional data for navigation
    
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- PATIENT SYMPTOM DIARY
-- ============================================

CREATE TABLE symptom_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    cycle_id UUID REFERENCES treatment_cycles(id),
    
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Common chemo symptoms (0-10 scale or boolean)
    nausea_score INTEGER CHECK (nausea_score >= 0 AND nausea_score <= 10),
    vomiting_count INTEGER,
    fatigue_score INTEGER CHECK (fatigue_score >= 0 AND fatigue_score <= 10),
    appetite_score INTEGER CHECK (appetite_score >= 0 AND appetite_score <= 10),
    pain_score INTEGER CHECK (pain_score >= 0 AND pain_score <= 10),
    
    -- Specific symptoms
    has_fever BOOLEAN DEFAULT false,
    has_mouth_sores BOOLEAN DEFAULT false,
    has_diarrhea BOOLEAN DEFAULT false,
    has_constipation BOOLEAN DEFAULT false,
    has_numbness BOOLEAN DEFAULT false,
    has_hair_loss BOOLEAN DEFAULT false,
    has_skin_changes BOOLEAN DEFAULT false,
    
    -- Free text
    other_symptoms TEXT,
    mood_notes TEXT,
    
    -- AI Analysis
    ai_severity_score DECIMAL(3,2),
    ai_recommendations TEXT,
    ai_alert_level VARCHAR(20)  -- 'normal', 'monitor', 'urgent'
);

-- ============================================
-- CHAT / MESSAGES
-- ============================================

CREATE TABLE chat_threads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    
    -- Participants
    participants UUID[] NOT NULL,
    
    subject VARCHAR(255),
    is_urgent BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thread_id UUID REFERENCES chat_threads(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id),
    
    message TEXT NOT NULL,
    attachments JSONB DEFAULT '[]',
    
    is_read BOOLEAN DEFAULT false,
    read_by JSONB DEFAULT '[]',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- AUDIT LOG
-- ============================================

CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    
    old_values JSONB,
    new_values JSONB,
    
    ip_address INET,
    user_agent TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_patients_user_id ON patients(user_id);
CREATE INDEX idx_documents_patient_id ON documents(patient_id);
CREATE INDEX idx_documents_embedding ON documents USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_treatment_plans_patient_id ON treatment_plans(patient_id);
CREATE INDEX idx_treatment_plans_status ON treatment_plans(status);
CREATE INDEX idx_treatment_cycles_plan_id ON treatment_cycles(treatment_plan_id);
CREATE INDEX idx_treatment_cycles_date ON treatment_cycles(scheduled_date);
CREATE INDEX idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX idx_appointments_date ON appointments(scheduled_date);
CREATE INDEX idx_vitals_patient_id ON vitals(patient_id);
CREATE INDEX idx_vitals_cycle_id ON vitals(cycle_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id) WHERE is_read = false;
CREATE INDEX idx_symptom_entries_patient_id ON symptom_entries(patient_id);
```

---

## 🔐 Authentication & Authorization

### JWT Token Structure

```python
# backend/app/core/security.py

from datetime import datetime, timedelta
from jose import jwt
from passlib.context import CryptContext
from pydantic import BaseModel

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class TokenPayload(BaseModel):
    sub: str  # user_id
    role: str  # user_role
    exp: datetime
    iat: datetime
    
def create_access_token(user_id: str, role: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=30)
    payload = {
        "sub": user_id,
        "role": role,
        "exp": expire,
        "iat": datetime.utcnow()
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")

def create_refresh_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(days=7)
    payload = {
        "sub": user_id,
        "exp": expire,
        "type": "refresh"
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")
```

### Role-Based Access Control

```python
# backend/app/api/deps.py

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer

security = HTTPBearer()

class RoleChecker:
    def __init__(self, allowed_roles: list[str]):
        self.allowed_roles = allowed_roles
    
    def __call__(self, token: str = Depends(security)):
        payload = verify_token(token.credentials)
        if payload.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
            )
        return payload

# Usage
allow_doctors = RoleChecker(["doctor_opd", "doctor_daycare"])
allow_nurses = RoleChecker(["nurse"])
allow_patients = RoleChecker(["patient"])
allow_medical_staff = RoleChecker(["doctor_opd", "doctor_daycare", "nurse"])
allow_all = RoleChecker(["patient", "doctor_opd", "doctor_daycare", "nurse", "admin"])
```

---

## 🤖 AI Protocol Engine

### Protocol Generation Service

```python
# backend/app/services/ai_protocol_engine.py

import openai
from typing import Optional
from app.models import Patient, ProtocolTemplate, TreatmentPlan
from app.services.dose_calculator import DoseCalculator

class AIProtocolEngine:
    """
    AI-powered chemotherapy protocol generation and optimization.
    """
    
    def __init__(self):
        self.dose_calculator = DoseCalculator()
        self.client = openai.AsyncOpenAI()
    
    async def generate_protocol(
        self,
        patient: Patient,
        protocol_template: ProtocolTemplate,
        recent_labs: dict,
        doctor_notes: Optional[str] = None
    ) -> dict:
        """
        Generate a personalized chemotherapy protocol based on:
        - Patient demographics (age, BSA, comorbidities)
        - Selected protocol template
        - Recent laboratory values
        - Doctor's clinical notes
        """
        
        # Calculate BSA-based doses
        bsa = patient.bsa
        drugs_with_doses = []
        
        for drug in protocol_template.drugs:
            calculated_dose = self.dose_calculator.calculate(
                drug_name=drug['drug_name'],
                dose_per_m2=drug['dose_per_m2'],
                bsa=bsa,
                patient_age=patient.age,
                renal_function=recent_labs.get('creatinine'),
                liver_function=recent_labs.get('bilirubin')
            )
            
            drugs_with_doses.append({
                **drug,
                'calculated_dose': calculated_dose['dose'],
                'dose_adjustments': calculated_dose['adjustments'],
                'warnings': calculated_dose['warnings']
            })
        
        # AI Analysis for additional recommendations
        ai_analysis = await self._get_ai_recommendations(
            patient=patient,
            protocol=protocol_template,
            labs=recent_labs,
            calculated_drugs=drugs_with_doses,
            doctor_notes=doctor_notes
        )
        
        return {
            'protocol_name': protocol_template.name,
            'patient_bsa': bsa,
            'drugs': drugs_with_doses,
            'pre_medications': protocol_template.pre_medications,
            'post_medications': protocol_template.post_medications,
            'schedule': self._generate_schedule(protocol_template),
            'ai_recommendations': ai_analysis['recommendations'],
            'ai_risk_assessment': ai_analysis['risks'],
            'ai_confidence_score': ai_analysis['confidence'],
            'required_monitoring': protocol_template.monitoring_parameters,
            'dose_modification_rules': protocol_template.dose_modification_rules
        }
    
    async def _get_ai_recommendations(
        self,
        patient: Patient,
        protocol: ProtocolTemplate,
        labs: dict,
        calculated_drugs: list,
        doctor_notes: Optional[str]
    ) -> dict:
        """
        Use GPT-4 to analyze the protocol and provide recommendations.
        """
        
        system_prompt = """You are an expert oncology clinical decision support AI.
        Analyze the chemotherapy protocol and patient data to provide:
        1. Safety recommendations
        2. Potential drug interactions
        3. Risk assessment for common complications
        4. Supportive care suggestions
        5. Monitoring recommendations
        
        Be precise, evidence-based, and flag any concerns clearly.
        Always recommend human oversight for final decisions."""
        
        user_prompt = f"""
        Patient Profile:
        - Age: {patient.age} years
        - Gender: {patient.gender}
        - BSA: {patient.bsa} m²
        - Diagnosis: {patient.cancer_type}, Stage {patient.cancer_stage}
        - Comorbidities: {patient.comorbidities}
        - Allergies: {patient.allergies}
        - Current Medications: {patient.current_medications}
        
        Recent Labs:
        {labs}
        
        Protocol: {protocol.name}
        Calculated Drugs:
        {calculated_drugs}
        
        Doctor Notes: {doctor_notes or 'None provided'}
        
        Provide your analysis in JSON format with keys:
        - recommendations (list of strings)
        - risks (list of objects with 'risk', 'severity', 'mitigation')
        - confidence (float 0-1)
        - warnings (list of strings for immediate attention)
        """
        
        response = await self.client.chat.completions.create(
            model="gpt-4-turbo-preview",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.3
        )
        
        return response.choices[0].message.content
    
    def _generate_schedule(self, protocol: ProtocolTemplate) -> list:
        """Generate treatment schedule based on protocol days."""
        schedule = []
        
        for drug in protocol.drugs:
            for day in drug['days']:
                schedule.append({
                    'day': day,
                    'drug': drug['drug_name'],
                    'dose': drug['dose_per_m2'],
                    'route': drug['route']
                })
        
        return sorted(schedule, key=lambda x: x['day'])


class DoseCalculator:
    """
    Calculate chemotherapy doses with appropriate adjustments.
    """
    
    # Dose caps for safety
    DOSE_CAPS = {
        'vincristine': {'max_total': 2, 'unit': 'mg'},
        'bleomycin': {'max_lifetime': 400, 'unit': 'units'},
        'doxorubicin': {'max_lifetime': 550, 'unit': 'mg/m²'},
    }
    
    # Renal adjustments (CrCl-based)
    RENAL_ADJUSTMENTS = {
        'carboplatin': 'calvert_formula',  # Special AUC-based dosing
        'cisplatin': {'crCl_30_60': 0.75, 'crCl_below_30': 'contraindicated'},
        'methotrexate': {'crCl_30_60': 0.5, 'crCl_below_30': 0.25},
    }
    
    def calculate(
        self,
        drug_name: str,
        dose_per_m2: float,
        bsa: float,
        patient_age: int,
        renal_function: Optional[float] = None,
        liver_function: Optional[float] = None
    ) -> dict:
        """
        Calculate the final dose with all adjustments.
        """
        
        base_dose = dose_per_m2 * bsa
        adjustments = []
        warnings = []
        
        # Check dose cap
        drug_lower = drug_name.lower()
        if drug_lower in self.DOSE_CAPS:
            cap = self.DOSE_CAPS[drug_lower]
            if base_dose > cap['max_total']:
                adjustments.append(f"Capped at {cap['max_total']} {cap['unit']}")
                base_dose = cap['max_total']
        
        # Renal adjustment
        if renal_function and drug_lower in self.RENAL_ADJUSTMENTS:
            # Calculate CrCl using Cockcroft-Gault or similar
            # Apply adjustment factor
            pass
        
        # Age adjustment for elderly
        if patient_age > 70:
            adjustments.append("Consider 20% dose reduction for age >70")
            warnings.append("Elderly patient - monitor closely for toxicity")
        
        return {
            'dose': round(base_dose, 2),
            'unit': 'mg',
            'adjustments': adjustments,
            'warnings': warnings
        }


class DrugInteractionChecker:
    """
    Check for drug-drug interactions in chemotherapy regimens.
    """
    
    # Critical interactions database
    INTERACTIONS = {
        ('methotrexate', 'nsaids'): {
            'severity': 'high',
            'effect': 'Increased methotrexate toxicity',
            'recommendation': 'Avoid NSAIDs or monitor closely'
        },
        ('5-fluorouracil', 'warfarin'): {
            'severity': 'high',
            'effect': 'Increased anticoagulant effect',
            'recommendation': 'Monitor INR closely'
        },
        # Add more interactions...
    }
    
    def check_interactions(
        self,
        chemo_drugs: list[str],
        current_medications: list[str]
    ) -> list[dict]:
        """
        Check for interactions between chemo drugs and current medications.
        """
        interactions_found = []
        
        all_drugs = [d.lower() for d in chemo_drugs + current_medications]
        
        for (drug1, drug2), interaction in self.INTERACTIONS.items():
            if drug1 in all_drugs and drug2 in all_drugs:
                interactions_found.append({
                    'drugs': [drug1, drug2],
                    **interaction
                })
        
        return interactions_found
```

### Risk Prediction Model

```python
# backend/app/ml/risk_predictor.py

from sklearn.ensemble import GradientBoostingClassifier
import numpy as np

class ChemoRiskPredictor:
    """
    Predict risks of common chemotherapy complications.
    """
    
    def predict_neutropenia_risk(
        self,
        patient_data: dict,
        protocol: str,
        cycle_number: int
    ) -> dict:
        """
        Predict risk of febrile neutropenia.
        
        Features used:
        - Age
        - BSA
        - Baseline ANC
        - Protocol myelotoxicity score
        - Cycle number
        - Prior neutropenia episodes
        - Comorbidities score
        """
        
        # Feature engineering
        features = self._extract_features(patient_data, protocol, cycle_number)
        
        # Model prediction (placeholder - would use trained model)
        risk_score = self._calculate_risk_score(features)
        
        return {
            'risk_score': risk_score,
            'risk_category': self._categorize_risk(risk_score),
            'recommendation': self._get_recommendation(risk_score),
            'gcsf_recommended': risk_score > 0.2
        }
    
    def predict_nausea_risk(self, patient_data: dict, drugs: list) -> dict:
        """
        Predict risk and severity of chemotherapy-induced nausea.
        """
        
        # Emetogenic potential of drugs
        emetogenic_scores = {
            'cisplatin': 4,  # Highly emetogenic
            'doxorubicin': 3,
            'cyclophosphamide': 3,
            'carboplatin': 3,
            'paclitaxel': 2,
            'vincristine': 1,
        }
        
        max_score = max(emetogenic_scores.get(d.lower(), 2) for d in drugs)
        
        # Adjust for patient factors
        if patient_data.get('gender') == 'female':
            max_score += 0.5
        if patient_data.get('age', 50) < 50:
            max_score += 0.5
        if patient_data.get('history_motion_sickness'):
            max_score += 0.5
        
        return {
            'emetogenic_potential': max_score,
            'category': ['low', 'moderate', 'high', 'very high'][min(int(max_score), 3)],
            'antiemetic_regimen': self._recommend_antiemetics(max_score)
        }
    
    def _recommend_antiemetics(self, score: float) -> list:
        """Recommend antiemetic regimen based on emetogenic potential."""
        
        if score >= 4:
            return [
                {'drug': 'Aprepitant', 'dose': '125mg', 'timing': 'Day 1'},
                {'drug': 'Ondansetron', 'dose': '8mg IV', 'timing': '30 min pre-chemo'},
                {'drug': 'Dexamethasone', 'dose': '12mg', 'timing': 'Day 1'},
            ]
        elif score >= 3:
            return [
                {'drug': 'Ondansetron', 'dose': '8mg IV', 'timing': '30 min pre-chemo'},
                {'drug': 'Dexamethasone', 'dose': '8mg', 'timing': 'Day 1'},
            ]
        else:
            return [
                {'drug': 'Ondansetron', 'dose': '8mg', 'timing': 'PRN'},
            ]
```

---

## 📱 Mobile App Screens

### 1. Patient Portal

```
📱 PATIENT PORTAL SCREENS
═══════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────┐
│  (patient)/                                                  │
│  ├── _layout.tsx           # Tab navigator                  │
│  ├── index.tsx             # Home/Dashboard                 │
│  ├── profile/                                               │
│  │   ├── index.tsx         # View profile                   │
│  │   ├── edit.tsx          # Edit profile                   │
│  │   └── medical-info.tsx  # Medical information            │
│  ├── documents/                                             │
│  │   ├── index.tsx         # Document list                  │
│  │   ├── upload.tsx        # Upload new document            │
│  │   └── [id].tsx          # View document                  │
│  ├── treatment/                                             │
│  │   ├── index.tsx         # Current treatment plan         │
│  │   ├── history.tsx       # Past treatments                │
│  │   └── [cycleId].tsx     # Cycle details                  │
│  ├── appointments/                                          │
│  │   ├── index.tsx         # Upcoming appointments          │
│  │   └── book.tsx          # Book appointment               │
│  ├── symptoms/                                              │
│  │   ├── index.tsx         # Symptom diary                  │
│  │   └── log.tsx           # Log new symptoms               │
│  ├── medications/                                           │
│  │   └── index.tsx         # Current medications            │
│  ├── chat/                                                  │
│  │   ├── index.tsx         # Chat list                      │
│  │   └── [threadId].tsx    # Chat thread                    │
│  └── settings.tsx          # App settings                   │
└─────────────────────────────────────────────────────────────┘
```

#### Patient Dashboard Design

```
┌──────────────────────────────────────────┐
│ ≡  Good Morning, Sarah          🔔  👤  │
├──────────────────────────────────────────┤
│                                          │
│  ┌────────────────────────────────────┐  │
│  │  🗓️ NEXT APPOINTMENT               │  │
│  │                                    │  │
│  │  Cycle 3 of ABVD                   │  │
│  │  Tomorrow, 9:00 AM                 │  │
│  │  Chair 5 • Dr. Sharma              │  │
│  │                                    │  │
│  │  [Pre-chemo checklist →]           │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌─────────────┐  ┌─────────────┐        │
│  │  📊         │  │  📝         │        │
│  │  Treatment  │  │  Log        │        │
│  │  Progress   │  │  Symptoms   │        │
│  │             │  │             │        │
│  │  ████████░░ │  │  How are    │        │
│  │   Cycle 3/6 │  │  you today? │        │
│  └─────────────┘  └─────────────┘        │
│                                          │
│  📋 Quick Actions                        │
│  ┌────────────────────────────────────┐  │
│  │ 📄 Upload Document                 │  │
│  ├────────────────────────────────────┤  │
│  │ 💬 Message Care Team               │  │
│  ├────────────────────────────────────┤  │
│  │ 📅 View Schedule                   │  │
│  ├────────────────────────────────────┤  │
│  │ 💊 My Medications                  │  │
│  └────────────────────────────────────┘  │
│                                          │
│  📰 For You                              │
│  ┌────────────────────────────────────┐  │
│  │ Managing Fatigue During Chemo      │  │
│  │ 5 min read                    →    │  │
│  └────────────────────────────────────┘  │
│                                          │
├──────────────────────────────────────────┤
│   🏠      📋      💬      ⚙️            │
│  Home   Treatment  Chat   Settings       │
└──────────────────────────────────────────┘
```

### 2. Doctor (OPD) Portal

```
📱 DOCTOR OPD PORTAL SCREENS
═══════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────┐
│  (doctor-opd)/                                               │
│  ├── _layout.tsx           # Tab navigator                  │
│  ├── index.tsx             # Dashboard                      │
│  ├── patients/                                              │
│  │   ├── index.tsx         # Patient list                   │
│  │   ├── [id]/                                              │
│  │   │   ├── index.tsx     # Patient overview               │
│  │   │   ├── documents.tsx # Patient documents              │
│  │   │   ├── history.tsx   # Treatment history              │
│  │   │   └── labs.tsx      # Lab results                    │
│  │   └── new.tsx           # Register new patient           │
│  ├── protocols/                                             │
│  │   ├── index.tsx         # Protocol library               │
│  │   ├── create.tsx        # Create protocol for patient    │
│  │   ├── [id].tsx          # Protocol details               │
│  │   └── pending.tsx       # Pending approvals              │
│  ├── appointments/                                          │
│  │   └── index.tsx         # Today's appointments           │
│  ├── referrals/                                             │
│  │   ├── index.tsx         # Referral list                  │
│  │   └── create.tsx        # Create referral                │
│  ├── analytics/                                             │
│  │   └── index.tsx         # Treatment outcomes             │
│  └── settings.tsx                                           │
└─────────────────────────────────────────────────────────────┘
```

#### Protocol Creation Flow

```
┌──────────────────────────────────────────┐
│ ←  Create Treatment Plan                 │
├──────────────────────────────────────────┤
│                                          │
│  Patient: Sarah Johnson                  │
│  Diagnosis: Hodgkin Lymphoma, Stage IIA  │
│  BSA: 1.72 m²                            │
│                                          │
│  ─────────────────────────────────────   │
│                                          │
│  Select Protocol                         │
│  ┌────────────────────────────────────┐  │
│  │  🔍 Search protocols...            │  │
│  └────────────────────────────────────┘  │
│                                          │
│  Recommended for Hodgkin Lymphoma:       │
│  ┌────────────────────────────────────┐  │
│  │  ◉ ABVD                      ⭐    │  │
│  │    First-line, 6 cycles            │  │
│  │    AI Match: 94%                   │  │
│  ├────────────────────────────────────┤  │
│  │  ○ BEACOPP                         │  │
│  │    Advanced stage                  │  │
│  │    AI Match: 72%                   │  │
│  ├────────────────────────────────────┤  │
│  │  ○ Stanford V                      │  │
│  │    Alternative option              │  │
│  │    AI Match: 68%                   │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │        Generate Protocol           │  │
│  └────────────────────────────────────┘  │
│                                          │
└──────────────────────────────────────────┘

          ↓ After AI Generation ↓

┌──────────────────────────────────────────┐
│ ←  Review AI-Generated Protocol    ✏️   │
├──────────────────────────────────────────┤
│                                          │
│  🤖 AI Protocol Summary                  │
│  ┌────────────────────────────────────┐  │
│  │  Protocol: ABVD                    │  │
│  │  Cycles: 6 (21-day cycles)         │  │
│  │  Confidence: 94%                   │  │
│  └────────────────────────────────────┘  │
│                                          │
│  💊 Calculated Doses (BSA: 1.72 m²)      │
│  ┌────────────────────────────────────┐  │
│  │  Doxorubicin    43 mg  Day 1, 15   │  │
│  │  Bleomycin      17 U   Day 1, 15   │  │
│  │  Vinblastine    10 mg  Day 1, 15   │  │
│  │  Dacarbazine    645 mg Day 1, 15   │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ⚠️ AI Recommendations                   │
│  ┌────────────────────────────────────┐  │
│  │  • Baseline echo recommended       │  │
│  │    (Doxorubicin cardiotoxicity)    │  │
│  │  • G-CSF support may be needed     │  │
│  │  • PFTs before Bleomycin           │  │
│  └────────────────────────────────────┘  │
│                                          │
│  📝 Add Notes                            │
│  ┌────────────────────────────────────┐  │
│  │  Patient counseled about...        │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │     ✓ Approve & Send to Daycare    │  │
│  └────────────────────────────────────┘  │
│                                          │
└──────────────────────────────────────────┘
```

### 3. Doctor (Day Care) Portal

```
📱 DOCTOR DAYCARE PORTAL SCREENS
═══════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────┐
│  (doctor-daycare)/                                           │
│  ├── _layout.tsx           # Tab navigator                  │
│  ├── index.tsx             # Today's dashboard              │
│  ├── queue/                                                 │
│  │   └── index.tsx         # Patient queue                  │
│  ├── patients/                                              │
│  │   └── [id]/                                              │
│  │       ├── index.tsx     # Patient overview               │
│  │       ├── pre-chemo.tsx # Pre-chemo assessment           │
│  │       ├── approve.tsx   # Approve for treatment          │
│  │       └── monitor.tsx   # During treatment monitoring    │
│  ├── protocols/                                             │
│  │   ├── pending.tsx       # Pending protocol approvals     │
│  │   └── [id].tsx          # Review protocol                │
│  ├── reactions/                                             │
│  │   ├── index.tsx         # Active reaction alerts         │
│  │   └── log.tsx           # Log reaction                   │
│  ├── analytics/                                             │
│  │   └── index.tsx         # Day care metrics               │
│  └── settings.tsx                                           │
└─────────────────────────────────────────────────────────────┘
```

#### Day Care Dashboard

```
┌──────────────────────────────────────────┐
│ ≡  Day Care Dashboard          🔔  👤   │
│    Tuesday, 15 Oct 2024                  │
├──────────────────────────────────────────┤
│                                          │
│  📊 Today's Overview                     │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐    │
│  │  12  │ │  3   │ │  7   │ │  2   │    │
│  │Total │ │Wait  │ │Active│ │Done  │    │
│  └──────┘ └──────┘ └──────┘ └──────┘    │
│                                          │
│  🚨 Needs Attention                      │
│  ┌────────────────────────────────────┐  │
│  │ ⚠️ Priya M. - ANC 980 (Low)        │  │
│  │    Requires assessment     [View]  │  │
│  ├────────────────────────────────────┤  │
│  │ 🆕 New Protocol Approval            │  │
│  │    Rahul K. - FOLFOX       [Review]│  │
│  └────────────────────────────────────┘  │
│                                          │
│  👥 Patient Queue                        │
│  ┌────────────────────────────────────┐  │
│  │ 🟡 Sarah J.        Cycle 3 ABVD    │  │
│  │    Waiting for approval            │  │
│  │    Labs: ✓  Vitals: ✓              │  │
│  │    [Assess & Approve]              │  │
│  ├────────────────────────────────────┤  │
│  │ 🟢 Amit P.         Cycle 2 CHOP    │  │
│  │    In Progress - Chair 3           │  │
│  │    Started: 10:30 AM               │  │
│  │    [Monitor]                       │  │
│  ├────────────────────────────────────┤  │
│  │ 🟢 Meera S.        Cycle 4 TCH     │  │
│  │    In Progress - Chair 7           │  │
│  │    Completing soon                 │  │
│  │    [Monitor]                       │  │
│  ├────────────────────────────────────┤  │
│  │ ⚪ Kavita R.       Cycle 1 R-CHOP  │  │
│  │    Scheduled 2:00 PM               │  │
│  │    Labs: Pending                   │  │
│  └────────────────────────────────────┘  │
│                                          │
│  📋 Chair Status                         │
│  [1🟢][2⚪][3🟢][4⚪][5🟡][6⚪][7🟢][8⚪]│
│                                          │
├──────────────────────────────────────────┤
│  🏠     👥      📋      📊      ⚙️      │
│ Home   Queue  Protocols Stats  Settings  │
└──────────────────────────────────────────┘
```

#### Pre-Chemo Assessment Screen

```
┌──────────────────────────────────────────┐
│ ←  Pre-Chemo Assessment                  │
├──────────────────────────────────────────┤
│                                          │
│  👤 Sarah Johnson                        │
│  ABVD Cycle 3 • Hodgkin Lymphoma         │
│                                          │
│  ─────────────────────────────────────   │
│                                          │
│  🩸 Lab Results (Today)                  │
│  ┌────────────────────────────────────┐  │
│  │  Parameter    Value    Status      │  │
│  │  ─────────────────────────────     │  │
│  │  Hemoglobin   10.2     ⚠️ Low      │  │
│  │  WBC          5,400    ✓ Normal    │  │
│  │  ANC          2,100    ✓ Normal    │  │
│  │  Platelets    145,000  ✓ Normal    │  │
│  │  Creatinine   0.9      ✓ Normal    │  │
│  │  Bilirubin    0.8      ✓ Normal    │  │
│  └────────────────────────────────────┘  │
│                                          │
│  📊 Today's Vitals                       │
│  ┌────────────────────────────────────┐  │
│  │  BP: 118/76  Pulse: 78  Temp: 98.4 │  │
│  │  SpO2: 98%   Weight: 62 kg         │  │
│  └────────────────────────────────────┘  │
│                                          │
│  🤖 AI Assessment                        │
│  ┌────────────────────────────────────┐  │
│  │  ✅ Patient fit for chemotherapy   │  │
│  │                                    │  │
│  │  Notes:                            │  │
│  │  • Mild anemia - monitor           │  │
│  │  • Consider iron supplementation   │  │
│  │  • All other parameters WNL        │  │
│  └────────────────────────────────────┘  │
│                                          │
│  📝 Clinical Notes                       │
│  ┌────────────────────────────────────┐  │
│  │  Patient reports mild fatigue...   │  │
│  │                                    │  │
│  └────────────────────────────────────┘  │
│                                          │
│  Dose Modification?                      │
│  ┌────────────────────────────────────┐  │
│  │  ○ No modification needed          │  │
│  │  ○ 25% dose reduction              │  │
│  │  ○ Custom modification             │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │     ✓ Approve for Treatment        │  │
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │       ✗ Delay Treatment            │  │
│  └────────────────────────────────────┘  │
│                                          │
└──────────────────────────────────────────┘
```

### 4. Nurse Portal

```
📱 NURSE PORTAL SCREENS
═══════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────┐
│  (nurse)/                                                    │
│  ├── _layout.tsx           # Tab navigator                  │
│  ├── index.tsx             # Dashboard / Today's list       │
│  ├── patients/                                              │
│  │   └── [id]/                                              │
│  │       ├── index.tsx     # Patient care view              │
│  │       ├── vitals.tsx    # Record vitals                  │
│  │       ├── checkin.tsx   # Patient check-in               │
│  │       └── discharge.tsx # Discharge process              │
│  ├── treatments/                                            │
│  │   └── [cycleId]/                                         │
│  │       ├── index.tsx     # Treatment overview             │
│  │       ├── prepare.tsx   # Drug preparation checklist     │
│  │       ├── administer.tsx # Administration screen         │
│  │       └── monitor.tsx   # Monitoring during infusion     │
│  ├── reactions/                                             │
│  │   ├── index.tsx         # Reaction protocols             │
│  │   └── report.tsx        # Report reaction                │
│  ├── inventory/                                             │
│  │   └── index.tsx         # Drug inventory                 │
│  ├── handover/                                              │
│  │   └── index.tsx         # Shift handover                 │
│  └── settings.tsx                                           │
└─────────────────────────────────────────────────────────────┘
```

#### Nurse Dashboard

```
┌──────────────────────────────────────────┐
│ ≡  Nurse Station             🔔  👤     │
│    Morning Shift • 8 Chairs Active       │
├──────────────────────────────────────────┤
│                                          │
│  ⏰ Upcoming Tasks                        │
│  ┌────────────────────────────────────┐  │
│  │ 🔴 10:30 - Vitals due              │  │
│  │    Sarah J. (Chair 5)              │  │
│  ├────────────────────────────────────┤  │
│  │ 🟡 10:45 - Drug prep               │  │
│  │    Amit P. - Rituximab             │  │
│  ├────────────────────────────────────┤  │
│  │ 🟢 11:00 - Start infusion          │  │
│  │    Meera S. - Paclitaxel           │  │
│  └────────────────────────────────────┘  │
│                                          │
│  🪑 My Assigned Chairs                   │
│  ┌────────────────────────────────────┐  │
│  │                                    │  │
│  │  Chair 3 │ Chair 5 │ Chair 7       │  │
│  │  ┌─────┐ │ ┌─────┐ │ ┌─────┐       │  │
│  │  │ 🟢  │ │ │ 🟡  │ │ │ 🟢  │       │  │
│  │  │Amit │ │ │Sarah│ │ │Meera│       │  │
│  │  │ 45m │ │ │ Due │ │ │ 2hr │       │  │
│  │  └─────┘ │ └─────┘ │ └─────┘       │  │
│  │  [View]  │ [Vitals]│ [View]        │  │
│  │                                    │  │
│  └────────────────────────────────────┘  │
│                                          │
│  📋 Quick Actions                        │
│  ┌────────┐ ┌────────┐ ┌────────┐       │
│  │  📊    │ │  💊    │ │  ⚠️    │       │
│  │Record  │ │ Drug   │ │Report  │       │
│  │Vitals  │ │ Prep   │ │Reaction│       │
│  └────────┘ └────────┘ └────────┘       │
│                                          │
│  👥 All Patients Today (12)              │
│  ┌────────────────────────────────────┐  │
│  │ ○ Check-in   ○ Pre-med   ○ Chemo   │  │
│  │ ○ Monitoring ○ Discharge           │  │
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │ Sarah J.      ABVD-3    Chair 5    │  │
│  │ ███████░░░░░░░░░░░░░░  30%         │  │
│  │ Next: Vitals @ 10:30              →│  │
│  ├────────────────────────────────────┤  │
│  │ Amit P.       CHOP-2    Chair 3    │  │
│  │ ████████████████░░░░░  75%         │  │
│  │ Next: Complete @ 11:15            →│  │
│  └────────────────────────────────────┘  │
│                                          │
├──────────────────────────────────────────┤
│  🏠     👥      💊      📋      ⚙️      │
│ Home  Patients  Prep   Tasks   Settings  │
└──────────────────────────────────────────┘
```

#### Drug Preparation Checklist

```
┌──────────────────────────────────────────┐
│ ←  Drug Preparation                      │
├──────────────────────────────────────────┤
│                                          │
│  👤 Sarah Johnson                        │
│  ABVD Cycle 3 • Chair 5                  │
│                                          │
│  ─────────────────────────────────────   │
│                                          │
│  ✅ Pre-medications                      │
│  ┌────────────────────────────────────┐  │
│  │ [✓] Ondansetron 8mg IV             │  │
│  │     Prepared by: You • 10:15 AM    │  │
│  │ [✓] Dexamethasone 8mg IV           │  │
│  │     Prepared by: You • 10:15 AM    │  │
│  └────────────────────────────────────┘  │
│                                          │
│  💊 Chemotherapy Drugs                   │
│                                          │
│  1. Doxorubicin 43mg                     │
│  ┌────────────────────────────────────┐  │
│  │  Status: Ready to prepare          │  │
│  │  Dilution: 50ml NS                 │  │
│  │  Infusion: 15 mins                 │  │
│  │  ⚠️ VESICANT - Check IV line       │  │
│  │                                    │  │
│  │  Batch #: _______________          │  │
│  │  Expiry:  _______________          │  │
│  │                                    │  │
│  │  [ ] Drug verified                 │  │
│  │  [ ] Dose verified                 │  │
│  │  [ ] Patient ID matched            │  │
│  │                                    │  │
│  │  [Scan Barcode]  [Mark Prepared]   │  │
│  └────────────────────────────────────┘  │
│                                          │
│  2. Bleomycin 17 units                   │
│  ┌────────────────────────────────────┐  │
│  │  Status: Pending                   │  │
│  │  Dilution: 100ml NS                │  │
│  │  Infusion: 30 mins                 │  │
│  └────────────────────────────────────┘  │
│                                          │
│  3. Vinblastine 10mg                     │
│  ┌────────────────────────────────────┐  │
│  │  Status: Pending                   │  │
│  └────────────────────────────────────┘  │
│                                          │
│  4. Dacarbazine 645mg                    │
│  ┌────────────────────────────────────┐  │
│  │  Status: Pending                   │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ─────────────────────────────────────   │
│  Double-check required before admin      │
│                                          │
└──────────────────────────────────────────┘
```

#### Vitals Recording Screen

```
┌──────────────────────────────────────────┐
│ ←  Record Vitals                         │
├──────────────────────────────────────────┤
│                                          │
│  👤 Sarah Johnson • Chair 5              │
│  ABVD Cycle 3 • 45 mins into infusion    │
│                                          │
│  Timing: [ During Infusion ▼ ]           │
│                                          │
│  ─────────────────────────────────────   │
│                                          │
│  🌡️ Temperature                          │
│  ┌────────────────────────────────────┐  │
│  │  [ 98.6 ] °F                       │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ❤️ Pulse                                │
│  ┌────────────────────────────────────┐  │
│  │  [ 82 ] bpm                        │  │
│  └────────────────────────────────────┘  │
│                                          │
│  🩺 Blood Pressure                       │
│  ┌──────────┐  /  ┌──────────┐          │
│  │  [ 120 ] │     │  [ 78 ]  │          │
│  └──────────┘     └──────────┘          │
│    Systolic        Diastolic             │
│                                          │
│  💨 Respiratory Rate                     │
│  ┌────────────────────────────────────┐  │
│  │  [ 16 ] /min                       │  │
│  └────────────────────────────────────┘  │
│                                          │
│  🫁 SpO2                                 │
│  ┌────────────────────────────────────┐  │
│  │  [ 98 ] %                          │  │
│  └────────────────────────────────────┘  │
│                                          │
│  😣 Pain Score (0-10)                    │
│  ┌────────────────────────────────────┐  │
│  │  0  1  2  [3] 4  5  6  7  8  9  10 │  │
│  └────────────────────────────────────┘  │
│                                          │
│  📝 Notes                                │
│  ┌────────────────────────────────────┐  │
│  │  Patient comfortable, no complaints│  │
│  │                                    │  │
│  └────────────────────────────────────┘  │
│                                          │
│  🤖 AI Quick Check: ✅ All vitals normal │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │          Save Vitals               │  │
│  └────────────────────────────────────┘  │
│                                          │
└──────────────────────────────────────────┘
```

---

## 🔌 API Endpoints

### Authentication

```
POST   /api/v1/auth/register          # Register new user
POST   /api/v1/auth/login             # Login
POST   /api/v1/auth/refresh           # Refresh token
POST   /api/v1/auth/logout            # Logout
POST   /api/v1/auth/forgot-password   # Request password reset
POST   /api/v1/auth/reset-password    # Reset password
GET    /api/v1/auth/me                # Get current user
```

### Patients

```
GET    /api/v1/patients               # List patients (staff only)
POST   /api/v1/patients               # Create patient profile
GET    /api/v1/patients/:id           # Get patient details
PUT    /api/v1/patients/:id           # Update patient
GET    /api/v1/patients/:id/documents # Get patient documents
POST   /api/v1/patients/:id/documents # Upload document
GET    /api/v1/patients/:id/treatments # Get treatment history
GET    /api/v1/patients/:id/vitals    # Get vitals history
GET    /api/v1/patients/:id/symptoms  # Get symptom entries
POST   /api/v1/patients/:id/symptoms  # Log symptoms
```

### Treatment Plans & Protocols

```
GET    /api/v1/protocols              # List protocol templates
GET    /api/v1/protocols/:id          # Get protocol details

POST   /api/v1/treatment-plans        # Create treatment plan
GET    /api/v1/treatment-plans/:id    # Get plan details
PUT    /api/v1/treatment-plans/:id    # Update plan
POST   /api/v1/treatment-plans/:id/approve-opd      # OPD approval
POST   /api/v1/treatment-plans/:id/approve-daycare  # Daycare approval

GET    /api/v1/treatment-plans/:id/cycles           # Get cycles
POST   /api/v1/treatment-plans/:id/cycles           # Add cycle
GET    /api/v1/cycles/:id                           # Get cycle details
PUT    /api/v1/cycles/:id                           # Update cycle
POST   /api/v1/cycles/:id/approve                   # Approve for treatment
POST   /api/v1/cycles/:id/start                     # Start treatment
POST   /api/v1/cycles/:id/complete                  # Complete treatment
```

### Drug Administration

```
GET    /api/v1/cycles/:id/drugs       # Get drugs for cycle
PUT    /api/v1/drug-admin/:id         # Update drug administration
POST   /api/v1/drug-admin/:id/prepare # Mark as prepared
POST   /api/v1/drug-admin/:id/verify  # Verify drug
POST   /api/v1/drug-admin/:id/start   # Start administration
POST   /api/v1/drug-admin/:id/complete # Complete administration
POST   /api/v1/drug-admin/:id/reaction # Log reaction
```

### Vitals

```
POST   /api/v1/vitals                 # Record vitals
GET    /api/v1/vitals/:patientId      # Get vitals history
GET    /api/v1/vitals/cycle/:cycleId  # Get vitals for cycle
```

### Appointments

```
GET    /api/v1/appointments           # List appointments
POST   /api/v1/appointments           # Create appointment
GET    /api/v1/appointments/:id       # Get appointment
PUT    /api/v1/appointments/:id       # Update appointment
POST   /api/v1/appointments/:id/checkin   # Check in
POST   /api/v1/appointments/:id/checkout  # Check out
DELETE /api/v1/appointments/:id       # Cancel appointment
```

### AI Services

```
POST   /api/v1/ai/generate-protocol   # Generate protocol from template
POST   /api/v1/ai/analyze-labs        # Analyze lab results
POST   /api/v1/ai/risk-assessment     # Get risk assessment
POST   /api/v1/ai/symptom-analysis    # Analyze symptoms
POST   /api/v1/ai/drug-interactions   # Check drug interactions
POST   /api/v1/ai/dose-calculator     # Calculate doses
```

### Notifications

```
GET    /api/v1/notifications          # Get notifications
PUT    /api/v1/notifications/:id/read # Mark as read
PUT    /api/v1/notifications/read-all # Mark all as read
POST   /api/v1/notifications/register-device # Register push token
```

### Chat

```
GET    /api/v1/chats                  # Get chat threads
POST   /api/v1/chats                  # Create new thread
GET    /api/v1/chats/:id              # Get thread messages
POST   /api/v1/chats/:id/messages     # Send message
```

---

## 🎯 AI Features Summary

### 1. Protocol Generation Engine
- Analyzes patient data (BSA, age, comorbidities, labs)
- Selects appropriate protocol template
- Calculates personalized doses
- Generates treatment schedule
- Provides safety recommendations

### 2. Dose Calculator
- BSA-based dose calculation
- Dose capping for safety
- Renal/hepatic adjustments
- Age-based modifications
- Cumulative dose tracking

### 3. Drug Interaction Checker
- Chemo-chemo interactions
- Chemo-medication interactions
- Severity classification
- Alternative suggestions

### 4. Risk Predictor
- Febrile neutropenia risk
- Nausea/vomiting prediction
- Cardiotoxicity risk (anthracyclines)
- Nephrotoxicity risk (platinum)
- G-CSF recommendation

### 5. Lab Analyzer
- Automatic flagging of abnormal values
- Trend analysis
- Treatment fitness assessment
- Dose modification suggestions

### 6. Symptom Analyzer
- Severity scoring
- Pattern recognition
- Alert generation
- Self-care recommendations
- Escalation triggers

### 7. Smart Scheduler
- Chair optimization
- Nurse workload balancing
- Drug preparation timing
- Infusion duration estimation

### 8. Document Intelligence
- OCR for scanned documents
- Auto-extraction of lab values
- Semantic search across documents
- Summary generation

---

## 🔒 Security Considerations

```python
# Security measures to implement

1. Authentication
   - JWT with short expiry (30 mins)
   - Refresh token rotation
   - Device fingerprinting
   - Rate limiting on auth endpoints

2. Authorization
   - Role-based access control
   - Resource-level permissions
   - Audit logging for all PHI access

3. Data Protection
   - Encryption at rest (AES-256)
   - Encryption in transit (TLS 1.3)
   - Field-level encryption for sensitive data
   - Secure key management

4. HIPAA Compliance
   - Access logs with retention
   - Automatic session timeout
   - Secure password requirements
   - Two-factor authentication option

5. API Security
   - Input validation
   - SQL injection prevention
   - XSS protection
   - CORS configuration
   - Request signing for sensitive operations

6. Mobile Security
   - Certificate pinning
   - Secure storage for tokens
   - Biometric authentication
   - App integrity checking
```

---

## 📱 Component Library

### Base UI Components to Build

```typescript
// components/ui/index.ts

// Layout
export { Container } from './Container';
export { Card, CardHeader, CardContent, CardFooter } from './Card';
export { Divider } from './Divider';

// Typography
export { Text } from './Text';
export { Heading } from './Heading';

// Forms
export { Input } from './Input';
export { TextArea } from './TextArea';
export { Select } from './Select';
export { Checkbox } from './Checkbox';
export { RadioGroup } from './RadioGroup';
export { Switch } from './Switch';
export { DatePicker } from './DatePicker';
export { TimePicker } from './TimePicker';

// Buttons
export { Button } from './Button';
export { IconButton } from './IconButton';
export { FAB } from './FAB';

// Feedback
export { Toast } from './Toast';
export { Alert } from './Alert';
export { Modal } from './Modal';
export { BottomSheet } from './BottomSheet';
export { Skeleton } from './Skeleton';
export { Spinner } from './Spinner';

// Data Display
export { Avatar } from './Avatar';
export { Badge } from './Badge';
export { Chip } from './Chip';
export { ProgressBar } from './ProgressBar';
export { ProgressRing } from './ProgressRing';
export { Timeline } from './Timeline';
export { DataTable } from './DataTable';

// Navigation
export { TabBar } from './TabBar';
export { Header } from './Header';
export { SegmentedControl } from './SegmentedControl';

// Lists
export { List, ListItem } from './List';
export { SwipeableRow } from './SwipeableRow';

// Specialized
export { VitalsCard } from './VitalsCard';
export { PatientCard } from './PatientCard';
export { DrugCard } from './DrugCard';
export { StatusBadge } from './StatusBadge';
export { TimelineEvent } from './TimelineEvent';
```

---

## 🚀 Development Phases

### Phase 1: Foundation (Weeks 1-2)
- [ ] Project setup (Expo + FastAPI)
- [ ] Database schema implementation
- [ ] Authentication system
- [ ] Base UI component library
- [ ] Basic navigation structure

### Phase 2: Patient Portal (Weeks 3-4)
- [ ] Patient registration & profile
- [ ] Document upload & management
- [ ] Appointment booking
- [ ] Basic dashboard

### Phase 3: Doctor OPD Portal (Weeks 5-6)
- [ ] Patient management
- [ ] Protocol template library
- [ ] AI protocol generation
- [ ] Treatment plan creation & approval

### Phase 4: Doctor Day Care Portal (Weeks 7-8)
- [ ] Patient queue management
- [ ] Pre-chemo assessment
- [ ] Treatment approval workflow
- [ ] Real-time monitoring dashboard

### Phase 5: Nurse Portal (Weeks 9-10)
- [ ] Patient check-in
- [ ] Vitals recording
- [ ] Drug preparation workflow
- [ ] Administration tracking
- [ ] Discharge process

### Phase 6: AI Enhancement (Weeks 11-12)
- [ ] Advanced protocol generation
- [ ] Risk prediction models
- [ ] Symptom analysis
- [ ] Smart scheduling

### Phase 7: Polish & Integration (Weeks 13-14)
- [ ] Push notifications
- [ ] Chat/messaging
- [ ] Analytics dashboards
- [ ] Performance optimization
- [ ] Testing & bug fixes

### Phase 8: Launch Preparation (Weeks 15-16)
- [ ] Security audit
- [ ] Load testing
- [ ] Documentation
- [ ] User training materials
- [ ] Deployment

---

## 📋 Sample Protocol Data

```json
{
  "name": "ABVD",
  "full_name": "Adriamycin, Bleomycin, Vinblastine, Dacarbazine",
  "cancer_types": ["Hodgkin Lymphoma"],
  "cycle_days": 28,
  "total_cycles": 6,
  "drugs": [
    {
      "drug_name": "Doxorubicin",
      "generic_name": "Adriamycin",
      "dose_per_m2": 25,
      "unit": "mg",
      "route": "IV Push",
      "infusion_duration_mins": 15,
      "days": [1, 15],
      "dilution": "50ml NS",
      "special_instructions": "VESICANT - ensure proper IV access, flush well",
      "max_lifetime_dose_m2": 550
    },
    {
      "drug_name": "Bleomycin",
      "generic_name": "Bleomycin",
      "dose_per_m2": 10,
      "unit": "units",
      "route": "IV",
      "infusion_duration_mins": 30,
      "days": [1, 15],
      "dilution": "100ml NS",
      "special_instructions": "Test dose for first administration. Monitor for pulmonary toxicity.",
      "max_lifetime_dose": 400
    },
    {
      "drug_name": "Vinblastine",
      "generic_name": "Vinblastine",
      "dose_per_m2": 6,
      "unit": "mg",
      "route": "IV Push",
      "infusion_duration_mins": 5,
      "days": [1, 15],
      "dilution": "10ml NS",
      "special_instructions": "VESICANT - flush line well"
    },
    {
      "drug_name": "Dacarbazine",
      "generic_name": "DTIC",
      "dose_per_m2": 375,
      "unit": "mg",
      "route": "IV",
      "infusion_duration_mins": 60,
      "days": [1, 15],
      "dilution": "250ml NS",
      "special_instructions": "Protect from light, highly emetogenic"
    }
  ],
  "pre_medications": [
    {
      "drug_name": "Ondansetron",
      "dose": "8mg",
      "route": "IV",
      "timing": "30 minutes before chemotherapy"
    },
    {
      "drug_name": "Dexamethasone",
      "dose": "8mg",
      "route": "IV",
      "timing": "30 minutes before chemotherapy"
    }
  ],
  "required_labs": [
    "Complete Blood Count",
    "Liver Function Tests",
    "Renal Function Tests"
  ],
  "dose_modification_rules": [
    {
      "parameter": "ANC",
      "condition": "< 1500",
      "action": "Delay until ANC > 1500"
    },
    {
      "parameter": "Platelets",
      "condition": "< 100,000",
      "action": "Delay until Platelets > 100,000"
    },
    {
      "parameter": "Bilirubin",
      "condition": "> 1.5x ULN",
      "action": "Reduce Doxorubicin by 50%"
    }
  ],
  "common_side_effects": [
    "Nausea and vomiting",
    "Hair loss",
    "Fatigue",
    "Low blood counts",
    "Mouth sores"
  ],
  "serious_side_effects": [
    "Pulmonary toxicity (Bleomycin)",
    "Cardiotoxicity (Doxorubicin)",
    "Febrile neutropenia"
  ]
}
```

---

## 🎨 Final UI Polish Checklist

```
iOS-Style Polish:
- [ ] SF Pro font family throughout
- [ ] Proper safe area handling
- [ ] Haptic feedback on interactions
- [ ] Smooth 60fps animations
- [ ] Native-feeling gestures
- [ ] Pull-to-refresh where appropriate
- [ ] Proper keyboard handling
- [ ] Dark mode support

Blue-White Theme:
- [ ] Primary blue (#0066CC) for CTAs
- [ ] White/light gray backgrounds
- [ ] Subtle shadows for depth
- [ ] Consistent border radius (12px)
- [ ] Proper contrast ratios (WCAG AA)

UX Excellence:
- [ ] Maximum 3 taps to any feature
- [ ] Clear loading states
- [ ] Meaningful empty states
- [ ] Error messages with actions
- [ ] Success confirmations
- [ ] Undo capabilities
- [ ] Smart defaults everywhere
```

---

## 📞 Emergency Features

```
Critical Alert System:
- Immediate push notification
- Audio alert on nurse station
- Auto-escalation if not acknowledged
- Emergency contact notification

Reaction Protocols:
- One-tap reaction logging
- Pre-defined reaction protocols
- Auto-pause infusion option
- Emergency medication suggestions
- Direct call to doctor
```

---

*This plan provides a comprehensive blueprint for building ChemoCare AI. Each section can be expanded as development progresses. Good luck with your build!* 🚀
