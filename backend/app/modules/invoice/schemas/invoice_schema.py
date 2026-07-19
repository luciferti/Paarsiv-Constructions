import uuid
from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.modules.invoice.models.invoice_model import InvoiceStatus


class InvoiceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    org_id: uuid.UUID
    vendor_id: uuid.UUID
    site_id: Optional[uuid.UUID] = None
    file_path: str
    original_filename: str
    invoice_number: Optional[str] = None
    invoice_date: Optional[date] = None
    amount: Optional[float] = None
    status: InvoiceStatus
    raw_ocr_text: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class PaginatedInvoices(BaseModel):
    items: List[InvoiceOut]
    total: int
    page: int
    page_size: int


class InvoiceReviewUpdate(BaseModel):
    invoice_number: Optional[str] = Field(None, max_length=100)
    invoice_date: Optional[date] = None
    amount: Optional[float] = Field(None, ge=0)
    status: Optional[InvoiceStatus] = None
