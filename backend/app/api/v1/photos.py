"""Photo Documentation API endpoints."""
import os
import uuid as uuid_mod
import base64
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models import User, Document, DocumentType
from app.schemas.clinical import PhotoResponse
from app.api.deps import get_current_user, allow_medical_staff

router = APIRouter(prefix="/photos", tags=["Photo Documentation"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "uploads", "photos")


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_photo(
    patient_id: str = Form(...),
    category: str = Form("other"),
    description: Optional[str] = Form(None),
    cycle_id: Optional[str] = Form(None),
    image: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload a photo for a patient. Accepts multipart form data."""
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    ext = os.path.splitext(image.filename or "photo.jpg")[1] or ".jpg"
    filename = f"{uuid_mod.uuid4()}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    content = await image.read()
    with open(filepath, "wb") as f:
        f.write(content)

    file_url = f"/uploads/photos/{filename}"

    doc = Document(
        patient_id=patient_id,
        document_type=DocumentType.OTHER,
        title=f"Photo - {category}",
        description=description,
        file_url=file_url,
        file_type=image.content_type or "image/jpeg",
        file_size_bytes=len(content),
        extracted_data={
            "category": category,
            "cycle_id": cycle_id,
        },
        uploaded_by=current_user.id,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    return {
        "id": str(doc.id),
        "patient_id": str(doc.patient_id),
        "file_url": file_url,
        "category": category,
        "description": description,
        "uploaded_at": doc.uploaded_at,
        "uploaded_by": str(current_user.id),
    }


@router.get("", response_model=List[PhotoResponse])
async def list_photos(
    patient_id: UUID,
    category: Optional[str] = None,
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List photos for a patient with optional category filter."""
    query = select(Document).where(
        Document.patient_id == patient_id,
        Document.document_type == DocumentType.OTHER,
    )

    result = await db.execute(query.order_by(Document.uploaded_at.desc()).limit(limit))
    docs = result.scalars().all()

    photos = []
    for doc in docs:
        extracted = doc.extracted_data or {}
        doc_category = extracted.get("category", "other")
        if category and doc_category != category:
            continue
        photos.append(PhotoResponse(
            id=str(doc.id),
            patient_id=str(doc.patient_id),
            file_url=doc.file_url,
            category=doc_category,
            description=doc.description,
            uploaded_at=doc.uploaded_at,
            uploaded_by=str(doc.uploaded_by) if doc.uploaded_by else None,
        ))

    return photos
