import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, status

from app.core.deps import CurrentUser
from app.modules.safety.dependencies import (
    get_safety_service,
    require_safety_create,
    require_safety_delete,
    require_safety_edit,
    require_safety_view,
)
from app.modules.safety.models.safety_model import IncidentSeverity, IncidentStatus
from app.modules.safety.schemas.safety_schema import (
    IncidentCreate,
    IncidentOut,
    IncidentUpdate,
    PaginatedIncidents,
    SafetySummary,
)
from app.modules.safety.services.safety_service import SafetyService

router = APIRouter(prefix="/incidents", tags=["safety"])


@router.post("", response_model=IncidentOut, status_code=status.HTTP_201_CREATED)
def create_incident(
    payload: IncidentCreate,
    user: CurrentUser = Depends(require_safety_create),
    service: SafetyService = Depends(get_safety_service),
) -> IncidentOut:
    inc = service.create_incident(
        org_id=uuid.UUID(user.org_id), created_by=uuid.UUID(user.id), payload=payload
    )
    return IncidentOut.model_validate(inc)


@router.get("/summary", response_model=SafetySummary)
def safety_summary(
    site_id: Optional[uuid.UUID] = Query(None),
    user: CurrentUser = Depends(require_safety_view),
    service: SafetyService = Depends(get_safety_service),
) -> SafetySummary:
    return service.summary(org_id=uuid.UUID(user.org_id), site_id=site_id)


@router.get("", response_model=PaginatedIncidents)
def list_incidents(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    site_id: Optional[uuid.UUID] = Query(None),
    status_filter: Optional[IncidentStatus] = Query(None, alias="status"),
    severity: Optional[IncidentSeverity] = Query(None),
    user: CurrentUser = Depends(require_safety_view),
    service: SafetyService = Depends(get_safety_service),
) -> PaginatedIncidents:
    return service.list_incidents(
        org_id=uuid.UUID(user.org_id),
        page=page,
        page_size=page_size,
        site_id=site_id,
        status=status_filter,
        severity=severity,
    )


@router.get("/{incident_id}", response_model=IncidentOut)
def get_incident(
    incident_id: uuid.UUID,
    user: CurrentUser = Depends(require_safety_view),
    service: SafetyService = Depends(get_safety_service),
) -> IncidentOut:
    return IncidentOut.model_validate(
        service.get_incident(org_id=uuid.UUID(user.org_id), incident_id=incident_id)
    )


@router.patch("/{incident_id}", response_model=IncidentOut)
def update_incident(
    incident_id: uuid.UUID,
    payload: IncidentUpdate,
    user: CurrentUser = Depends(require_safety_edit),
    service: SafetyService = Depends(get_safety_service),
) -> IncidentOut:
    return IncidentOut.model_validate(
        service.update_incident(org_id=uuid.UUID(user.org_id), incident_id=incident_id, payload=payload)
    )


@router.delete("/{incident_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_incident(
    incident_id: uuid.UUID,
    user: CurrentUser = Depends(require_safety_delete),
    service: SafetyService = Depends(get_safety_service),
) -> None:
    service.delete_incident(org_id=uuid.UUID(user.org_id), incident_id=incident_id)
