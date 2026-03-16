"""
Protocol Workflow API

Endpoints for the complete protocol generation workflow:
1. Patient uploads documents
2. AI extracts clinical data from documents
3. Nurse collects additional data and reviews
4. AI generates protocol based on collected data
5. Nurse approves protocol
6. Doctor reviews and approves final protocol
7. Treatment plan is created from approved protocol
"""
from datetime import datetime, date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_db, get_current_user, get_current_doctor, get_current_nurse
from app.models import (
    User,
    Patient,
    Document,
    ProtocolTemplate,
    Notification,
    NotificationType,
    TreatmentPlan,
    TreatmentCycle,
    PlanStatus,
    CycleStatus,
)
from app.models.protocol_request import ProtocolRequest, ProtocolRequestStatus
from app.schemas.protocol_request import (
    ProtocolRequestCreate,
    ProtocolRequestResponse,
    ProtocolRequestListResponse,
    ClinicalDataUpdate,
    NurseApproval,
    DoctorApproval,
    DocumentUploadResponse,
    WorkflowStatusResponse,
    PendingApprovalsResponse,
)
from app.services.document_extraction import extract_and_map_document
from app.services.gemini_ai import generate_protocol

router = APIRouter(prefix="/protocol-workflow", tags=["protocol-workflow"])


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

async def create_notification(
    db: AsyncSession,
    user_id,
    title: str,
    message: str,
    notification_type: NotificationType = NotificationType.SYSTEM,
    data: Optional[dict] = None,
) -> Notification:
    """Create a notification for a user."""
    notification = Notification(
        user_id=user_id,
        title=title,
        body=message,
        type=notification_type,
        data=data or {},
    )
    db.add(notification)
    await db.commit()
    await db.refresh(notification)
    return notification


async def notify_nurses_for_review(
    db: AsyncSession,
    protocol_request: ProtocolRequest,
    patient_name: str,
):
    """Notify all nurses that a protocol request is ready for review."""
    from app.models import Nurse
    result = await db.execute(select(Nurse))
    nurses = result.scalars().all()

    for nurse in nurses:
        await create_notification(
            db=db,
            user_id=nurse.user_id,
            title="Protocol Review Required",
            message=f"Patient {patient_name} has a protocol request ready for nurse review.",
            notification_type=NotificationType.APPROVAL_REQUEST,
            data={"protocol_request_id": str(protocol_request.id)},
        )


async def notify_doctors_for_approval(
    db: AsyncSession,
    protocol_request: ProtocolRequest,
    patient_name: str,
):
    """Notify doctors that a protocol is ready for final approval."""
    from app.models import Doctor
    result = await db.execute(select(Doctor))
    doctors = result.scalars().all()

    for doctor in doctors:
        await create_notification(
            db=db,
            user_id=doctor.user_id,
            title="Protocol Approval Required",
            message=f"Protocol for patient {patient_name} requires doctor approval.",
            notification_type=NotificationType.APPROVAL_REQUEST,
            data={"protocol_request_id": str(protocol_request.id)},
        )


async def notify_patient_of_approval(
    db: AsyncSession,
    patient: Patient,
    approved: bool,
):
    """Notify patient that their protocol has been approved/rejected."""
    if approved:
        title = "Treatment Protocol Approved"
        message = "Your treatment protocol has been approved by your medical team. You will be contacted for scheduling."
    else:
        title = "Protocol Update"
        message = "There is an update regarding your treatment protocol. Please contact your care team."

    await create_notification(
        db=db,
        user_id=patient.user_id,
        title=title,
        message=message,
        notification_type=NotificationType.APPROVAL_RECEIVED,
    )


