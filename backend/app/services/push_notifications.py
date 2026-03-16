"""
Push Notification Service

Handles push notifications via Expo Push Notifications service.
Supports:
- Individual notifications
- Batch notifications to user groups
- Notification types: appointments, treatments, approvals, alerts
"""
import httpx
from typing import List, Dict, Any, Optional
from datetime import datetime
from pydantic import BaseModel, Field


# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class PushNotification(BaseModel):
    """Single push notification payload."""
    to: str = Field(description="Expo push token")
    title: str = Field(description="Notification title")
    body: str = Field(description="Notification body text")
    data: Optional[Dict[str, Any]] = Field(default={}, description="Custom data payload")
    sound: Optional[str] = Field(default="default", description="Sound to play")
    badge: Optional[int] = Field(default=None, description="Badge count")
    priority: str = Field(default="high", description="Priority: default, normal, high")
    channel_id: Optional[str] = Field(default=None, description="Android notification channel")


class PushNotificationResult(BaseModel):
    """Result of sending a push notification."""
    success: bool
    push_token: str
    message_id: Optional[str] = None
    error: Optional[str] = None


class BatchPushResult(BaseModel):
    """Result of batch push notification."""
    total_sent: int
    successful: int
    failed: int
    results: List[PushNotificationResult]


# =============================================================================
# EXPO PUSH SERVICE
# =============================================================================

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


async def send_push_notification(
    push_token: str,
    title: str,
    body: str,
    data: Optional[Dict[str, Any]] = None,
    sound: str = "default",
    priority: str = "high",
    channel_id: Optional[str] = None,
) -> PushNotificationResult:
    """
    Send a single push notification via Expo Push Service.
    
    Args:
        push_token: Expo push token (ExponentPushToken[xxx])
        title: Notification title
        body: Notification body
        data: Custom data payload
        sound: Sound to play
        priority: Notification priority
        channel_id: Android channel ID
    
    Returns:
        PushNotificationResult with success status
    """
    if not push_token or not push_token.startswith("ExponentPushToken"):
        return PushNotificationResult(
            success=False,
            push_token=push_token or "unknown",
            error="Invalid push token format",
        )
    
    payload = {
        "to": push_token,
        "title": title,
        "body": body,
        "data": data or {},
        "sound": sound,
        "priority": priority,
    }
    
    if channel_id:
        payload["channelId"] = channel_id
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                EXPO_PUSH_URL,
                json=payload,
                headers={
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "Accept-Encoding": "gzip, deflate",
                },
                timeout=10.0,
            )
            
            if response.status_code == 200:
                result = response.json()
                ticket = result.get("data", {})
                
                if ticket.get("status") == "ok":
                    return PushNotificationResult(
                        success=True,
                        push_token=push_token,
                        message_id=ticket.get("id"),
                    )
                else:
                    return PushNotificationResult(
                        success=False,
                        push_token=push_token,
                        error=ticket.get("message", "Unknown error"),
                    )
            else:
                return PushNotificationResult(
                    success=False,
                    push_token=push_token,
                    error=f"HTTP {response.status_code}: {response.text}",
                )
                
    except Exception as e:
        return PushNotificationResult(
            success=False,
            push_token=push_token,
            error=str(e),
        )


async def send_batch_notifications(
    notifications: List[PushNotification],
) -> BatchPushResult:
    """
    Send multiple push notifications in batch.
    
    Expo supports up to 100 notifications per request.
    """
    if not notifications:
        return BatchPushResult(
            total_sent=0,
            successful=0,
            failed=0,
            results=[],
        )
    
    # Split into chunks of 100 (Expo limit)
    chunks = [notifications[i:i + 100] for i in range(0, len(notifications), 100)]
    all_results = []
    
    for chunk in chunks:
        payloads = [
            {
                "to": n.to,
                "title": n.title,
                "body": n.body,
                "data": n.data or {},
                "sound": n.sound,
                "priority": n.priority,
            }
            for n in chunk
        ]
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    EXPO_PUSH_URL,
                    json=payloads,
                    headers={
                        "Accept": "application/json",
                        "Content-Type": "application/json",
                    },
                    timeout=30.0,
                )
                
                if response.status_code == 200:
                    result = response.json()
                    tickets = result.get("data", [])
                    
                    for i, ticket in enumerate(tickets):
                        if ticket.get("status") == "ok":
                            all_results.append(PushNotificationResult(
                                success=True,
                                push_token=chunk[i].to,
                                message_id=ticket.get("id"),
                            ))
                        else:
                            all_results.append(PushNotificationResult(
                                success=False,
                                push_token=chunk[i].to,
                                error=ticket.get("message", "Unknown error"),
                            ))
                else:
                    for n in chunk:
                        all_results.append(PushNotificationResult(
                            success=False,
                            push_token=n.to,
                            error=f"HTTP {response.status_code}",
                        ))
                        
        except Exception as e:
            for n in chunk:
                all_results.append(PushNotificationResult(
                    success=False,
                    push_token=n.to,
                    error=str(e),
                ))
    
    successful = sum(1 for r in all_results if r.success)
    
    return BatchPushResult(
        total_sent=len(notifications),
        successful=successful,
        failed=len(all_results) - successful,
        results=all_results,
    )


# =============================================================================
# HIGH-LEVEL NOTIFICATION FUNCTIONS
# =============================================================================

