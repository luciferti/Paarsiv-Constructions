import enum
import uuid
from datetime import date
from typing import List, Optional

from sqlalchemy import Date, Enum, ForeignKey, Numeric, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.mixins import OrgScopedMixin, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class SubcontractorStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class WorkOrderStatus(str, enum.Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class Subcontractor(UUIDPrimaryKeyMixin, OrgScopedMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "subcontractors"
    __table_args__ = (UniqueConstraint("org_id", "code", name="uq_subcontractor_org_code"),)

    code: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    trade: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    contact_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    status: Mapped[SubcontractorStatus] = mapped_column(
        Enum(SubcontractorStatus, name="subcontractor_status", values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
        default=SubcontractorStatus.ACTIVE,
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid(as_uuid=True), nullable=True)


class WorkOrder(UUIDPrimaryKeyMixin, OrgScopedMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "work_orders"
    __table_args__ = (UniqueConstraint("org_id", "wo_number", name="uq_work_order_org_number"),)

    wo_number: Mapped[str] = mapped_column(String(50), nullable=False)
    site_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("sites.id"), nullable=False, index=True
    )
    subcontractor_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("subcontractors.id"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    order_date: Mapped[date] = mapped_column(Date, nullable=False)
    wo_value: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    progress_percent: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False, default=0)
    status: Mapped[WorkOrderStatus] = mapped_column(
        Enum(WorkOrderStatus, name="wo_status", values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
        default=WorkOrderStatus.OPEN,
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid(as_uuid=True), nullable=True)

    payments: Mapped[List["WorkOrderPayment"]] = relationship(
        back_populates="work_order",
        cascade="all, delete-orphan",
        order_by="WorkOrderPayment.payment_date",
    )


class WorkOrderPayment(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "work_order_payments"

    wo_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("work_orders.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    payment_date: Mapped[date] = mapped_column(Date, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    work_order: Mapped["WorkOrder"] = relationship(back_populates="payments")
