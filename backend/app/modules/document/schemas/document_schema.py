import uuid
from datetime import date, datetime
from typing import Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.modules.document.models.document_model import DocumentCategory


class DocumentBase(BaseModel):
    site_id: Optional[uuid.UUID] = None
    title: str = Field(..., min_length=1, max_length=255)
    category: DocumentCategory
    url: str = Field(..., min_length=1, max_length=1000)
    reference_no: Optional[str] = Field(None, max_length=100)
    issue_date: Optional[date] = None
    expiry_date: Optional[date] = None
    notes: Optional[str] = None


class DocumentCreate(DocumentBase):
    pass


class DocumentUpdate(BaseModel):
    site_id: Optional[uuid.UUID] = None
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    category: Optional[DocumentCategory] = None
    url: Optional[str] = Field(None, min_length=1, max_length=1000)
    reference_no: Optional[str] = Field(None, max_length=100)
    issue_date: Optional[date] = None
    expiry_date: Optional[date] = None
    notes: Optional[str] = None


class DocumentOut(DocumentBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    org_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class DocumentListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    site_id: Optional[uuid.UUID] = None
    title: str
    category: DocumentCategory
    url: str
    reference_no: Optional[str] = None
    expiry_date: Optional[date] = None


class PaginatedDocuments(BaseModel):
    items: List[DocumentListItem]
    total: int
    page: int
    page_size: int


class DocumentSummary(BaseModel):
    total: int
    by_category: Dict[str, int]
    expiring_soon: int  # expiry within the next 30 days (and not yet expired)
    expired: int
