import enum
import uuid
from datetime import date
from typing import Optional

from sqlalchemy import Date, Enum, ForeignKey, Numeric, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.mixins import OrgScopedMixin, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class BillStatus(str, enum.Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    CERTIFIED = "certified"
    PAID = "paid"


class ClientBill(UUIDPrimaryKeyMixin, OrgScopedMixin, TimestampMixin, SoftDeleteMixin, Base):
    """A running-account (RA) bill raised to the client for work done on a site.

    Deductions (retention, TDS, other) are stored as entered; the net payable is
    derived, not stored, so a corrected percentage never leaves a stale total.
    """

    __tablename__ = "client_bills"
    __table_args__ = (UniqueConstraint("org_id", "bill_number", name="uq_client_bill_org_number"),)

    site_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("sites.id"), nullable=False, index=True
    )
    bill_number: Mapped[str] = mapped_column(String(50), nullable=False)
    bill_date: Mapped[date] = mapped_column(Date, nullable=False)
    gross_amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    retention_percent: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False, default=0)
    tds_percent: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False, default=0)
    other_deductions: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    status: Mapped[BillStatus] = mapped_column(
        Enum(BillStatus, name="bill_status", values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
        default=BillStatus.DRAFT,
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid(as_uuid=True), nullable=True)
