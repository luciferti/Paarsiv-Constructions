import uuid
from typing import List, Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.billing.models.billing_model import BillStatus, ClientBill


class BillingRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, bill: ClientBill) -> ClientBill:
        self.db.add(bill)
        self.db.flush()
        return bill

    def get_by_id(self, org_id: uuid.UUID, bill_id: uuid.UUID) -> Optional[ClientBill]:
        stmt = select(ClientBill).where(
            ClientBill.id == bill_id,
            ClientBill.org_id == org_id,
            ClientBill.is_deleted.is_(False),
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def get_by_number(self, org_id: uuid.UUID, bill_number: str) -> Optional[ClientBill]:
        stmt = select(ClientBill).where(
            ClientBill.org_id == org_id,
            ClientBill.bill_number == bill_number,
            ClientBill.is_deleted.is_(False),
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def list(
        self,
        org_id: uuid.UUID,
        page: int,
        page_size: int,
        site_id: Optional[uuid.UUID] = None,
        status: Optional[BillStatus] = None,
    ) -> Tuple[List[ClientBill], int]:
        conditions = [ClientBill.org_id == org_id, ClientBill.is_deleted.is_(False)]
        if site_id is not None:
            conditions.append(ClientBill.site_id == site_id)
        if status is not None:
            conditions.append(ClientBill.status == status)

        count_stmt = select(func.count()).select_from(ClientBill).where(*conditions)
        total = self.db.execute(count_stmt).scalar_one()

        stmt = (
            select(ClientBill)
            .where(*conditions)
            .order_by(ClientBill.bill_date.desc(), ClientBill.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        items = list(self.db.execute(stmt).scalars().all())
        return items, total

    def all_for_summary(
        self, org_id: uuid.UUID, site_id: Optional[uuid.UUID] = None
    ) -> List[ClientBill]:
        conditions = [ClientBill.org_id == org_id, ClientBill.is_deleted.is_(False)]
        if site_id is not None:
            conditions.append(ClientBill.site_id == site_id)
        return list(self.db.execute(select(ClientBill).where(*conditions)).scalars().all())

    def soft_delete(self, bill: ClientBill) -> None:
        bill.is_deleted = True
        self.db.flush()
