"""
API v1 router initialization.
"""
from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.patients import router as patients_router
from app.api.v1.protocols import router as protocols_router
from app.api.v1.clinical import router as clinical_router
from app.api.v1.ai_gemini import router as ai_router  # Using Gemini AI
from app.api.v1.protocol_workflow import router as protocol_workflow_router  # Protocol workflow
from app.api.v1.scheduling import router as scheduling_router  # Scheduling
from app.api.v1.notes import router as notes_router
from app.api.v1.handover import router as handover_router
from app.api.v1.my_medications import router as my_medications_router
from app.api.v1.labs import router as labs_router
from app.api.v1.photos import router as photos_router

api_router = APIRouter()

api_router.include_router(auth_router)
api_router.include_router(patients_router)
api_router.include_router(protocols_router)
api_router.include_router(clinical_router)
api_router.include_router(ai_router)
api_router.include_router(protocol_workflow_router)
api_router.include_router(scheduling_router)
api_router.include_router(notes_router)
api_router.include_router(handover_router)
api_router.include_router(my_medications_router)
api_router.include_router(labs_router)
api_router.include_router(photos_router)
