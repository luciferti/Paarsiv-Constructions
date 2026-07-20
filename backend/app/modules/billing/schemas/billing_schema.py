import uuid
from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, computed_field


def _round2(x: float) -> float:
    return round(float(x), 2)


class ClientBillBase(BaseModel):
    site_id: uuid.UUID
    bill_number: str = Field(..., min_length=1, max_length=50)
    bill_date: date
    gross_amount: float = Field(..., ge=0)
    retention_percent: float = Field(0, ge=0, le=100)
    tds_percent: float = Field(0, ge=0, le=100)
    other_deductions: float = Field(0, ge=0)
    notes: Optional[str] = None


class ClientBillCreate(ClientBillBase):
    pass


class ClientBillUpdate(BaseModel):
    status: Optional[str] = None
    bill_date: Optional[date] = None
    gross_amount: Optional[float] = Field(None, ge=0)
    retention_percent: Optional[float] = Field(None, ge=0, le=100)
    tds_percent: Optional[float] = Field(None, ge=0, le=100)
    other_deductions: Optional[float] = Field(None, ge=0)
    notes: Optional[str] = None


class ClientBillOut(ClientBillBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    org_id: uuid.UUID
    status: str
    created_at: datetime
    updated_at: datetime

    @computed_field
    @property
    def retention_amount(self) -> float:
        return _round2(self.gross_amount * self.retention_percent / 100)

    @computed_field
    @property
    def tds_amount(self) -> float:
        return _round2(self.gross_amount * self.tds_percent / 100)

    @computed_field
    @property
    def net_payable(self) -> float:
        return _round2(
            self.gross_amount - self.retention_amount - self.tds_amount - self.other_deductions
        )


class ClientBillListRow(BaseModel):
    id: uuid.UUID
    site_id: uuid.UUID
    bill_number: str
    bill_date: date
    gross_amount: float
    net_payable: float
    status: str


class PaginatedClientBills(BaseModel):
    items: List[ClientBillListRow]
    total: int
    page: int
    page_size: int


class ClientBillingSummary(BaseModel):
    total_gross: float
    total_net: float
    total_paid: float        # net_payable of PAID bills
    total_outstanding: float  # net_payable of non-paid, non-draft bills
    bill_count: int
