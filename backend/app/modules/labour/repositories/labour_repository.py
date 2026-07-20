import uuid
from datetime import date
from typing import List, Optional, Tuple

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.modules.labour.models.labour_model import (
    AttendanceEntry,
    AttendanceStatus,
    Worker,
    WorkerStatus,
)


class WorkerRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, worker: Worker) -> Worker:
        self.db.add(worker)
        self.db.flush()
        return worker

    def get_by_id(self, org_id: uuid.UUID, worker_id: uuid.UUID) -> Optional[Worker]:
        stmt = select(Worker).where(
            Worker.id == worker_id, Worker.org_id == org_id, Worker.is_deleted.is_(False)
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def get_by_code(self, org_id: uuid.UUID, code: str) -> Optional[Worker]:
        stmt = select(Worker).where(
            Worker.org_id == org_id, Worker.code == code, Worker.is_deleted.is_(False)
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def list(
        self,
        org_id: uuid.UUID,
        page: int,
        page_size: int,
        status: Optional[WorkerStatus] = None,
    ) -> Tuple[List[Worker], int]:
        conditions = [Worker.org_id == org_id, Worker.is_deleted.is_(False)]
        if status is not None:
            conditions.append(Worker.status == status)

        count_stmt = select(func.count()).select_from(Worker).where(*conditions)
        total = self.db.execute(count_stmt).scalar_one()

        stmt = (
            select(Worker)
            .where(*conditions)
            .order_by(Worker.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        items = list(self.db.execute(stmt).scalars().all())
        return items, total

    def soft_delete(self, worker: Worker) -> None:
        worker.is_deleted = True
        self.db.flush()


class AttendanceRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, entry: AttendanceEntry) -> AttendanceEntry:
        self.db.add(entry)
        self.db.flush()
        return entry

    def get_for_worker_date(
        self, org_id: uuid.UUID, worker_id: uuid.UUID, work_date: date
    ) -> Optional[AttendanceEntry]:
        stmt = select(AttendanceEntry).where(
            AttendanceEntry.org_id == org_id,
            AttendanceEntry.worker_id == worker_id,
            AttendanceEntry.work_date == work_date,
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def list_for_site(
        self, org_id: uuid.UUID, site_id: uuid.UUID, work_date: Optional[date] = None
    ) -> List[AttendanceEntry]:
        conditions = [AttendanceEntry.org_id == org_id, AttendanceEntry.site_id == site_id]
        if work_date is not None:
            conditions.append(AttendanceEntry.work_date == work_date)
        stmt = (
            select(AttendanceEntry)
            .where(*conditions)
            .order_by(AttendanceEntry.work_date.desc(), AttendanceEntry.created_at.desc())
        )
        return list(self.db.execute(stmt).scalars().all())

    def wage_summary_for_site(
        self,
        org_id: uuid.UUID,
        site_id: uuid.UUID,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> List[dict]:
        present = func.sum(
            case(
                (AttendanceEntry.status == AttendanceStatus.PRESENT, 1.0),
                (AttendanceEntry.status == AttendanceStatus.HALF_DAY, 0.5),
                else_=0.0,
            )
        ).label("days_present")
        absent = func.sum(
            case((AttendanceEntry.status == AttendanceStatus.ABSENT, 1), else_=0)
        ).label("days_absent")
        overtime = func.coalesce(func.sum(AttendanceEntry.overtime_hours), 0).label(
            "total_overtime_hours"
        )
        wages = func.coalesce(func.sum(AttendanceEntry.wage_amount), 0).label("total_wages")

        conditions = [AttendanceEntry.org_id == org_id, AttendanceEntry.site_id == site_id]
        if date_from is not None:
            conditions.append(AttendanceEntry.work_date >= date_from)
        if date_to is not None:
            conditions.append(AttendanceEntry.work_date <= date_to)

        stmt = (
            select(
                Worker.id.label("worker_id"),
                Worker.name.label("worker_name"),
                Worker.code.label("worker_code"),
                Worker.trade.label("trade"),
                present,
                absent,
                overtime,
                wages,
            )
            .join(AttendanceEntry, AttendanceEntry.worker_id == Worker.id)
            .where(*conditions)
            .group_by(Worker.id, Worker.name, Worker.code, Worker.trade)
            .order_by(Worker.name)
        )
        rows = self.db.execute(stmt).mappings().all()
        return [dict(row) for row in rows]
