import uuid
from typing import List, Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.safety.models.safety_model import (
    Incident,
    IncidentSeverity,
    IncidentStatus,
)


class SafetyRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, incident: Incident) -> Incident:
        self.db.add(incident)
        self.db.flush()
        return incident

    def get_by_id(self, org_id: uuid.UUID, incident_id: uuid.UUID) -> Optional[Incident]:
        stmt = select(Incident).where(
            Incident.id == incident_id,
            Incident.org_id == org_id,
            Incident.is_deleted.is_(False),
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def list(
        self,
        org_id: uuid.UUID,
        page: int,
        page_size: int,
        site_id: Optional[uuid.UUID] = None,
        status: Optional[IncidentStatus] = None,
        severity: Optional[IncidentSeverity] = None,
    ) -> Tuple[List[Incident], int]:
        conditions = [Incident.org_id == org_id, Incident.is_deleted.is_(False)]
        if site_id is not None:
            conditions.append(Incident.site_id == site_id)
        if status is not None:
            conditions.append(Incident.status == status)
        if severity is not None:
            conditions.append(Incident.severity == severity)

        total = self.db.execute(
            select(func.count()).select_from(Incident).where(*conditions)
        ).scalar_one()
        stmt = (
            select(Incident)
            .where(*conditions)
            .order_by(Incident.incident_date.desc(), Incident.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        return list(self.db.execute(stmt).scalars().all()), total

    def all_for_summary(
        self, org_id: uuid.UUID, site_id: Optional[uuid.UUID] = None
    ) -> List[Incident]:
        conditions = [Incident.org_id == org_id, Incident.is_deleted.is_(False)]
        if site_id is not None:
            conditions.append(Incident.site_id == site_id)
        return list(self.db.execute(select(Incident).where(*conditions)).scalars().all())

    def soft_delete(self, incident: Incident) -> None:
        incident.is_deleted = True
        self.db.flush()
