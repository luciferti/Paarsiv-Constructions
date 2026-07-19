import uuid
from datetime import date
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.report.models.report_model import DailyReport


class ReportRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, report: DailyReport) -> DailyReport:
        self.db.add(report)
        self.db.flush()
        return report

    def get_by_id(self, org_id: uuid.UUID, report_id: uuid.UUID) -> Optional[DailyReport]:
        stmt = select(DailyReport).where(
            DailyReport.id == report_id, DailyReport.org_id == org_id
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def get_by_site_and_date(
        self, org_id: uuid.UUID, site_id: uuid.UUID, report_date: date
    ) -> Optional[DailyReport]:
        stmt = select(DailyReport).where(
            DailyReport.org_id == org_id,
            DailyReport.site_id == site_id,
            DailyReport.report_date == report_date,
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def list_for_site(self, org_id: uuid.UUID, site_id: uuid.UUID) -> List[DailyReport]:
        stmt = (
            select(DailyReport)
            .where(DailyReport.org_id == org_id, DailyReport.site_id == site_id)
            .order_by(DailyReport.report_date.desc())
        )
        return list(self.db.execute(stmt).scalars().all())
