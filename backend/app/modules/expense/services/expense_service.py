import uuid
from typing import List, Optional

from sqlalchemy.orm import Session

from app.modules.expense.exceptions import CashEntryNotFoundError
from app.modules.expense.models.expense_model import CashEntry
from app.modules.expense.repositories.expense_repository import ExpenseRepository
from app.modules.expense.schemas.expense_schema import (
    CashEntryCreate,
    ExpenseCategoryRow,
    PettyCashSummary,
)


class ExpenseService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = ExpenseRepository(db)

    def add_entry(
        self, org_id: uuid.UUID, created_by: uuid.UUID, payload: CashEntryCreate
    ) -> CashEntry:
        entry = CashEntry(org_id=org_id, created_by=created_by, **payload.model_dump())
        entry = self.repo.create(entry)
        self.db.commit()
        self.db.refresh(entry)
        return entry

    def list_entries(
        self, org_id: uuid.UUID, site_id: Optional[uuid.UUID] = None
    ) -> List[CashEntry]:
        return self.repo.list(org_id, site_id=site_id)

    def delete_entry(self, org_id: uuid.UUID, entry_id: uuid.UUID) -> None:
        entry = self.repo.get_by_id(org_id, entry_id)
        if entry is None:
            raise CashEntryNotFoundError(entry_id)
        self.repo.soft_delete(entry)
        self.db.commit()

    def summary(
        self, org_id: uuid.UUID, site_id: Optional[uuid.UUID] = None
    ) -> PettyCashSummary:
        totals = self.repo.totals(org_id, site_id=site_id)
        total_topup = round(float(totals["total_topup"]), 2)
        total_expense = round(float(totals["total_expense"]), 2)
        by_cat = self.repo.expense_by_category(org_id, site_id=site_id)
        return PettyCashSummary(
            total_topup=total_topup,
            total_expense=total_expense,
            balance=round(total_topup - total_expense, 2),
            expense_by_category=[
                ExpenseCategoryRow(category=row["category"], amount=float(row["amount"]))
                for row in by_cat
            ],
        )
