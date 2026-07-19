import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.modules.site.exceptions import SiteNotFoundError
from app.modules.summary.exceptions import SummaryNotFoundError
from app.modules.summary.models.summary_model import SiteAISummary
from app.modules.summary.repositories.summary_repository import SummaryRepository
from app.modules.summary.services.summary_provider import SummaryProvider, get_summary_provider


class SummaryService:
    def __init__(self, db: Session, provider: Optional[SummaryProvider] = None):
        self.db = db
        self.repo = SummaryRepository(db)
        self.provider = provider or get_summary_provider()

    def generate_summary(
        self, org_id: uuid.UUID, site_id: uuid.UUID, created_by: uuid.UUID
    ) -> SiteAISummary:
        site_name = self.repo.get_site_name(org_id, site_id)
        if site_name is None:
            raise SiteNotFoundError(site_id)

        reports = self.repo.recent_reports_for_site(org_id, site_id)
        summary_text = self.provider.summarize(site_name, reports)

        new_summary = SiteAISummary(
            org_id=org_id,
            site_id=site_id,
            summary_text=summary_text,
            source_report_count=len(reports),
            model_used=self.provider.model_name,
            generated_at=datetime.now(timezone.utc),
            created_by=created_by,
        )
        existing = self.repo.get_by_site(org_id, site_id)
        summary = self.repo.upsert(existing, new_summary)
        self.db.commit()
        self.db.refresh(summary)
        return summary

    def get_summary(self, org_id: uuid.UUID, site_id: uuid.UUID) -> SiteAISummary:
        summary = self.repo.get_by_site(org_id, site_id)
        if summary is None:
            raise SummaryNotFoundError(site_id)
        return summary
