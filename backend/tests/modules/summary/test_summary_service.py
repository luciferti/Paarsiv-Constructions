import uuid
from datetime import date

import pytest

from app.modules.report.schemas.report_schema import DailyReportCreate
from app.modules.report.services.report_service import ReportService
from app.modules.site.exceptions import SiteNotFoundError
from app.modules.site.schemas.site_schema import SiteCreate
from app.modules.site.services.site_service import SiteService
from app.modules.summary.exceptions import SummaryNotFoundError
from app.modules.summary.services.summary_service import SummaryService


class FakeProvider:
    model_name = "fake-model"

    def summarize(self, site_name, reports):
        return f"Fake summary for {site_name} covering {len(reports)} report(s)."


class TestGenerateSummary:
    def test_raises_when_site_missing(self, db, org_id, user_id):
        service = SummaryService(db, provider=FakeProvider())
        with pytest.raises(SiteNotFoundError):
            service.generate_summary(org_id, uuid.uuid4(), user_id)

    def test_generates_and_persists_summary(self, db, org_id, user_id):
        site = SiteService(db).create_site(
            org_id, user_id, SiteCreate(name="Riverside Tower", code="RVT-01")
        )
        ReportService(db).create_report(
            org_id,
            site.id,
            user_id,
            DailyReportCreate(report_date=date.today(), work_summary="Poured slab"),
        )

        service = SummaryService(db, provider=FakeProvider())
        summary = service.generate_summary(org_id, site.id, user_id)

        assert "Riverside Tower" in summary.summary_text
        assert summary.source_report_count == 1
        assert summary.model_used == "fake-model"

    def test_regenerating_replaces_previous_summary(self, db, org_id, user_id):
        site = SiteService(db).create_site(
            org_id, user_id, SiteCreate(name="Riverside Tower", code="RVT-01")
        )
        service = SummaryService(db, provider=FakeProvider())

        first = service.generate_summary(org_id, site.id, user_id)
        second = service.generate_summary(org_id, site.id, user_id)

        assert first.id == second.id


class TestGetSummary:
    def test_raises_when_not_yet_generated(self, db, org_id, user_id):
        site = SiteService(db).create_site(
            org_id, user_id, SiteCreate(name="Riverside Tower", code="RVT-01")
        )
        service = SummaryService(db, provider=FakeProvider())

        with pytest.raises(SummaryNotFoundError):
            service.get_summary(org_id, site.id)
