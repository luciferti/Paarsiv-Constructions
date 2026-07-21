import uuid
from typing import List, Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.budget.models.budget_model import BudgetLine
from app.modules.equipment.models.equipment_model import EquipmentUsage
from app.modules.invoice.models.invoice_model import Invoice, InvoiceStatus
from app.modules.labour.models.labour_model import AttendanceEntry
from app.modules.material.models.material_model import MaterialEntry, MaterialEntryType


class BudgetRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, line: BudgetLine) -> BudgetLine:
        self.db.add(line)
        self.db.flush()
        return line

    def get_by_id(self, org_id: uuid.UUID, line_id: uuid.UUID) -> Optional[BudgetLine]:
        stmt = select(BudgetLine).where(
            BudgetLine.id == line_id,
            BudgetLine.org_id == org_id,
            BudgetLine.is_deleted.is_(False),
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def list_for_site(self, org_id: uuid.UUID, site_id: uuid.UUID) -> List[BudgetLine]:
        stmt = (
            select(BudgetLine)
            .where(
                BudgetLine.org_id == org_id,
                BudgetLine.site_id == site_id,
                BudgetLine.is_deleted.is_(False),
            )
            .order_by(BudgetLine.category, BudgetLine.created_at)
        )
        return list(self.db.execute(stmt).scalars().all())

    def budget_by_category(self, org_id: uuid.UUID, site_id: uuid.UUID) -> List[dict]:
        stmt = (
            select(
                BudgetLine.category,
                func.coalesce(func.sum(BudgetLine.budgeted_amount), 0).label("budgeted"),
            )
            .where(
                BudgetLine.org_id == org_id,
                BudgetLine.site_id == site_id,
                BudgetLine.is_deleted.is_(False),
            )
            .group_by(BudgetLine.category)
            .order_by(BudgetLine.category)
        )
        return [dict(row) for row in self.db.execute(stmt).mappings().all()]

    def soft_delete(self, line: BudgetLine) -> None:
        line.is_deleted = True
        self.db.flush()

    # ---- Actuals rolled up from other modules (read-only reporting) ----

    def actual_material_cost(self, org_id: uuid.UUID, site_id: uuid.UUID) -> float:
        stmt = select(
            func.coalesce(func.sum(MaterialEntry.quantity * MaterialEntry.unit_cost), 0)
        ).where(
            MaterialEntry.org_id == org_id,
            MaterialEntry.site_id == site_id,
            MaterialEntry.entry_type == MaterialEntryType.RECEIVED,
        )
        return float(self.db.execute(stmt).scalar_one())

    def actual_labour_cost(self, org_id: uuid.UUID, site_id: uuid.UUID) -> float:
        stmt = select(func.coalesce(func.sum(AttendanceEntry.wage_amount), 0)).where(
            AttendanceEntry.org_id == org_id, AttendanceEntry.site_id == site_id
        )
        return float(self.db.execute(stmt).scalar_one())

    def actual_invoice_cost(self, org_id: uuid.UUID, site_id: uuid.UUID) -> float:
        stmt = select(func.coalesce(func.sum(Invoice.amount), 0)).where(
            Invoice.org_id == org_id,
            Invoice.site_id == site_id,
            Invoice.status == InvoiceStatus.APPROVED,
        )
        return float(self.db.execute(stmt).scalar_one())

    def actual_equipment_cost(self, org_id: uuid.UUID, site_id: uuid.UUID) -> float:
        stmt = select(func.coalesce(func.sum(EquipmentUsage.cost), 0)).where(
            EquipmentUsage.org_id == org_id, EquipmentUsage.site_id == site_id
        )
        return float(self.db.execute(stmt).scalar_one())