async def create_treatment_plan_from_protocol(
    db: AsyncSession,
    protocol_request: ProtocolRequest,
    doctor_id,
) -> Optional[TreatmentPlan]:
    """Create a TreatmentPlan and initial cycles from an approved protocol request."""
    generated = protocol_request.generated_protocol or {}

    # Extract protocol info from AI output, with sensible defaults
    protocol_name = generated.get("recommended_protocol") or generated.get("protocol_name") or "Custom Protocol"
    total_cycles = generated.get("total_cycles") or 6
    cycle_days = generated.get("cycle_days") or 21

    plan = TreatmentPlan(
        patient_id=protocol_request.patient_id,
        protocol_template_id=protocol_request.protocol_template_id,
        protocol_name=protocol_name,
        custom_protocol=generated,
        start_date=date.today(),
        planned_cycles=total_cycles,
        completed_cycles=0,
        status=PlanStatus.APPROVED,
        ai_recommendations=generated.get("rationale", ""),
        ai_confidence_score=generated.get("confidence_score"),
        daycare_approved_by=str(doctor_id) if doctor_id else None,
        daycare_approved_at=datetime.utcnow(),
    )
    db.add(plan)
    await db.flush()

    # Create scheduled cycles
    for i in range(total_cycles):
        cycle_date = date.today() + __import__('datetime').timedelta(days=cycle_days * i)
        cycle = TreatmentCycle(
            treatment_plan_id=plan.id,
            cycle_number=i + 1,
            scheduled_date=cycle_date,
            status=CycleStatus.SCHEDULED,
        )
        db.add(cycle)

    await db.flush()

    # Link back to protocol request
    protocol_request.treatment_plan_id = plan.id
    return plan


# =============================================================================
# PROTOCOL REQUEST CRUD
# =============================================================================

