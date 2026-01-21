"""
API v1 router initialization.
"""
from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.patients import router as patients_router
from app.api.v1.protocols import router as protocols_router
from app.api.v1.clinical import router as clinical_router
from app.api.v1.ai_gemini import router as ai_router  # Using Gemini AI

api_router = APIRouter()

api_router.include_router(auth_router)
api_router.include_router(patients_router)
api_router.include_router(protocols_router)
api_router.include_router(clinical_router)
api_router.include_router(ai_router)
