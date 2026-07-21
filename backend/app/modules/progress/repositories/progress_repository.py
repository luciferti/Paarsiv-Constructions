import uuid
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.progress.models.progress_model import Milestone


class ProgressRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, milestone: Milestone) -> Milestone:
        self.db.add(milestone)
        self.db.flush()
        return milestone

    def get_by_id(self, org_id: uuid.UUID, milestone_id: uuid.UUID) -> Optional[Milestone]:
        stmt = select(Milestone).where(
            Milestone.id == milestone_id,
            Milestone.org_id == org_id,
            Milestone.is_deleted.is_(False),
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def list_for_site(self, org_id: uuid.UUID, site_id: uuid.UUID) -> List[Milestone]:
        stmt = (
            select(Milestone)
            .where(
                Milestone.org_id == org_id,
                Milestone.site_id == site_id,
                Milestone.is_deleted.is_(False),
            )
            .order_by(Milestone.target_date.is_(None), Milestone.target_date, Milestone.created_at)
        )
        return list(self.db.execute(stmt).scalars().all())

    def soft_delete(self, milestone: Milestone) -> None:
        milestone.is_deleted = True
        self.db.flush()