@router.post("/requests", response_model=ProtocolRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_protocol_request(
    request_data: ProtocolRequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new protocol request."""
    patient = await db.get(Patient, request_data.patient_id)
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")

    if current_user.role.value == "patient" and patient.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    protocol_request = ProtocolRequest(
        patient_id=request_data.patient_id,
        protocol_template_id=request_data.protocol_template_id,
        status=ProtocolRequestStatus.DRAFT,
        clinical_data={},
    )
    db.add(protocol_request)
    await db.commit()
    await db.refresh(protocol_request)

    return ProtocolRequestResponse.model_validate(protocol_request)


@router.get("/requests", response_model=ProtocolRequestListResponse)
async def list_protocol_requests(
    status_filter: Optional[str] = None,
    patient_id: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List protocol requests based on user role and filters."""
    query = select(ProtocolRequest)

    if current_user.role.value == "patient":
        patient_result = await db.execute(
            select(Patient).where(Patient.user_id == current_user.id)
        )
        patient = patient_result.scalar_one_or_none()
        if patient:
            query = query.where(ProtocolRequest.patient_id == patient.id)
        else:
            return ProtocolRequestListResponse(items=[], total=0, page=page, page_size=page_size)

    if status_filter:
        try:
            status_enum = ProtocolRequestStatus(status_filter)
            query = query.where(ProtocolRequest.status == status_enum)
        except ValueError:
            pass

    if patient_id and current_user.role.value != "patient":
        query = query.where(ProtocolRequest.patient_id == patient_id)

    count_result = await db.execute(query)
    total = len(count_result.scalars().all())

    query = query.offset((page - 1) * page_size).limit(page_size)
    query = query.order_by(ProtocolRequest.created_at.desc())

    result = await db.execute(query)
    requests = result.scalars().all()

    return ProtocolRequestListResponse(
        items=[ProtocolRequestResponse.model_validate(r) for r in requests],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/requests/{request_id}", response_model=ProtocolRequestResponse)
async def get_protocol_request(
    request_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific protocol request."""
    from uuid import UUID
    try:
        rid = UUID(request_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid request ID")

    protocol_request = await db.get(ProtocolRequest, rid)
    if not protocol_request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Protocol request not found")

    if current_user.role.value == "patient":
        patient_result = await db.execute(
            select(Patient).where(Patient.user_id == current_user.id)
        )
        patient = patient_result.scalar_one_or_none()
        if not patient or protocol_request.patient_id != patient.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    return ProtocolRequestResponse.model_validate(protocol_request)


# =============================================================================
# DOCUMENT UPLOAD WITH AI EXTRACTION
# =============================================================================

@router.post("/requests/{request_id}/upload-document", response_model=DocumentUploadResponse)
async def upload_document_with_extraction(
    request_id: str,
    file: UploadFile = File(...),
    document_type: str = Form("lab_report"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload a document and extract clinical data using AI."""
    from uuid import UUID
    try:
        rid = UUID(request_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid request ID")

    protocol_request = await db.get(ProtocolRequest, rid)
    if not protocol_request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Protocol request not found")

    file_content = await file.read()
    mime_type = file.content_type or "image/jpeg"
    filename = file.filename or "document"

    # Save document with correct field names matching Document model
    document = Document(
        patient_id=protocol_request.patient_id,
        uploaded_by=current_user.id,          # correct field name
        document_type=document_type,
        title=filename,                         # correct field name (not file_name)
        file_size_bytes=len(file_content),     # correct field name
        file_type=mime_type,                   # correct field name
        file_url=f"/documents/{request_id}/{filename}",  # correct field name
    )
    db.add(document)

    # Extract data using AI
    try:
        extraction_result = await extract_and_map_document(
            image_data=file_content,
            mime_type=mime_type,
        )

        document.extracted_text = str(extraction_result.get("extraction", {}))
        document.extracted_data = extraction_result
        document.is_verified = not extraction_result.get("needs_verification", True)

        current_clinical_data = protocol_request.clinical_data or {}
        clinical_updates = extraction_result.get("clinical_data_updates", {})

        for key, value in clinical_updates.items():
            if isinstance(value, dict) and key in current_clinical_data:
                current_clinical_data[key].update(value)
            else:
                current_clinical_data[key] = value

        if "source_documents" not in current_clinical_data:
            current_clinical_data["source_documents"] = []
        current_clinical_data["source_documents"].append({
            "document_id": None,
            "filename": filename,
            "type": document_type,
            "extracted_at": datetime.utcnow().isoformat(),
            "confidence": extraction_result.get("overall_confidence", 0),
        })

        protocol_request.clinical_data = current_clinical_data

        await db.commit()
        await db.refresh(document)

        current_clinical_data["source_documents"][-1]["document_id"] = str(document.id)
        protocol_request.clinical_data = current_clinical_data
        await db.commit()

        return DocumentUploadResponse(
            document_id=document.id,
            document_type=extraction_result.get("document_type", document_type),
            extraction_success=True,
            extracted_data=extraction_result.get("extraction"),
            clinical_data_updates=clinical_updates,
            needs_verification=extraction_result.get("needs_verification", True),
            overall_confidence=extraction_result.get("overall_confidence", 0),
            message="Document uploaded and clinical data extracted successfully",
        )

    except Exception as e:
        await db.commit()
        await db.refresh(document)

        return DocumentUploadResponse(
            document_id=document.id,
            document_type=document_type,
            extraction_success=False,
            needs_verification=True,
            overall_confidence=0,
            message=f"Document uploaded but extraction failed: {str(e)}",
        )


# =============================================================================
# CLINICAL DATA MANAGEMENT
# =============================================================================

@router.put("/requests/{request_id}/clinical-data", response_model=ProtocolRequestResponse)
async def update_clinical_data(
    request_id: str,
    data: ClinicalDataUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update clinical data for a protocol request."""
    from uuid import UUID
    try:
        rid = UUID(request_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid request ID")

    protocol_request = await db.get(ProtocolRequest, rid)
    if not protocol_request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Protocol request not found")

    current_data = protocol_request.clinical_data or {}
    update_dict = data.clinical_data.model_dump(exclude_unset=True)

    for key, value in update_dict.items():
        if value is not None:
            if isinstance(value, dict) and key in current_data:
                current_data[key].update(value)
            else:
                current_data[key] = value

    protocol_request.clinical_data = current_data

    if current_user.role.value == "nurse":
        if protocol_request.status == ProtocolRequestStatus.DRAFT:
            protocol_request.status = ProtocolRequestStatus.NURSE_COLLECTING

    await db.commit()
    await db.refresh(protocol_request)

    return ProtocolRequestResponse.model_validate(protocol_request)


# =============================================================================
# NURSE WORKFLOW
# =============================================================================

@router.post("/requests/{request_id}/nurse-submit", response_model=ProtocolRequestResponse)
async def nurse_submit_for_review(
    request_id: str,
    notes: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_nurse),
):
    """Nurse submits collected data for review. Triggers AI protocol generation."""
    from uuid import UUID
    try:
        rid = UUID(request_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid request ID")

    protocol_request = await db.get(ProtocolRequest, rid)
    if not protocol_request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Protocol request not found")

    if protocol_request.status not in [ProtocolRequestStatus.DRAFT, ProtocolRequestStatus.NURSE_COLLECTING]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot submit request in status: {protocol_request.status.value}",
        )

    patient = await db.get(Patient, protocol_request.patient_id)
    template = None
    if protocol_request.protocol_template_id:
        template = await db.get(ProtocolTemplate, protocol_request.protocol_template_id)

    # Generate protocol using AI
    try:
        clinical_data = protocol_request.clinical_data or {}

        patient_context = {
            "patient_id": str(patient.id),
            "age": patient.age,
            "weight_kg": float(clinical_data.get("weight_kg") or patient.weight_kg or 0),
            "height_cm": float(clinical_data.get("height_cm") or patient.height_cm or 0),
            "bsa": float(patient.bsa) if patient.bsa else None,
            "cancer_type": clinical_data.get("cancer_type") or patient.cancer_type,
            "cancer_stage": clinical_data.get("disease_stage") or patient.cancer_stage,
            "allergies": patient.allergies or [],
            "comorbidities": patient.comorbidities or [],
            "clinical_data": clinical_data,
        }

        template_context = None
        if template:
            template_context = {
                "template_id": str(template.id),
                "template_name": template.name,
                "cancer_type": template.cancer_types,
                "drugs": template.drugs,
                "schedule": {"cycle_days": template.cycle_days, "total_cycles": template.total_cycles},
            }

        ai_result = await generate_protocol(
            patient_info={
                "age": patient_context.get("age"),
                "gender": getattr(patient, "gender", None),
                "weight": patient_context.get("weight_kg"),
                "height": patient_context.get("height_cm"),
                "bsa": patient_context.get("bsa"),
            },
            diagnosis=patient_context.get("cancer_type") or "Unknown",
            stage=patient_context.get("cancer_stage") or "Unknown",
            template_name=template_context["template_name"] if template_context else "Standard Protocol",
            template_drugs=template_context["drugs"] if template_context else [],
            recent_labs=clinical_data,
            comorbidities=patient_context.get("comorbidities") or [],
        )

        protocol_request.generated_protocol = ai_result.model_dump()

    except Exception as e:
        protocol_request.generated_protocol = {
            "error": str(e),
            "status": "generation_failed",
            "message": "AI protocol generation failed. Manual entry required.",
        }

    from app.models import Nurse
    nurse_result = await db.execute(select(Nurse).where(Nurse.user_id == current_user.id))
    nurse = nurse_result.scalar_one_or_none()

    protocol_request.nurse_collected_data = protocol_request.clinical_data
    protocol_request.nurse_id = nurse.id if nurse else None
    protocol_request.nurse_reviewed_at = datetime.utcnow()
    protocol_request.nurse_review_notes = notes
    protocol_request.status = ProtocolRequestStatus.NURSE_REVIEW

    await db.commit()
    await db.refresh(protocol_request)

    return ProtocolRequestResponse.model_validate(protocol_request)


@router.post("/requests/{request_id}/nurse-approve", response_model=ProtocolRequestResponse)
async def nurse_approve_protocol(
    request_id: str,
    approval: NurseApproval,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_nurse),
):
    """Nurse approves or rejects the generated protocol."""
    from uuid import UUID
    try:
        rid = UUID(request_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid request ID")

    protocol_request = await db.get(ProtocolRequest, rid)
    if not protocol_request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Protocol request not found")

    if protocol_request.status != ProtocolRequestStatus.NURSE_REVIEW:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot approve request in status: {protocol_request.status.value}",
        )

    from app.models import Nurse
    nurse_result = await db.execute(select(Nurse).where(Nurse.user_id == current_user.id))
    nurse = nurse_result.scalar_one_or_none()

    protocol_request.nurse_id = nurse.id if nurse else None
    protocol_request.nurse_reviewed_at = datetime.utcnow()
    protocol_request.nurse_review_notes = approval.notes

    patient = await db.get(Patient, protocol_request.patient_id)
    patient_name = f"{patient.first_name} {patient.last_name}"

    if approval.action == "approve":
        protocol_request.status = ProtocolRequestStatus.DOCTOR_REVIEW
        await db.commit()
        await notify_doctors_for_approval(db, protocol_request, patient_name)
    else:
        protocol_request.status = ProtocolRequestStatus.NURSE_COLLECTING
        await db.commit()

    await db.refresh(protocol_request)
    return ProtocolRequestResponse.model_validate(protocol_request)


# =============================================================================
# DOCTOR WORKFLOW
# =============================================================================

@router.post("/requests/{request_id}/doctor-approve", response_model=ProtocolRequestResponse)
async def doctor_approve_protocol(
    request_id: str,
    approval: DoctorApproval,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_doctor),
):
    """Doctor approves, modifies, or rejects the protocol. On approval, creates the treatment plan."""
    from uuid import UUID
    try:
        rid = UUID(request_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid request ID")

    protocol_request = await db.get(ProtocolRequest, rid)
    if not protocol_request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Protocol request not found")

    if protocol_request.status != ProtocolRequestStatus.DOCTOR_REVIEW:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot approve request in status: {protocol_request.status.value}",
        )

    from app.models import Doctor
    doctor_result = await db.execute(select(Doctor).where(Doctor.user_id == current_user.id))
    doctor = doctor_result.scalar_one_or_none()

    protocol_request.doctor_id = doctor.id if doctor else None
    protocol_request.doctor_reviewed_at = datetime.utcnow()
    protocol_request.doctor_review_notes = approval.notes

    patient = await db.get(Patient, protocol_request.patient_id)

    if approval.action in ("approve", "modify"):
        if approval.action == "modify" and approval.modified_protocol:
            protocol_request.generated_protocol = approval.modified_protocol

        protocol_request.status = ProtocolRequestStatus.APPROVED

        # Create TreatmentPlan from the approved protocol
        try:
            await create_treatment_plan_from_protocol(
                db=db,
                protocol_request=protocol_request,
                doctor_id=doctor.id if doctor else None,
            )
        except Exception as e:
            import logging
            logging.error(f"Failed to create treatment plan: {e}")

        await db.commit()
        await notify_patient_of_approval(db, patient, approved=True)

    else:  # reject
        protocol_request.status = ProtocolRequestStatus.REJECTED
        await db.commit()
        await notify_patient_of_approval(db, patient, approved=False)

    await db.refresh(protocol_request)
    return ProtocolRequestResponse.model_validate(protocol_request)


# =============================================================================
# WORKFLOW STATUS & PENDING APPROVALS
# =============================================================================

@router.get("/requests/{request_id}/status", response_model=WorkflowStatusResponse)
async def get_workflow_status(
    request_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get current workflow status for a protocol request."""
    from uuid import UUID
    try:
        rid = UUID(request_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid request ID")

    protocol_request = await db.get(ProtocolRequest, rid)
    if not protocol_request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Protocol request not found")

    pending_by = None
    if protocol_request.status in [ProtocolRequestStatus.NURSE_COLLECTING, ProtocolRequestStatus.NURSE_REVIEW]:
        pending_by = "nurse"
    elif protocol_request.status == ProtocolRequestStatus.DOCTOR_REVIEW:
        pending_by = "doctor"

    return WorkflowStatusResponse(
        request_id=str(protocol_request.id),
        current_status=protocol_request.status,
        data_collection_complete=protocol_request.status.value not in ["draft", "nurse_collecting"],
        nurse_review_complete=protocol_request.status.value in ["doctor_review", "approved", "rejected"],
        doctor_review_complete=protocol_request.status.value in ["approved", "rejected"],
        pending_action_by=pending_by,
        created_at=protocol_request.created_at,
        last_updated=protocol_request.updated_at,
    )


@router.get("/pending-approvals", response_model=PendingApprovalsResponse)
async def get_pending_approvals(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get pending approvals for the current user based on their role."""
    nurse_pending = []
    doctor_pending = []

    is_nurse = current_user.role.value == "nurse"
    is_doctor = current_user.role.value in ["doctor", "doctor_daycare", "doctor_opd"]
    is_admin = current_user.role.value == "admin"

    if is_nurse or is_doctor or is_admin:
        result = await db.execute(
            select(ProtocolRequest).where(
                ProtocolRequest.status.in_([
                    ProtocolRequestStatus.DRAFT,
                    ProtocolRequestStatus.NURSE_COLLECTING,
                    ProtocolRequestStatus.NURSE_REVIEW,
                    ProtocolRequestStatus.PENDING_NURSE_APPROVAL,
                ])
            )
        )
        nurse_pending = [ProtocolRequestResponse.model_validate(r) for r in result.scalars().all()]

    if is_doctor or is_admin:
        result = await db.execute(
            select(ProtocolRequest).where(
                ProtocolRequest.status.in_([
                    ProtocolRequestStatus.DOCTOR_REVIEW,
                    ProtocolRequestStatus.NURSE_APPROVED,
                    ProtocolRequestStatus.PENDING_DOCTOR_APPROVAL,
                ])
            )
        )
        doctor_pending = [ProtocolRequestResponse.model_validate(r) for r in result.scalars().all()]

    return PendingApprovalsResponse(
        nurse_pending=nurse_pending,
        doctor_pending=doctor_pending,
        total_pending=len(nurse_pending) + len(doctor_pending),
    )
