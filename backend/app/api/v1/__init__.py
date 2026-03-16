"""
API v1 router initialization.
"""
from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.patients import router as patients_router
from app.api.v1.protocols import router as protocols_router
from app.api.v1.clinical import router as clinical_router
from app.api.v1.ai_gemini import router as ai_router  # Using Gemini AI
from app.api.v1.daycare import router as daycare_router  # Day Care management
from app.api.v1.protocol_workflow import router as protocol_workflow_router  # Protocol workflow
from app.api.v1.scheduling import router as scheduling_router  # Scheduling

api_router = APIRouter()

api_router.include_router(auth_router)
api_router.include_router(patients_router)
api_router.include_router(protocols_router)
api_router.include_router(clinical_router)
api_router.include_router(ai_router)
api_router.include_router(daycare_router)
api_router.include_router(protocol_workflow_router)
api_router.include_router(scheduling_router)
