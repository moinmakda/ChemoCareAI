# ChemoCare AI - Chemotherapy Day Care Management System

A comprehensive healthcare platform for managing chemotherapy treatments with AI-powered protocol generation, real-time patient monitoring, and role-based access for healthcare professionals.

## 🏥 Overview

ChemoCare AI streamlines the chemotherapy treatment workflow across the entire care continuum:

- **Patient Portal**: View treatment schedules, log vitals, access care team messaging
- **Doctor OPD Portal**: Manage patient consultations, create treatment protocols, review AI recommendations
- **Doctor Day Care Portal**: Monitor active infusions, manage chair allocations, handle real-time alerts
- **Nurse Portal**: Execute care tasks, record vitals, administer medications, monitor patients

## 🛠️ Tech Stack

### Backend
- **Framework**: FastAPI (Python 3.11+)
- **Database**: PostgreSQL with pgvector for AI embeddings
- **ORM**: SQLAlchemy (async)
- **Authentication**: JWT with bcrypt password hashing
- **AI Integration**: Google Gemini with structured JSON output

### Mobile App
- **Framework**: React Native with Expo SDK 50
- **Navigation**: Expo Router (file-based routing)
- **State Management**: Zustand
- **Language**: TypeScript (strict mode)
- **UI**: Custom component library with iOS-native design

## 📁 Project Structure

```
chemo-daycare/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── deps.py              # Dependency injection
│   │   │   └── v1/                  # API version 1 routes
│   │   │       ├── auth.py          # Authentication endpoints
│   │   │       ├── patients.py      # Patient management
│   │   │       ├── protocols.py     # Treatment protocols
│   │   │       ├── clinical.py      # Clinical operations
│   │   │       └── ai.py            # AI-powered features
│   │   ├── core/
│   │   │   ├── config.py            # Application settings
│   │   │   ├── database.py          # Database connection
│   │   │   └── security.py          # JWT & password utilities
│   │   ├── models/                  # SQLAlchemy models
│   │   ├── schemas/                 # Pydantic schemas
│   │   └── main.py                  # FastAPI app entry point
│   └── requirements.txt
│
├── mobile/
│   ├── app/                         # Expo Router pages
│   │   ├── (auth)/                  # Auth flow screens
│   │   ├── (patient)/               # Patient portal tabs
│   │   ├── (doctor-opd)/            # OPD doctor portal
│   │   ├── (doctor-daycare)/        # Day care doctor portal
│   │   └── (nurse)/                 # Nurse portal
│   ├── src/
│   │   ├── components/              # Reusable UI components
│   │   ├── constants/               # Theme, config, colors
│   │   ├── services/                # API client & services
│   │   ├── store/                   # Zustand state stores
│   │   └── types/                   # TypeScript interfaces
│   ├── package.json
│   └── app.json
│
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 15+ with pgvector extension
- Expo CLI (`npm install -g expo-cli`)

### Backend Setup

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Create virtual environment:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. **Set up PostgreSQL database:**
   ```sql
   CREATE DATABASE chemocare;
   CREATE EXTENSION vector;  -- For pgvector
   ```

6. **Run database migrations:**
   ```bash
   alembic upgrade head
   ```

7. **Start the server:**
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

   API will be available at: `http://localhost:8000`
   Interactive docs: `http://localhost:8000/docs`

### Mobile App Setup

1. **Navigate to mobile directory:**
   ```bash
   cd mobile
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure API endpoint:**
   ```bash
   # Update src/constants/config.ts with your backend URL
   ```

4. **Start Expo development server:**
   ```bash
   npx expo start
   ```

5. **Run on device/simulator:**
   - Press `i` for iOS Simulator
   - Press `a` for Android Emulator
   - Scan QR code with Expo Go app for physical device

## 🔐 Environment Variables

### Backend (.env)

```env
# Database
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/chemocare

# JWT
SECRET_KEY=your-super-secret-key-min-32-chars
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# OpenAI
OPENAI_API_KEY=sk-your-openai-api-key

# Server
DEBUG=true
CORS_ORIGINS=["http://localhost:3000", "http://localhost:19006"]
```

### Mobile (src/constants/config.ts)

```typescript
export const API_BASE_URL = 'http://localhost:8000/api/v1';
```

## 📱 Features by Portal

### Patient Portal
- 📅 View upcoming appointments and treatment schedule
- 📊 Log and track vitals (temperature, blood pressure, etc.)
- 💬 Secure messaging with care team
- 📋 Access treatment plan and medication list
- 🔔 Appointment reminders and notifications

### Doctor OPD Portal
- 👥 Patient list with search and filter
- 📝 Create and manage treatment protocols
- 🤖 AI-assisted protocol generation
- 📊 Review patient history and lab results
- ✅ Approve chemotherapy orders

### Doctor Day Care Portal
- 🏥 Real-time infusion room monitoring
- 🪑 Chair allocation and management
- ⚠️ Alert system for adverse reactions
- 📈 Live vital sign tracking
- 💉 Drug administration timeline

### Nurse Portal
- 📋 Task queue with priorities
- 💊 Medication administration recording
- 📊 Vital sign entry and monitoring
- 👤 Patient assignment management
- 🚨 Rapid response documentation

## 🤖 AI Features (Powered by Google Gemini)

ChemoCare AI uses **Google Gemini** with structured JSON output (`response_mime_type: application/json`) for type-safe, reliable AI responses.

- **Protocol Generation**: AI-powered chemotherapy protocol suggestions based on diagnosis, patient factors, and evidence-based guidelines (NCCN, ESMO, ASCO)
- **Dose Calculation**: Automated BSA-based dosing with renal/hepatic adjustments and drug-specific caps
- **Drug Interactions**: Real-time pharmacokinetic and pharmacodynamic interaction checking
- **Lab Analysis**: Automated treatment fitness evaluation based on lab values
- **Symptom Analysis**: Intelligent symptom pattern recognition for early complication detection
- **Risk Assessment**: Comprehensive risk profiling with mitigation strategies
- **Smart Recommendations**: Personalized supportive care and monitoring suggestions

### Gemini Configuration

The AI uses Pydantic models for structured output, ensuring:
- Type-safe JSON responses
- Consistent data structures
- Validated medical parameters
- Low temperature settings for medical accuracy

## 🧪 Testing

### Backend
```bash
cd backend
pytest
```

### Mobile
```bash
cd mobile
npm test
```

## 📦 Building for Production

### Backend
```bash
# Using Docker
docker build -t chemocare-backend .
docker run -p 8000:8000 chemocare-backend
```

### Mobile
```bash
# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android
```

## 🔒 Security Considerations

- All API endpoints require JWT authentication
- Patient data is encrypted at rest
- HIPAA-compliant audit logging
- Role-based access control (RBAC)
- Secure password hashing with bcrypt
- Token refresh mechanism for session management

## 📄 License

Proprietary - All rights reserved

## 👥 Team

ChemoCare AI Development Team

---

## 📚 Documentation

- **[Full Technical Documentation](./DOCUMENTATION.md)** - Complete system architecture, data models, services, and workflows
- **[API Reference](./API_REFERENCE.md)** - Detailed API endpoint documentation with request/response examples
- **[Development Status](./DEVELOPMENT_STATUS.md)** - Current development progress and feature status

---

For support or inquiries, contact: support@chemocare.ai

# ChemoCareAI
