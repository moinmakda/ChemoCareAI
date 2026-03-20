"""Lab Results API endpoints."""
from typing import Optional, List
from uuid import UUID
from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models import User, UserRole, Patient, Document, DocumentType, TreatmentPlan, TreatmentCycle
from app.schemas.clinical import LabUpload, LabResultResponse, LabTrendResponse, LabTrendPoint
from app.api.deps import get_current_user, allow_medical_staff

router = APIRouter(prefix="/labs", tags=["Lab Results"])


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_lab(
    data: LabUpload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload lab results. Creates a Document with type=lab_report."""
    doc = Document(
        patient_id=data.patient_id,
        document_type=DocumentType.LAB_REPORT,
        title=data.title,
        file_url="manual_entry",
        extracted_data={
            "parameters": data.parameters,
            "lab_date": str(data.lab_date) if data.lab_date else str(date.today()),
            "notes": data.notes,
        },
        uploaded_by=current_user.id,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    return {
        "id": str(doc.id),
        "patient_id": str(doc.patient_id),
        "title": doc.title,
        "lab_date": data.lab_date or date.today(),
        "parameters": data.parameters,
        "source": "upload",
        "created_at": doc.uploaded_at,
    }


@router.get("", response_model=List[LabResultResponse])
async def list_labs(
    patient_id: Optional[UUID] = None,
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List lab results. Role-aware: patients see own, staff can filter."""
    if current_user.role == UserRole.PATIENT:
        result = await db.execute(select(Patient).where(Patient.user_id == current_user.id))
        patient = result.scalar_one_or_none()
        if not patient:
            return []
        pid = patient.id
    elif patient_id:
        pid = patient_id
    else:
        return []

    results = []

    # 1. Lab documents
    doc_result = await db.execute(
        select(Document).where(
            Document.patient_id == pid,
            Document.document_type == DocumentType.LAB_REPORT,
        ).order_by(Document.uploaded_at.desc()).limit(limit)
    )
    for doc in doc_result.scalars().all():
        extracted = doc.extracted_data or {}
        results.append(LabResultResponse(
            id=str(doc.id),
            patient_id=str(doc.patient_id),
            title=doc.title,
            lab_date=extracted.get("lab_date"),
            parameters=extracted.get("parameters", {}),
            source="upload",
            created_at=doc.uploaded_at,
        ))

    # 2. Pre-chemo labs from cycles
    plan_result = await db.execute(
        select(TreatmentPlan).where(TreatmentPlan.patient_id == pid)
    )
    plans = plan_result.scalars().all()
    for plan in plans:
        cycle_result = await db.execute(
            select(TreatmentCycle).where(
                TreatmentCycle.treatment_plan_id == plan.id,
                TreatmentCycle.pre_chemo_labs != None,
            ).order_by(TreatmentCycle.scheduled_date.desc())
        )
        for cycle in cycle_result.scalars().all():
            results.append(LabResultResponse(
                id=f"cycle-{cycle.id}",
                patient_id=str(pid),
                title=f"Pre-chemo Labs - Cycle {cycle.cycle_number}",
                lab_date=cycle.scheduled_date,
                parameters=cycle.pre_chemo_labs or {},
                source="pre_chemo",
                created_at=cycle.created_at,
            ))

    results.sort(key=lambda x: x.created_at, reverse=True)
    return results[:limit]


@router.get("/trends", response_model=LabTrendResponse)
async def get_lab_trends(
    parameter: str,
    patient_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get trend data for a specific lab parameter."""
    if current_user.role == UserRole.PATIENT:
        result = await db.execute(select(Patient).where(Patient.user_id == current_user.id))
        patient = result.scalar_one_or_none()
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
        pid = patient.id
    elif patient_id:
        pid = patient_id
    else:
        raise HTTPException(status_code=400, detail="patient_id required for staff")

    points = []

    # From lab documents
    doc_result = await db.execute(
        select(Document).where(
            Document.patient_id == pid,
            Document.document_type == DocumentType.LAB_REPORT,
        )
    )
    for doc in doc_result.scalars().all():
        extracted = doc.extracted_data or {}
        params = extracted.get("parameters", {})
        if parameter in params:
            try:
                val = float(params[parameter])
                lab_date_str = extracted.get("lab_date")
                lab_date = date.fromisoformat(lab_date_str) if lab_date_str else doc.uploaded_at.date()
                points.append(LabTrendPoint(date=lab_date, value=val, source="upload"))
            except (ValueError, TypeError):
                pass

    # From pre-chemo labs
    plan_result = await db.execute(select(TreatmentPlan).where(TreatmentPlan.patient_id == pid))
    for plan in plan_result.scalars().all():
        cycle_result = await db.execute(
            select(TreatmentCycle).where(
                TreatmentCycle.treatment_plan_id == plan.id,
                TreatmentCycle.pre_chemo_labs != None,
            )
        )
        for cycle in cycle_result.scalars().all():
            labs = cycle.pre_chemo_labs or {}
            if parameter in labs:
                try:
                    val = float(labs[parameter])
                    points.append(LabTrendPoint(
                        date=cycle.scheduled_date,
                        value=val,
                        source="pre_chemo",
                    ))
                except (ValueError, TypeError):
                    pass

    points.sort(key=lambda x: x.date)

    return LabTrendResponse(
        parameter=parameter,
        points=points,
    )
