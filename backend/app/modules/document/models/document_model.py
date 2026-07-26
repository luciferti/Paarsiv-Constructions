import enum
import uuid
from datetime import date
from typing import Optional

from sqlalchemy import Date, Enum, ForeignKey, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.mixins import OrgScopedMixin, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class DocumentCategory(str, enum.Enum):
    CONTRACT = "contract"
    PERMIT = "permit"
    DRAWING = "drawing"
    LICENSE = "license"
    RA_BILL = "ra_bill"
    SAFETY = "safety"
    COMPLIANCE = "compliance"
    OTHER = "other"


class Document(UUIDPrimaryKeyMixin, OrgScopedMixin, TimestampMixin, SoftDeleteMixin, Base):
    """A document register entry — metadata + an external link to the file
    (Drive/SharePoint/S3). Optional site; optional expiry for permits/licenses."""

    __tablename__ = "documents"

    site_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("sites.id"), nullable=True, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[DocumentCategory] = mapped_column(
        Enum(DocumentCategory, name="document_category", values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
    )
    url: Mapped[str] = mapped_column(String(1000), nullable=False)
    reference_no: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    issue_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    expiry_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True, index=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid(as_uuid=True), nullable=True)
