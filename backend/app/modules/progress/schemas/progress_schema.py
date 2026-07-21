import uuid
from datetime import date, datetime
from typing import Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.modules.progress.models.progress_model import MilestoneStatus


class MilestoneCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    target_date: Optional[date] = None
    progress_percent: float = Field(0, ge=0, le=100)
    weight: int = Field(1, ge=1)
    status: MilestoneStatus = MilestoneStatus.PENDING
    notes: Optional[str] = None


class MilestoneUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    target_date: Optional[date] = None
    actual_date: Optional[date] = None
    progress_percent: Optional[float] = Field(None, ge=0, le=100)
    weight: Optional[int] = Field(None, ge=1)
    status: Optional[MilestoneStatus] = None
    notes: Optional[str] = None


class MilestoneOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    site_id: uuid.UUID
    title: str
    target_date: Optional[date] = None
    actual_date: Optional[date] = None
    progress_percent: float
    weight: int
    status: MilestoneStatus
    notes: Optional[str] = None
    created_at: datetime


class SiteProgressSummary(BaseModel):
    site_id: uuid.UUID
    overall_percent: float  # weighted average of milestone progress
    milestone_count: int
    by_status: Dict[str, int]
    milestones: List[MilestoneOut]