async def notify_user(
    push_token: str,
    notification_type: str,
    title: str,
    body: str,
    data: Optional[Dict[str, Any]] = None,
) -> PushNotificationResult:
    """
    Send a notification to a specific user.
    
    Args:
        push_token: User's Expo push token
        notification_type: Type of notification (appointment, treatment, alert, etc.)
        title: Notification title
        body: Notification body
        data: Additional data payload
    
    Returns:
        PushNotificationResult
    """
    notification_data = {
        "type": notification_type,
        "timestamp": datetime.utcnow().isoformat(),
        **(data or {}),
    }
    
    # Set channel based on notification type
    channel_id = f"chemocare_{notification_type}"
    
    return await send_push_notification(
        push_token=push_token,
        title=title,
        body=body,
        data=notification_data,
        channel_id=channel_id,
    )


async def notify_appointment_reminder(
    push_token: str,
    patient_name: str,
    appointment_time: datetime,
    appointment_type: str,
) -> PushNotificationResult:
    """Send appointment reminder notification."""
    time_str = appointment_time.strftime("%I:%M %p")
    date_str = appointment_time.strftime("%B %d, %Y")
    
    return await notify_user(
        push_token=push_token,
        notification_type="appointment",
        title="Appointment Reminder",
        body=f"You have a {appointment_type} appointment on {date_str} at {time_str}",
        data={
            "appointment_time": appointment_time.isoformat(),
            "appointment_type": appointment_type,
        },
    )


async def notify_treatment_due(
    push_token: str,
    treatment_name: str,
    scheduled_time: datetime,
) -> PushNotificationResult:
    """Send treatment due notification."""
    time_str = scheduled_time.strftime("%I:%M %p")
    
    return await notify_user(
        push_token=push_token,
        notification_type="treatment",
        title="Treatment Due",
        body=f"Your {treatment_name} treatment is scheduled for {time_str}",
        data={
            "treatment_name": treatment_name,
            "scheduled_time": scheduled_time.isoformat(),
        },
    )


async def notify_protocol_approval_required(
    push_token: str,
    patient_name: str,
    request_id: int,
    approver_role: str,
) -> PushNotificationResult:
    """Send notification that protocol approval is required."""
    return await notify_user(
        push_token=push_token,
        notification_type="approval",
        title="Protocol Approval Required",
        body=f"Protocol for patient {patient_name} requires {approver_role} approval",
        data={
            "request_id": request_id,
            "patient_name": patient_name,
            "approver_role": approver_role,
        },
    )


async def notify_protocol_approved(
    push_token: str,
    protocol_name: str,
) -> PushNotificationResult:
    """Send notification that protocol has been approved."""
    return await notify_user(
        push_token=push_token,
        notification_type="approval",
        title="Treatment Protocol Approved",
        body=f"Your {protocol_name} treatment protocol has been approved. Your care team will contact you for scheduling.",
        data={
            "protocol_name": protocol_name,
            "status": "approved",
        },
    )


async def notify_vitals_alert(
    push_token: str,
    patient_name: str,
    alert_type: str,
    vital_value: str,
) -> PushNotificationResult:
    """Send critical vitals alert to staff."""
    return await notify_user(
        push_token=push_token,
        notification_type="alert",
        title="⚠️ Vitals Alert",
        body=f"Critical {alert_type} for {patient_name}: {vital_value}",
        data={
            "patient_name": patient_name,
            "alert_type": alert_type,
            "vital_value": vital_value,
            "priority": "critical",
        },
    )


async def notify_medication_due(
    push_token: str,
    patient_name: str,
    medication_name: str,
    chair_number: Optional[int] = None,
) -> PushNotificationResult:
    """Send medication due notification to nurse."""
    chair_info = f" (Chair {chair_number})" if chair_number else ""
    
    return await notify_user(
        push_token=push_token,
        notification_type="medication",
        title="Medication Due",
        body=f"{medication_name} due for {patient_name}{chair_info}",
        data={
            "patient_name": patient_name,
            "medication_name": medication_name,
            "chair_number": chair_number,
        },
    )


# =============================================================================
# DATABASE INTEGRATION HELPERS
# =============================================================================

async def get_user_push_token(db, user_id: int) -> Optional[str]:
    """
    Get push token for a user from database.
    
    Assumes User model has a push_token field or related UserDevice table.
    """
    from sqlalchemy import select
    from app.models import User
    
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if user and hasattr(user, 'push_token'):
        return user.push_token
    
    return None


async def notify_user_by_id(
    db,
    user_id: int,
    notification_type: str,
    title: str,
    body: str,
    data: Optional[Dict[str, Any]] = None,
) -> Optional[PushNotificationResult]:
    """
    Send push notification to user by their database ID.
    """
    push_token = await get_user_push_token(db, user_id)
    
    if not push_token:
        return None
    
    return await notify_user(
        push_token=push_token,
        notification_type=notification_type,
        title=title,
        body=body,
        data=data,
    )


async def notify_role_group(
    db,
    role: str,
    notification_type: str,
    title: str,
    body: str,
    data: Optional[Dict[str, Any]] = None,
) -> BatchPushResult:
    """
    Send push notification to all users with a specific role.
    """
    from sqlalchemy import select
    from app.models import User, UserRole
    
    try:
        role_enum = UserRole(role)
    except ValueError:
        return BatchPushResult(
            total_sent=0,
            successful=0,
            failed=0,
            results=[],
        )
    
    result = await db.execute(select(User).where(User.role == role_enum))
    users = result.scalars().all()
    
    notifications = []
    for user in users:
        if hasattr(user, 'push_token') and user.push_token:
            notifications.append(PushNotification(
                to=user.push_token,
                title=title,
                body=body,
                data={
                    "type": notification_type,
                    "timestamp": datetime.utcnow().isoformat(),
                    **(data or {}),
                },
            ))
    
    if not notifications:
        return BatchPushResult(
            total_sent=0,
            successful=0,
            failed=0,
            results=[],
        )
    
    return await send_batch_notifications(notifications)
