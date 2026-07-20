import enum
import uuid
from datetime import date
from typing import List, Optional

from sqlalchemy import Date, Enum, ForeignKey, Numeric, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.mixins import OrgScopedMixin, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class POStatus(str, enum.Enum):
    DRAFT = "draft"
    SENT = "sent"
    PARTIALLY_RECEIVED = "partially_received"
    RECEIVED = "received"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class PurchaseOrder(UUIDPrimaryKeyMixin, OrgScopedMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "purchase_orders"
    __table_args__ = (UniqueConstraint("org_id", "po_number", name="uq_po_org_number"),)

    po_number: Mapped[str] = mapped_column(String(50), nullable=False)
    vendor_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("vendors.id"), nullable=False, index=True
    )
    site_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("sites.id"), nullable=True, index=True
    )
    status: Mapped[POStatus] = mapped_column(
        Enum(POStatus, name="po_status", values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
        default=POStatus.DRAFT,
    )
    order_date: Mapped[date] = mapped_column(Date, nullable=False)
    expected_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid(as_uuid=True), nullable=True)

    lines: Mapped[List["PurchaseOrderLine"]] = relationship(
        back_populates="purchase_order",
        cascade="all, delete-orphan",
        order_by="PurchaseOrderLine.created_at",
    )


class PurchaseOrderLine(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "purchase_order_lines"

    po_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("purchase_orders.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    material_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("materials.id"), nullable=True
    )
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    unit: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    purchase_order: Mapped["PurchaseOrder"] = relationship(back_populates="lines")
