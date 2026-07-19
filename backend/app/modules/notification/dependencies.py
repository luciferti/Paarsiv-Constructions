from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_permission
from app.modules.notification.services.notification_service import NotificationService

require_notification_view = require_permission("notification:view")
require_notification_send = require_permission("notification:send")


def get_notification_service(db: Session = Depends(get_db)) -> NotificationService:
    return NotificationService(db)
