import uuid
from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.modules.labour.models.labour_model import AttendanceStatus, WorkerStatus


class WorkerBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    code: str = Field(..., min_length=1, max_length=50)
    phone: Optional[str] = Field(None, max_length=30)
    trade: Optional[str] = Field(None, max_length=50)
    default_wage_rate: float = Field(0, ge=0)
    notes: Optional[str] = None


class WorkerCreate(WorkerBase):
    status: WorkerStatus = WorkerStatus.ACTIVE


class WorkerUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    phone: Optional[str] = Field(None, max_length=30)
    trade: Optional[str] = Field(None, max_length=50)
    default_wage_rate: Optional[float] = Field(None, ge=0)
    status: Optional[WorkerStatus] = None
    notes: Optional[str] = None


class WorkerOut(WorkerBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    org_id: uuid.UUID
    status: WorkerStatus
    created_at: datetime
    updated_at: datetime


class WorkerListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    code: str
    trade: Optional[str] = None
    default_wage_rate: float
    status: WorkerStatus


class PaginatedWorkers(BaseModel):
    items: List[WorkerListItem]
    total: int
    page: int
    page_size: int


class AttendanceCreate(BaseModel):
    worker_id: uuid.UUID
    work_date: date
    status: AttendanceStatus
    overtime_hours: float = Field(0, ge=0)
    # Optional override; when omitted the worker's default_wage_rate is used.
    wage_rate: Optional[float] = Field(None, ge=0)
    notes: Optional[str] = None


class AttendanceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    site_id: uuid.UUID
    worker_id: uuid.UUID
    work_date: date
    status: AttendanceStatus
    overtime_hours: float
    wage_rate: float
    wage_amount: float
    notes: Optional[str] = None
    created_at: datetime


class SiteLabourSummaryItem(BaseModel):
    worker_id: uuid.UUID
    worker_name: str
    worker_code: str
    trade: Optional[str] = None
    days_present: float
    days_absent: int
    total_overtime_hours: float
    total_wages: float
