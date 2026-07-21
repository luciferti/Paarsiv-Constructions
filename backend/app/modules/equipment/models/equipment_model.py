import enum
import uuid
from datetime import date
from typing import Optional

from sqlalchemy import Date, Enum, ForeignKey, Numeric, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.mixins import OrgScopedMixin, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class EquipmentOwnership(str, enum.Enum):
    OWNED = "owned"
    RENTED = "rented"


class EquipmentStatus(str, enum.Enum):
    AVAILABLE = "available"
    IN_USE = "in_use"
    MAINTENANCE = "maintenance"
    RETIRED = "retired"


class Equipment(UUIDPrimaryKeyMixin, OrgScopedMixin, TimestampMixin, SoftDeleteMixin, Base):
    """A piece of plant/machinery on the org's register (owned or rented)."""

    __tablename__ = "equipment"
    __table_args__ = (UniqueConstraint("org_id", "code", name="uq_equipment_org_code"),)

    code: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    ownership: Mapped[EquipmentOwnership] = mapped_column(
        Enum(EquipmentOwnership, name="equipment_ownership", values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
        default=EquipmentOwnership.OWNED,
    )
    status: Mapped[EquipmentStatus] = mapped_column(
        Enum(EquipmentStatus, name="equipment_status", values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
        default=EquipmentStatus.AVAILABLE,
    )
    # Reference rate (per day/hour) — used to prefill usage cost; entered cost wins.
    rental_rate: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid(as_uuid=True), nullable=True)


class EquipmentUsage(UUIDPrimaryKeyMixin, OrgScopedMixin, TimestampMixin, Base):
    """A deployment of a machine to a site for some hours/days, with the cost."""

    __tablename__ = "equipment_usage"

    equipment_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("equipment.id"), nullable=False, index=True
    )
    site_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("sites.id"), nullable=False, index=True
    )
    usage_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    quantity: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)  # hours or days
    cost: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid(as_uuid=True), nullable=True)


class MaintenanceLog(UUIDPrimaryKeyMixin, OrgScopedMixin, TimestampMixin, Base):
    """A service/repair record against a machine."""

    __tablename__ = "equipment_maintenance"

    equipment_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("equipment.id"), nullable=False, index=True
    )
    service_date: Mapped[date] = mapped_column(Date, nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    cost: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid(as_uuid=True), nullable=True)
