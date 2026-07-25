import uuid
from datetime import date
from typing import Optional

from sqlalchemy.orm import Session

from app.modules.safety.exceptions import IncidentNotFoundError
from app.modules.safety.models.safety_model import Incident, IncidentStatus
from app.modules.safety.repositories.safety_repository import SafetyRepository
from app.modules.safety.schemas.safety_schema import (
    IncidentCreate,
    IncidentUpdate,
    PaginatedIncidents,
    SafetySummary,
)


class SafetyService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = SafetyRepository(db)

    def create_incident(
        self, org_id: uuid.UUID, created_by: uuid.UUID, payload: IncidentCreate
    ) -> Incident:
        incident = Incident(org_id=org_id, created_by=created_by, **payload.model_dump())
        incident = self.repo.create(incident)
        self.db.commit()
        self.db.refresh(incident)
        return incident

    def get_incident(self, org_id: uuid.UUID, incident_id: uuid.UUID) -> Incident:
        incident = self.repo.get_by_id(org_id, incident_id)
        if incident is None:
            raise IncidentNotFoundError(incident_id)
        return incident

    def list_incidents(
        self,
        org_id: uuid.UUID,
        page: int = 1,
        page_size: int = 20,
        site_id: Optional[uuid.UUID] = None,
        status=None,
        severity=None,
    ) -> PaginatedIncidents:
        items, total = self.repo.list(
            org_id, page=page, page_size=page_size, site_id=site_id, status=status, severity=severity
        )
        return PaginatedIncidents(items=items, total=total, page=page, page_size=page_size)

    def update_incident(
        self, org_id: uuid.UUID, incident_id: uuid.UUID, payload: IncidentUpdate
    ) -> Incident:
        incident = self.get_incident(org_id, incident_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(incident, field, value)
        self.db.commit()
        self.db.refresh(incident)
        return incident

    def delete_incident(self, org_id: uuid.UUID, incident_id: uuid.UUID) -> None:
        incident = self.get_incident(org_id, incident_id)
        self.repo.soft_delete(incident)
        self.db.commit()

    def summary(self, org_id: uuid.UUID, site_id: Optional[uuid.UUID] = None) -> SafetySummary:
        incidents = self.repo.all_for_summary(org_id, site_id=site_id)
        by_severity: dict = {}
        by_status: dict = {}
        by_type: dict = {}
        for inc in incidents:
            by_severity[inc.severity.value] = by_severity.get(inc.severity.value, 0) + 1
            by_status[inc.status.value] = by_status.get(inc.status.value, 0) + 1
            by_type[inc.incident_type.value] = by_type.get(inc.incident_type.value, 0) + 1

        days_since = None
        if incidents:
            latest = max(inc.incident_date for inc in incidents)
            days_since = (date.today() - latest).days

        return SafetySummary(
            total=len(incidents),
            open_count=sum(
                1 for inc in incidents if inc.status != IncidentStatus.CLOSED
            ),
            by_severity=by_severity,
            by_status=by_status,
            by_type=by_type,
            days_since_last_incident=days_since,
        )
