import uuid
from typing import List, Optional

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.modules.expense.models.expense_model import CashEntry, CashEntryType


class ExpenseRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, entry: CashEntry) -> CashEntry:
        self.db.add(entry)
        self.db.flush()
        return entry

    def get_by_id(self, org_id: uuid.UUID, entry_id: uuid.UUID) -> Optional[CashEntry]:
        stmt = select(CashEntry).where(
            CashEntry.id == entry_id,
            CashEntry.org_id == org_id,
            CashEntry.is_deleted.is_(False),
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def list(
        self, org_id: uuid.UUID, site_id: Optional[uuid.UUID] = None
    ) -> List[CashEntry]:
        conditions = [CashEntry.org_id == org_id, CashEntry.is_deleted.is_(False)]
        if site_id is not None:
            conditions.append(CashEntry.site_id == site_id)
        stmt = (
            select(CashEntry)
            .where(*conditions)
            .order_by(CashEntry.entry_date.desc(), CashEntry.created_at.desc())
        )
        return list(self.db.execute(stmt).scalars().all())

    def totals(self, org_id: uuid.UUID, site_id: Optional[uuid.UUID] = None) -> dict:
        conditions = [CashEntry.org_id == org_id, CashEntry.is_deleted.is_(False)]
        if site_id is not None:
            conditions.append(CashEntry.site_id == site_id)
        topup = func.coalesce(
            func.sum(case((CashEntry.entry_type == CashEntryType.TOPUP, CashEntry.amount), else_=0)), 0
        ).label("total_topup")
        expense = func.coalesce(
            func.sum(case((CashEntry.entry_type == CashEntryType.EXPENSE, CashEntry.amount), else_=0)), 0
        ).label("total_expense")
        row = self.db.execute(select(topup, expense).where(*conditions)).mappings().one()
        return dict(row)

    def expense_by_category(
        self, org_id: uuid.UUID, site_id: Optional[uuid.UUID] = None
    ) -> List[dict]:
        conditions = [
            CashEntry.org_id == org_id,
            CashEntry.is_deleted.is_(False),
            CashEntry.entry_type == CashEntryType.EXPENSE,
        ]
        if site_id is not None:
            conditions.append(CashEntry.site_id == site_id)
        stmt = (
            select(
                func.coalesce(CashEntry.category, "Uncategorized").label("category"),
                func.coalesce(func.sum(CashEntry.amount), 0).label("amount"),
            )
            .where(*conditions)
            .group_by(func.coalesce(CashEntry.category, "Uncategorized"))
            .order_by(func.sum(CashEntry.amount).desc())
        )
        return [dict(row) for row in self.db.execute(stmt).mappings().all()]

    def soft_delete(self, entry: CashEntry) -> None:
        entry.is_deleted = True
        self.db.flush()
