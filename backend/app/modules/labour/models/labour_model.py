import enum
import uuid
from datetime import date
from typing import Optional

from sqlalchemy import Date, Enum, ForeignKey, Numeric, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.mixins import OrgScopedMixin, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class WorkerStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class AttendanceStatus(str, enum.Enum):
    PRESENT = "present"
    ABSENT = "absent"
    HALF_DAY = "half_day"


class Worker(UUIDPrimaryKeyMixin, OrgScopedMixin, TimestampMixin, SoftDeleteMixin, Base):
    """A labourer on the org's roster (mason, helper, carpenter, ...)."""

    __tablename__ = "workers"
    __table_args__ = (UniqueConstraint("org_id", "code", name="uq_workers_org_code"),)

    code: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    trade: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    default_wage_rate: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    status: Mapped[WorkerStatus] = mapped_column(
        Enum(WorkerStatus, name="worker_status", values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
        default=WorkerStatus.ACTIVE,
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid(as_uuid=True), nullable=True)


class AttendanceEntry(UUIDPrimaryKeyMixin, OrgScopedMixin, TimestampMixin, Base):
    """One day's muster-roll line for a worker at a site, with the wage payable."""

    __tablename__ = "attendance_entries"
    __table_args__ = (
        UniqueConstraint("worker_id", "work_date", name="uq_attendance_worker_date"),
    )

    site_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("sites.id"), nullable=False, index=True
    )
    worker_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("workers.id"), nullable=False, index=True
    )
    work_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    status: Mapped[AttendanceStatus] = mapped_column(
        Enum(
            AttendanceStatus,
            name="attendance_status",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
    )
    overtime_hours: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False, default=0)
    # Snapshot of the rate applied that day (defaults from the worker), so later
    # rate changes don't rewrite historical payroll.
    wage_rate: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    # Computed payable for the day (base by status + overtime). Stored so rollups
    # and payroll exports don't have to re-derive the formula.
    wage_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid(as_uuid=True), nullable=True)
