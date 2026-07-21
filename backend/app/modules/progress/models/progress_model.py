import enum
import uuid
from datetime import date
from typing import Optional

from sqlalchemy import Date, Enum, ForeignKey, Integer, Numeric, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.mixins import OrgScopedMixin, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class MilestoneStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    DELAYED = "delayed"


class Milestone(UUIDPrimaryKeyMixin, OrgScopedMixin, TimestampMixin, SoftDeleteMixin, Base):
    """A schedule milestone for a site, with its own % completion."""

    __tablename__ = "milestones"

    site_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("sites.id"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    target_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    actual_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    progress_percent: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False, default=0)
    # Relative weight for the site's overall (weighted) progress. Defaults to 1.
    weight: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    status: Mapped[MilestoneStatus] = mapped_column(
        Enum(MilestoneStatus, name="milestone_status", values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
        default=MilestoneStatus.PENDING,
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid(as_uuid=True), nullable=True)
