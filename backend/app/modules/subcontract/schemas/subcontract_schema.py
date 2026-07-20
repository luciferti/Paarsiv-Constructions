import uuid
from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, computed_field

from app.modules.subcontract.models.subcontract_model import (
    SubcontractorStatus,
    WorkOrderStatus,
)


# ---- Subcontractor ----

class SubcontractorBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    code: str = Field(..., min_length=1, max_length=50)
    trade: Optional[str] = Field(None, max_length=50)
    contact_name: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=30)
    notes: Optional[str] = None


class SubcontractorCreate(SubcontractorBase):
    status: SubcontractorStatus = SubcontractorStatus.ACTIVE


class SubcontractorUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    trade: Optional[str] = Field(None, max_length=50)
    contact_name: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=30)
    status: Optional[SubcontractorStatus] = None
    notes: Optional[str] = None


class SubcontractorOut(SubcontractorBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    org_id: uuid.UUID
    status: SubcontractorStatus
    created_at: datetime
    updated_at: datetime


class SubcontractorListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    code: str
    trade: Optional[str] = None
    status: SubcontractorStatus


class PaginatedSubcontractors(BaseModel):
    items: List[SubcontractorListItem]
    total: int
    page: int
    page_size: int


# ---- Work Order ----

class WorkOrderPaymentCreate(BaseModel):
    amount: float = Field(..., gt=0)
    payment_date: date
    notes: Optional[str] = None


class WorkOrderPaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    amount: float
    payment_date: date
    notes: Optional[str] = None


class WorkOrderCreate(BaseModel):
    wo_number: str = Field(..., min_length=1, max_length=50)
    site_id: uuid.UUID
    subcontractor_id: uuid.UUID
    title: str = Field(..., min_length=1, max_length=255)
    order_date: date
    wo_value: float = Field(..., ge=0)
    notes: Optional[str] = None


class WorkOrderUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    wo_value: Optional[float] = Field(None, ge=0)
    progress_percent: Optional[float] = Field(None, ge=0, le=100)
    status: Optional[WorkOrderStatus] = None
    notes: Optional[str] = None


class WorkOrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    org_id: uuid.UUID
    wo_number: str
    site_id: uuid.UUID
    subcontractor_id: uuid.UUID
    title: str
    order_date: date
    wo_value: float
    progress_percent: float
    status: WorkOrderStatus
    notes: Optional[str] = None
    payments: List[WorkOrderPaymentOut]
    created_at: datetime
    updated_at: datetime

    @computed_field
    @property
    def total_paid(self) -> float:
        return round(sum(float(p.amount) for p in self.payments), 2)

    @computed_field
    @property
    def balance(self) -> float:
        return round(float(self.wo_value) - self.total_paid, 2)


class WorkOrderListRow(BaseModel):
    id: uuid.UUID
    wo_number: str
    site_id: uuid.UUID
    subcontractor_id: uuid.UUID
    title: str
    wo_value: float
    total_paid: float
    balance: float
    progress_percent: float
    status: WorkOrderStatus


class PaginatedWorkOrders(BaseModel):
    items: List[WorkOrderListRow]
    total: int
    page: int
    page_size: int
