import uuid
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class DailyReportBase(BaseModel):
    report_date: date
    manpower_count: Optional[int] = Field(None, ge=0)
    weather: Optional[str] = Field(None, max_length=100)
    work_summary: str = Field(..., min_length=1)
    issues: Optional[str] = None


class DailyReportCreate(DailyReportBase):
    pass


class DailyReportUpdate(BaseModel):
    manpower_count: Optional[int] = Field(None, ge=0)
    weather: Optional[str] = Field(None, max_length=100)
    work_summary: Optional[str] = Field(None, min_length=1)
    issues: Optional[str] = None


class DailyReportOut(DailyReportBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    site_id: uuid.UUID
    org_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
