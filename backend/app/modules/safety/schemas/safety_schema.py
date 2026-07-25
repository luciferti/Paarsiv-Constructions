import uuid
from datetime import date, datetime
from typing import Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.modules.safety.models.safety_model import (
    IncidentSeverity,
    IncidentStatus,
    IncidentType,
)


class IncidentBase(BaseModel):
    site_id: uuid.UUID
    incident_date: date
    incident_type: IncidentType
    severity: IncidentSeverity
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    action_taken: Optional[str] = None
    reported_by: Optional[str] = Field(None, max_length=255)


class IncidentCreate(IncidentBase):
    status: IncidentStatus = IncidentStatus.OPEN


class IncidentUpdate(BaseModel):
    incident_type: Optional[IncidentType] = None
    severity: Optional[IncidentSeverity] = None
    status: Optional[IncidentStatus] = None
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    action_taken: Optional[str] = None
    reported_by: Optional[str] = Field(None, max_length=255)


class IncidentOut(IncidentBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    org_id: uuid.UUID
    status: IncidentStatus
    created_at: datetime
    updated_at: datetime


class IncidentListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    site_id: uuid.UUID
    incident_date: date
    incident_type: IncidentType
    severity: IncidentSeverity
    status: IncidentStatus
    title: str


class PaginatedIncidents(BaseModel):
    items: List[IncidentListItem]
    total: int
    page: int
    page_size: int


class SafetySummary(BaseModel):
    total: int
    open_count: int
    by_severity: Dict[str, int]
    by_status: Dict[str, int]
    by_type: Dict[str, int]
    days_since_last_incident: Optional[int] = None  # None if no incidents logged
