import uuid
from typing import List, Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.modules.purchase.models.po_model import POStatus, PurchaseOrder


class PurchaseOrderRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, po: PurchaseOrder) -> PurchaseOrder:
        self.db.add(po)
        self.db.flush()
        return po

    def get_by_id(self, org_id: uuid.UUID, po_id: uuid.UUID) -> Optional[PurchaseOrder]:
        stmt = (
            select(PurchaseOrder)
            .options(selectinload(PurchaseOrder.lines))
            .where(
                PurchaseOrder.id == po_id,
                PurchaseOrder.org_id == org_id,
                PurchaseOrder.is_deleted.is_(False),
            )
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def get_by_number(self, org_id: uuid.UUID, po_number: str) -> Optional[PurchaseOrder]:
        stmt = select(PurchaseOrder).where(
            PurchaseOrder.org_id == org_id,
            PurchaseOrder.po_number == po_number,
            PurchaseOrder.is_deleted.is_(False),
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def list(
        self,
        org_id: uuid.UUID,
        page: int,
        page_size: int,
        status: Optional[POStatus] = None,
        vendor_id: Optional[uuid.UUID] = None,
    ) -> Tuple[List[PurchaseOrder], int]:
        conditions = [PurchaseOrder.org_id == org_id, PurchaseOrder.is_deleted.is_(False)]
        if status is not None:
            conditions.append(PurchaseOrder.status == status)
        if vendor_id is not None:
            conditions.append(PurchaseOrder.vendor_id == vendor_id)

        count_stmt = select(func.count()).select_from(PurchaseOrder).where(*conditions)
        total = self.db.execute(count_stmt).scalar_one()

        stmt = (
            select(PurchaseOrder)
            .options(selectinload(PurchaseOrder.lines))
            .where(*conditions)
            .order_by(PurchaseOrder.order_date.desc(), PurchaseOrder.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        items = list(self.db.execute(stmt).scalars().all())
        return items, total

    def soft_delete(self, po: PurchaseOrder) -> None:
        po.is_deleted = True
        self.db.flush()
