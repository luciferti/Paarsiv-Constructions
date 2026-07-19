import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.modules.notification.models.notification_model import NotificationStatus


class NotificationCreate(BaseModel):
    site_id: Optional[uuid.UUID] = None
    recipient_name: Optional[str] = Field(None, max_length=255)
    recipient_phone: str = Field(..., min_length=5, max_length=30)
    message: str = Field(..., min_length=1)


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    site_id: Optional[uuid.UUID] = None
    recipient_name: Optional[str] = None
    recipient_phone: str
    message: str
    status: NotificationStatus
    provider_used: str
    created_at: datetime


class PaginatedNotifications(BaseModel):
    items: List[NotificationOut]
    total: int
    page: int
    page_size: int
