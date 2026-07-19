import uuid
from datetime import date, timedelta
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.report.models.report_model import DailyReport
from app.modules.site.models.site_model import Site
from app.modules.summary.models.summary_model import SiteAISummary


class SummaryRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_site(self, org_id: uuid.UUID, site_id: uuid.UUID) -> Optional[SiteAISummary]:
        stmt = select(SiteAISummary).where(
            SiteAISummary.org_id == org_id, SiteAISummary.site_id == site_id
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def upsert(self, existing: Optional[SiteAISummary], new: SiteAISummary) -> SiteAISummary:
        if existing is None:
            self.db.add(new)
            self.db.flush()
            return new

        existing.summary_text = new.summary_text
        existing.source_report_count = new.source_report_count
        existing.model_used = new.model_used
        existing.generated_at = new.generated_at
        existing.created_by = new.created_by
        self.db.flush()
        return existing

    def get_site_name(self, org_id: uuid.UUID, site_id: uuid.UUID) -> Optional[str]:
        stmt = select(Site.name).where(Site.id == site_id, Site.org_id == org_id)
        return self.db.execute(stmt).scalar_one_or_none()

    def recent_reports_for_site(
        self, org_id: uuid.UUID, site_id: uuid.UUID, days: int = 7
    ) -> List[DailyReport]:
        since = date.today() - timedelta(days=days)
        stmt = (
            select(DailyReport)
            .where(
                DailyReport.org_id == org_id,
                DailyReport.site_id == site_id,
                DailyReport.report_date >= since,
            )
            .order_by(DailyReport.report_date.desc())
        )
        return list(self.db.execute(stmt).scalars().all())
