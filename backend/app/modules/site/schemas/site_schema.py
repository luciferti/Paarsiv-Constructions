import uuid
from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.modules.site.models.site_model import SiteStatus


class SiteBase(BaseModel):
    project_id: Optional[uuid.UUID] = None
    name: str = Field(..., min_length=1, max_length=255)
    code: str = Field(..., min_length=1, max_length=50)
    address_line: Optional[str] = Field(None, max_length=255)
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    country: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    site_type: Optional[str] = Field(None, max_length=50)
    start_date: Optional[date] = None
    expected_end_date: Optional[date] = None
    site_manager_id: Optional[uuid.UUID] = None


class SiteCreate(SiteBase):
    status: SiteStatus = SiteStatus.PLANNING


class SiteUpdate(BaseModel):
    project_id: Optional[uuid.UUID] = None
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    address_line: Optional[str] = Field(None, max_length=255)
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    country: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    site_type: Optional[str] = Field(None, max_length=50)
    status: Optional[SiteStatus] = None
    start_date: Optional[date] = None
    expected_end_date: Optional[date] = None
    actual_end_date: Optional[date] = None
    site_manager_id: Optional[uuid.UUID] = None


class SiteOut(SiteBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    org_id: uuid.UUID
    status: SiteStatus
    actual_end_date: Optional[date] = None
    created_at: datetime
    updated_at: datetime


class SiteListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    code: str
    status: SiteStatus
    project_id: Optional[uuid.UUID] = None
    city: Optional[str] = None
    state: Optional[str] = None


class PaginatedSites(BaseModel):
    items: List[SiteListItem]
    total: int
    page: int
    page_size: int


class SiteTeamMemberCreate(BaseModel):
    employee_id: uuid.UUID
    role_on_site: str = Field(..., min_length=1, max_length=50)


class SiteTeamMemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    site_id: uuid.UUID
    employee_id: uuid.UUID
    role_on_site: str
    assigned_at: date
