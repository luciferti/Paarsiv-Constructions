import uuid
from datetime import date, timedelta

import pytest

from app.modules.report.exceptions import DailyReportNotFoundError, DuplicateDailyReportError
from app.modules.report.schemas.report_schema import DailyReportCreate, DailyReportUpdate
from app.modules.report.services.report_service import ReportService


def make_report_payload(**overrides) -> DailyReportCreate:
    data = {"report_date": date.today(), "work_summary": "Poured foundation slab."}
    data.update(overrides)
    return DailyReportCreate(**data)


class TestCreateReport:
    def test_creates_report(self, db, org_id, user_id):
        service = ReportService(db)
        site_id = uuid.uuid4()

        report = service.create_report(org_id, site_id, user_id, make_report_payload())

        assert report.id is not None
        assert report.work_summary == "Poured foundation slab."

    def test_rejects_duplicate_report_for_same_site_and_date(self, db, org_id, user_id):
        service = ReportService(db)
        site_id = uuid.uuid4()
        service.create_report(org_id, site_id, user_id, make_report_payload())

        with pytest.raises(DuplicateDailyReportError):
            service.create_report(org_id, site_id, user_id, make_report_payload())

    def test_allows_same_date_for_different_sites(self, db, org_id, user_id):
        service = ReportService(db)
        service.create_report(org_id, uuid.uuid4(), user_id, make_report_payload())
        service.create_report(org_id, uuid.uuid4(), user_id, make_report_payload())


class TestListReports:
    def test_orders_by_date_descending(self, db, org_id, user_id):
        service = ReportService(db)
        site_id = uuid.uuid4()
        service.create_report(
            org_id, site_id, user_id, make_report_payload(report_date=date.today() - timedelta(days=1))
        )
        service.create_report(org_id, site_id, user_id, make_report_payload(report_date=date.today()))

        reports = service.list_reports(org_id, site_id)

        assert len(reports) == 2
        assert reports[0].report_date == date.today()


class TestUpdateReport:
    def test_updates_only_provided_fields(self, db, org_id, user_id):
        service = ReportService(db)
        report = service.create_report(org_id, uuid.uuid4(), user_id, make_report_payload())

        updated = service.update_report(org_id, report.id, DailyReportUpdate(manpower_count=12))

        assert updated.manpower_count == 12
        assert updated.work_summary == "Poured foundation slab."


class TestGetReport:
    def test_raises_when_not_found(self, db, org_id):
        service = ReportService(db)
        with pytest.raises(DailyReportNotFoundError):
            service.get_report(org_id, uuid.uuid4())
