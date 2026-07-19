import uuid
from typing import Optional

from sqlalchemy.orm import Session

from app.modules.notification.models.notification_model import Notification, NotificationStatus
from app.modules.notification.repositories.notification_repository import NotificationRepository
from app.modules.notification.schemas.notification_schema import (
    NotificationCreate,
    PaginatedNotifications,
)
from app.modules.notification.services.whatsapp_provider import WhatsAppProvider, get_whatsapp_provider


class NotificationService:
    def __init__(self, db: Session, provider: Optional[WhatsAppProvider] = None):
        self.db = db
        self.repo = NotificationRepository(db)
        self.provider = provider or get_whatsapp_provider()

    def send_notification(
        self, org_id: uuid.UUID, created_by: uuid.UUID, payload: NotificationCreate
    ) -> Notification:
        result = self.provider.send(payload.recipient_phone, payload.message)

        notification = Notification(
            org_id=org_id,
            created_by=created_by,
            site_id=payload.site_id,
            recipient_name=payload.recipient_name,
            recipient_phone=payload.recipient_phone,
            message=payload.message,
            status=NotificationStatus(result.status),
            provider_used=result.provider_used,
        )
        notification = self.repo.create(notification)
        self.db.commit()
        self.db.refresh(notification)
        return notification

    def list_notifications(
        self,
        org_id: uuid.UUID,
        page: int = 1,
        page_size: int = 20,
        site_id: Optional[uuid.UUID] = None,
    ) -> PaginatedNotifications:
        items, total = self.repo.list(org_id, page=page, page_size=page_size, site_id=site_id)
        return PaginatedNotifications(items=items, total=total, page=page, page_size=page_size)
