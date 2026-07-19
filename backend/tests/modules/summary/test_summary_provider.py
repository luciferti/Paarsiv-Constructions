import uuid
from datetime import date, timedelta

from app.modules.report.models.report_model import DailyReport
from app.modules.summary.services.summary_provider import RuleBasedSummaryProvider


def make_report(**overrides) -> DailyReport:
    defaults = dict(
        id=uuid.uuid4(),
        org_id=uuid.uuid4(),
        site_id=uuid.uuid4(),
        report_date=date.today(),
        manpower_count=10,
        weather="Sunny",
        work_summary="Poured slab.",
        issues=None,
    )
    defaults.update(overrides)
    return DailyReport(**defaults)


class TestRuleBasedSummaryProvider:
    def test_returns_placeholder_when_no_reports(self):
        provider = RuleBasedSummaryProvider()

        summary = provider.summarize("Riverside Tower", [])

        assert "No daily reports" in summary

    def test_summarizes_manpower_and_weather(self):
        provider = RuleBasedSummaryProvider()
        reports = [
            make_report(report_date=date.today() - timedelta(days=1), manpower_count=8, weather="Sunny"),
            make_report(report_date=date.today(), manpower_count=12, weather="Sunny"),
        ]

        summary = provider.summarize("Riverside Tower", reports)

        assert "Riverside Tower" in summary
        assert "10 workers/day" in summary
        assert "Sunny" in summary

    def test_surfaces_issues(self):
        provider = RuleBasedSummaryProvider()
        reports = [make_report(issues="Cement delivery delayed")]

        summary = provider.summarize("Riverside Tower", reports)

        assert "Cement delivery delayed" in summary
        assert "1 day(s) reported issues" in summary
