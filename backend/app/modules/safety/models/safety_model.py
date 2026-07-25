import enum
import uuid
from datetime import date
from typing import Optional

from sqlalchemy import Date, Enum, ForeignKey, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.mixins import OrgScopedMixin, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class IncidentType(str, enum.Enum):
    NEAR_MISS = "near_miss"
    FIRST_AID = "first_aid"
    INJURY = "injury"
    PROPERTY_DAMAGE = "property_damage"
    ENVIRONMENTAL = "environmental"
    OTHER = "other"


class IncidentSeverity(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class IncidentStatus(str, enum.Enum):
    OPEN = "open"
    INVESTIGATING = "investigating"
    CLOSED = "closed"


class Incident(UUIDPrimaryKeyMixin, OrgScopedMixin, TimestampMixin, SoftDeleteMixin, Base):
    """A safety incident / near-miss logged against a site."""

    __tablename__ = "incidents"

    site_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("sites.id"), nullable=False, index=True
    )
    incident_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    incident_type: Mapped[IncidentType] = mapped_column(
        Enum(IncidentType, name="incident_type", values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
    )
    severity: Mapped[IncidentSeverity] = mapped_column(
        Enum(IncidentSeverity, name="incident_severity", values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
    )
    status: Mapped[IncidentStatus] = mapped_column(
        Enum(IncidentStatus, name="incident_status", values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
        default=IncidentStatus.OPEN,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    action_taken: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reported_by: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid(as_uuid=True), nullable=True)
