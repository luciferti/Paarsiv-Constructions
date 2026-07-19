import uuid
from typing import List

from sqlalchemy.orm import Session

from app.modules.report.exceptions import DailyReportNotFoundError, DuplicateDailyReportError
from app.modules.report.models.report_model import DailyReport
from app.modules.report.repositories.report_repository import ReportRepository
from app.modules.report.schemas.report_schema import DailyReportCreate, DailyReportUpdate


class ReportService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = ReportRepository(db)

    def create_report(
        self,
        org_id: uuid.UUID,
        site_id: uuid.UUID,
        created_by: uuid.UUID,
        payload: DailyReportCreate,
    ) -> DailyReport:
        if self.repo.get_by_site_and_date(org_id, site_id, payload.report_date) is not None:
            raise DuplicateDailyReportError(site_id, payload.report_date)

        report = DailyReport(
            org_id=org_id, site_id=site_id, created_by=created_by, **payload.model_dump()
        )
        report = self.repo.create(report)
        self.db.commit()
        self.db.refresh(report)
        return report

    def get_report(self, org_id: uuid.UUID, report_id: uuid.UUID) -> DailyReport:
        report = self.repo.get_by_id(org_id, report_id)
        if report is None:
            raise DailyReportNotFoundError(report_id)
        return report

    def list_reports(self, org_id: uuid.UUID, site_id: uuid.UUID) -> List[DailyReport]:
        return self.repo.list_for_site(org_id, site_id)

    def update_report(
        self, org_id: uuid.UUID, report_id: uuid.UUID, payload: DailyReportUpdate
    ) -> DailyReport:
        report = self.get_report(org_id, report_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(report, field, value)
        self.db.commit()
        self.db.refresh(report)
        return report
