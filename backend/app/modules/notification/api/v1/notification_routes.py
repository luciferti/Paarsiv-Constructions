import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, status

from app.core.deps import CurrentUser
from app.modules.notification.dependencies import (
    get_notification_service,
    require_notification_send,
    require_notification_view,
)
from app.modules.notification.schemas.notification_schema import (
    NotificationCreate,
    NotificationOut,
    PaginatedNotifications,
)
from app.modules.notification.services.notification_service import NotificationService

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.post("", response_model=NotificationOut, status_code=status.HTTP_201_CREATED)
def send_notification(
    payload: NotificationCreate,
    user: CurrentUser = Depends(require_notification_send),
    service: NotificationService = Depends(get_notification_service),
) -> NotificationOut:
    notification = service.send_notification(
        org_id=uuid.UUID(user.org_id), created_by=uuid.UUID(user.id), payload=payload
    )
    return NotificationOut.model_validate(notification)


@router.get("", response_model=PaginatedNotifications)
def list_notifications(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    site_id: Optional[uuid.UUID] = Query(None),
    user: CurrentUser = Depends(require_notification_view),
    service: NotificationService = Depends(get_notification_service),
) -> PaginatedNotifications:
    return service.list_notifications(
        org_id=uuid.UUID(user.org_id), page=page, page_size=page_size, site_id=site_id
    )
