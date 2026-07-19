import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.mixins import OrgScopedMixin, TimestampMixin, UUIDPrimaryKeyMixin


class SiteAISummary(UUIDPrimaryKeyMixin, OrgScopedMixin, TimestampMixin, Base):
    """Latest AI-generated digest for a site — one row per site, replaced
    each time the summary is (re)generated."""

    __tablename__ = "site_ai_summaries"
    __table_args__ = (UniqueConstraint("site_id", name="uq_site_ai_summaries_site"),)

    site_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("sites.id"), nullable=False, index=True
    )
    summary_text: Mapped[str] = mapped_column(Text, nullable=False)
    source_report_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    model_used: Mapped[str] = mapped_column(String(50), nullable=False)
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid(as_uuid=True), nullable=True)
