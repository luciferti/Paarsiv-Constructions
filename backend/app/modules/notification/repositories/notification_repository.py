import uuid
from typing import List, Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.notification.models.notification_model import Notification


class NotificationRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, notification: Notification) -> Notification:
        self.db.add(notification)
        self.db.flush()
        return notification

    def list(
        self,
        org_id: uuid.UUID,
        page: int,
        page_size: int,
        site_id: Optional[uuid.UUID] = None,
    ) -> Tuple[List[Notification], int]:
        conditions = [Notification.org_id == org_id]
        if site_id is not None:
            conditions.append(Notification.site_id == site_id)

        base_stmt = select(Notification).where(*conditions)
        count_stmt = select(func.count()).select_from(Notification).where(*conditions)
        total = self.db.execute(count_stmt).scalar_one()

        stmt = (
            base_stmt.order_by(Notification.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        items = list(self.db.execute(stmt).scalars().all())
        return items, total
