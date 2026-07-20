import uuid
from typing import List, Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.modules.subcontract.models.subcontract_model import (
    Subcontractor,
    SubcontractorStatus,
    WorkOrder,
    WorkOrderStatus,
)


class SubcontractorRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, sub: Subcontractor) -> Subcontractor:
        self.db.add(sub)
        self.db.flush()
        return sub

    def get_by_id(self, org_id: uuid.UUID, sub_id: uuid.UUID) -> Optional[Subcontractor]:
        stmt = select(Subcontractor).where(
            Subcontractor.id == sub_id,
            Subcontractor.org_id == org_id,
            Subcontractor.is_deleted.is_(False),
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def get_by_code(self, org_id: uuid.UUID, code: str) -> Optional[Subcontractor]:
        stmt = select(Subcontractor).where(
            Subcontractor.org_id == org_id,
            Subcontractor.code == code,
            Subcontractor.is_deleted.is_(False),
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def list(
        self,
        org_id: uuid.UUID,
        page: int,
        page_size: int,
        status: Optional[SubcontractorStatus] = None,
    ) -> Tuple[List[Subcontractor], int]:
        conditions = [Subcontractor.org_id == org_id, Subcontractor.is_deleted.is_(False)]
        if status is not None:
            conditions.append(Subcontractor.status == status)
        total = self.db.execute(
            select(func.count()).select_from(Subcontractor).where(*conditions)
        ).scalar_one()
        stmt = (
            select(Subcontractor)
            .where(*conditions)
            .order_by(Subcontractor.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        return list(self.db.execute(stmt).scalars().all()), total

    def soft_delete(self, sub: Subcontractor) -> None:
        sub.is_deleted = True
        self.db.flush()


class WorkOrderRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, wo: WorkOrder) -> WorkOrder:
        self.db.add(wo)
        self.db.flush()
        return wo

    def get_by_id(self, org_id: uuid.UUID, wo_id: uuid.UUID) -> Optional[WorkOrder]:
        stmt = (
            select(WorkOrder)
            .options(selectinload(WorkOrder.payments))
            .where(
                WorkOrder.id == wo_id,
                WorkOrder.org_id == org_id,
                WorkOrder.is_deleted.is_(False),
            )
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def get_by_number(self, org_id: uuid.UUID, wo_number: str) -> Optional[WorkOrder]:
        stmt = select(WorkOrder).where(
            WorkOrder.org_id == org_id,
            WorkOrder.wo_number == wo_number,
            WorkOrder.is_deleted.is_(False),
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def list(
        self,
        org_id: uuid.UUID,
        page: int,
        page_size: int,
        site_id: Optional[uuid.UUID] = None,
        status: Optional[WorkOrderStatus] = None,
    ) -> Tuple[List[WorkOrder], int]:
        conditions = [WorkOrder.org_id == org_id, WorkOrder.is_deleted.is_(False)]
        if site_id is not None:
            conditions.append(WorkOrder.site_id == site_id)
        if status is not None:
            conditions.append(WorkOrder.status == status)
        total = self.db.execute(
            select(func.count()).select_from(WorkOrder).where(*conditions)
        ).scalar_one()
        stmt = (
            select(WorkOrder)
            .options(selectinload(WorkOrder.payments))
            .where(*conditions)
            .order_by(WorkOrder.order_date.desc(), WorkOrder.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        return list(self.db.execute(stmt).scalars().all()), total

    def soft_delete(self, wo: WorkOrder) -> None:
        wo.is_deleted = True
        self.db.flush()
