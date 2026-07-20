import uuid
from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, computed_field

from app.modules.purchase.models.po_model import POStatus


class POLineCreate(BaseModel):
    material_id: Optional[uuid.UUID] = None
    description: str = Field(..., min_length=1, max_length=255)
    quantity: float = Field(..., gt=0)
    unit: Optional[str] = Field(None, max_length=20)
    unit_price: float = Field(..., ge=0)


class POLineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    material_id: Optional[uuid.UUID] = None
    description: str
    quantity: float
    unit: Optional[str] = None
    unit_price: float

    @computed_field
    @property
    def line_total(self) -> float:
        return round(float(self.quantity) * float(self.unit_price), 2)


class PurchaseOrderCreate(BaseModel):
    po_number: str = Field(..., min_length=1, max_length=50)
    vendor_id: uuid.UUID
    site_id: Optional[uuid.UUID] = None
    order_date: date
    expected_date: Optional[date] = None
    notes: Optional[str] = None
    lines: List[POLineCreate] = Field(..., min_length=1)


class PurchaseOrderUpdate(BaseModel):
    status: Optional[POStatus] = None
    site_id: Optional[uuid.UUID] = None
    expected_date: Optional[date] = None
    notes: Optional[str] = None


class PurchaseOrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    org_id: uuid.UUID
    po_number: str
    vendor_id: uuid.UUID
    site_id: Optional[uuid.UUID] = None
    status: POStatus
    order_date: date
    expected_date: Optional[date] = None
    notes: Optional[str] = None
    lines: List[POLineOut]
    created_at: datetime
    updated_at: datetime

    @computed_field
    @property
    def total_amount(self) -> float:
        return round(sum(line.line_total for line in self.lines), 2)


class PurchaseOrderListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    po_number: str
    vendor_id: uuid.UUID
    site_id: Optional[uuid.UUID] = None
    status: POStatus
    order_date: date
    total_amount: float


class PaginatedPurchaseOrders(BaseModel):
    items: List[PurchaseOrderListItem]
    total: int
    page: int
    page_size: int
