import uuid
from typing import List

from sqlalchemy.orm import Session

from app.modules.progress.exceptions import MilestoneNotFoundError
from app.modules.progress.models.progress_model import Milestone
from app.modules.progress.repositories.progress_repository import ProgressRepository
from app.modules.progress.schemas.progress_schema import (
    MilestoneCreate,
    MilestoneOut,
    MilestoneUpdate,
    SiteProgressSummary,
)


class ProgressService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = ProgressRepository(db)

    def add_milestone(
        self, org_id: uuid.UUID, site_id: uuid.UUID, created_by: uuid.UUID, payload: MilestoneCreate
    ) -> Milestone:
        milestone = Milestone(
            org_id=org_id, site_id=site_id, created_by=created_by, **payload.model_dump()
        )
        milestone = self.repo.create(milestone)
        self.db.commit()
        self.db.refresh(milestone)
        return milestone

    def get(self, org_id: uuid.UUID, milestone_id: uuid.UUID) -> Milestone:
        m = self.repo.get_by_id(org_id, milestone_id)
        if m is None:
            raise MilestoneNotFoundError(milestone_id)
        return m

    def update(self, org_id: uuid.UUID, milestone_id: uuid.UUID, payload: MilestoneUpdate) -> Milestone:
        m = self.get(org_id, milestone_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(m, field, value)
        self.db.commit()
        self.db.refresh(m)
        return m

    def delete(self, org_id: uuid.UUID, milestone_id: uuid.UUID) -> None:
        m = self.get(org_id, milestone_id)
        self.repo.soft_delete(m)
        self.db.commit()

    def summary(self, org_id: uuid.UUID, site_id: uuid.UUID) -> SiteProgressSummary:
        milestones = self.repo.list_for_site(org_id, site_id)
        by_status: dict = {}
        for m in milestones:
            by_status[m.status.value] = by_status.get(m.status.value, 0) + 1

        total_weight = sum(m.weight for m in milestones)
        if total_weight > 0:
            overall = sum(float(m.progress_percent) * m.weight for m in milestones) / total_weight
        else:
            overall = 0.0

        return SiteProgressSummary(
            site_id=site_id,
            overall_percent=round(overall, 1),
            milestone_count=len(milestones),
            by_status=by_status,
            milestones=[MilestoneOut.model_validate(m) for m in milestones],
        )
