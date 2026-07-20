import uuid
from datetime import date
from decimal import Decimal
from typing import List, Optional

from sqlalchemy.orm import Session

from app.modules.labour.exceptions import (
    DuplicateAttendanceError,
    DuplicateWorkerCodeError,
    WorkerNotFoundError,
)
from app.modules.labour.models.labour_model import (
    AttendanceEntry,
    AttendanceStatus,
    Worker,
    WorkerStatus,
)
from app.modules.labour.repositories.labour_repository import (
    AttendanceRepository,
    WorkerRepository,
)
from app.modules.labour.schemas.labour_schema import (
    AttendanceCreate,
    PaginatedWorkers,
    SiteLabourSummaryItem,
    WorkerCreate,
    WorkerUpdate,
)

# Standard working day used to price overtime at the normal hourly-equivalent rate.
_STANDARD_DAY_HOURS = Decimal("8")


def compute_wage_amount(
    status: AttendanceStatus, wage_rate: Decimal, overtime_hours: Decimal
) -> Decimal:
    """Payable for one day: base by attendance status plus overtime at the
    hourly-equivalent of the day rate. Present = full day, half-day = 50%,
    absent = 0 (overtime still paid if logged, e.g. a call-in)."""
    if status == AttendanceStatus.PRESENT:
        base = wage_rate
    elif status == AttendanceStatus.HALF_DAY:
        base = wage_rate / 2
    else:  # ABSENT
        base = Decimal("0")
    overtime_pay = (wage_rate / _STANDARD_DAY_HOURS) * overtime_hours
    return (base + overtime_pay).quantize(Decimal("0.01"))


class WorkerService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = WorkerRepository(db)

    def create_worker(
        self, org_id: uuid.UUID, created_by: uuid.UUID, payload: WorkerCreate
    ) -> Worker:
        if self.repo.get_by_code(org_id, payload.code) is not None:
            raise DuplicateWorkerCodeError(payload.code)
        worker = Worker(org_id=org_id, created_by=created_by, **payload.model_dump())
        worker = self.repo.create(worker)
        self.db.commit()
        self.db.refresh(worker)
        return worker

    def get_worker(self, org_id: uuid.UUID, worker_id: uuid.UUID) -> Worker:
        worker = self.repo.get_by_id(org_id, worker_id)
        if worker is None:
            raise WorkerNotFoundError(worker_id)
        return worker

    def list_workers(
        self,
        org_id: uuid.UUID,
        page: int = 1,
        page_size: int = 20,
        status: Optional[WorkerStatus] = None,
    ) -> PaginatedWorkers:
        items, total = self.repo.list(org_id, page=page, page_size=page_size, status=status)
        return PaginatedWorkers(items=items, total=total, page=page, page_size=page_size)

    def update_worker(
        self, org_id: uuid.UUID, worker_id: uuid.UUID, payload: WorkerUpdate
    ) -> Worker:
        worker = self.get_worker(org_id, worker_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(worker, field, value)
        self.db.commit()
        self.db.refresh(worker)
        return worker

    def archive_worker(self, org_id: uuid.UUID, worker_id: uuid.UUID) -> None:
        worker = self.get_worker(org_id, worker_id)
        worker.status = WorkerStatus.INACTIVE
        self.repo.soft_delete(worker)
        self.db.commit()


class AttendanceService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = AttendanceRepository(db)
        self.worker_repo = WorkerRepository(db)

    def mark_attendance(
        self,
        org_id: uuid.UUID,
        site_id: uuid.UUID,
        created_by: uuid.UUID,
        payload: AttendanceCreate,
    ) -> AttendanceEntry:
        worker = self.worker_repo.get_by_id(org_id, payload.worker_id)
        if worker is None:
            raise WorkerNotFoundError(payload.worker_id)
        if (
            self.repo.get_for_worker_date(org_id, payload.worker_id, payload.work_date)
            is not None
        ):
            raise DuplicateAttendanceError(payload.work_date)

        rate = Decimal(str(payload.wage_rate)) if payload.wage_rate is not None else Decimal(
            str(worker.default_wage_rate)
        )
        overtime = Decimal(str(payload.overtime_hours))
        wage_amount = compute_wage_amount(payload.status, rate, overtime)

        entry = AttendanceEntry(
            org_id=org_id,
            site_id=site_id,
            created_by=created_by,
            worker_id=payload.worker_id,
            work_date=payload.work_date,
            status=payload.status,
            overtime_hours=overtime,
            wage_rate=rate,
            wage_amount=wage_amount,
            notes=payload.notes,
        )
        entry = self.repo.create(entry)
        self.db.commit()
        self.db.refresh(entry)
        return entry

    def list_attendance(
        self, org_id: uuid.UUID, site_id: uuid.UUID, work_date: Optional[date] = None
    ) -> List[AttendanceEntry]:
        return self.repo.list_for_site(org_id, site_id, work_date=work_date)

    def wage_summary(
        self,
        org_id: uuid.UUID,
        site_id: uuid.UUID,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> List[SiteLabourSummaryItem]:
        rows = self.repo.wage_summary_for_site(org_id, site_id, date_from, date_to)
        return [
            SiteLabourSummaryItem(
                worker_id=row["worker_id"],
                worker_name=row["worker_name"],
                worker_code=row["worker_code"],
                trade=row["trade"],
                days_present=float(row["days_present"]),
                days_absent=int(row["days_absent"]),
                total_overtime_hours=float(row["total_overtime_hours"]),
                total_wages=float(row["total_wages"]),
            )
            for row in rows
        ]
