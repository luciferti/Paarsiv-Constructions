import uuid
from datetime import date
from typing import Optional

from sqlalchemy import Date, ForeignKey, Integer, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.mixins import OrgScopedMixin, TimestampMixin, UUIDPrimaryKeyMixin


class DailyReport(UUIDPrimaryKeyMixin, OrgScopedMixin, TimestampMixin, Base):
    __tablename__ = "daily_reports"
    __table_args__ = (UniqueConstraint("site_id", "report_date", name="uq_daily_reports_site_date"),)

    site_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("sites.id"), nullable=False, index=True
    )
    report_date: Mapped[date] = mapped_column(Date, nullable=False)
    manpower_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    weather: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    work_summary: Mapped[str] = mapped_column(Text, nullable=False)
    issues: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid(as_uuid=True), nullable=True)
