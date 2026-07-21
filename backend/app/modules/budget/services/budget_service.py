import uuid
from typing import List

from sqlalchemy.orm import Session

from app.modules.budget.exceptions import BudgetLineNotFoundError
from app.modules.budget.models.budget_model import BudgetLine
from app.modules.budget.repositories.budget_repository import BudgetRepository
from app.modules.budget.schemas.budget_schema import (
    BudgetCategoryRow,
    BudgetLineCreate,
    SiteBudgetSummary,
)


class BudgetService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = BudgetRepository(db)

    def add_line(
        self,
        org_id: uuid.UUID,
        site_id: uuid.UUID,
        created_by: uuid.UUID,
        payload: BudgetLineCreate,
    ) -> BudgetLine:
        line = BudgetLine(
            org_id=org_id, site_id=site_id, created_by=created_by, **payload.model_dump()
        )
        line = self.repo.create(line)
        self.db.commit()
        self.db.refresh(line)
        return line

    def list_lines(self, org_id: uuid.UUID, site_id: uuid.UUID) -> List[BudgetLine]:
        return self.repo.list_for_site(org_id, site_id)

    def delete_line(self, org_id: uuid.UUID, line_id: uuid.UUID) -> None:
        line = self.repo.get_by_id(org_id, line_id)
        if line is None:
            raise BudgetLineNotFoundError(line_id)
        self.repo.soft_delete(line)
        self.db.commit()

    def summary(self, org_id: uuid.UUID, site_id: uuid.UUID) -> SiteBudgetSummary:
        by_category = self.repo.budget_by_category(org_id, site_id)
        total_budgeted = round(sum(float(row["budgeted"]) for row in by_category), 2)

        actual_material = round(self.repo.actual_material_cost(org_id, site_id), 2)
        actual_labour = round(self.repo.actual_labour_cost(org_id, site_id), 2)
        actual_invoices = round(self.repo.actual_invoice_cost(org_id, site_id), 2)
        actual_equipment = round(self.repo.actual_equipment_cost(org_id, site_id), 2)
        actual_total = round(
            actual_material + actual_labour + actual_invoices + actual_equipment, 2
        )

        percent_used = round(actual_total / total_budgeted * 100, 1) if total_budgeted > 0 else 0.0

        return SiteBudgetSummary(
            site_id=site_id,
            total_budgeted=total_budgeted,
            budget_by_category=[
                BudgetCategoryRow(category=row["category"], budgeted=float(row["budgeted"]))
                for row in by_category
            ],
            actual_material=actual_material,
            actual_labour=actual_labour,
            actual_invoices=actual_invoices,
            actual_equipment=actual_equipment,
            actual_total=actual_total,
            variance=round(total_budgeted - actual_total, 2),
            percent_used=percent_used,
        )
