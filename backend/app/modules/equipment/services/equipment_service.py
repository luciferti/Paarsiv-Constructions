import uuid
from decimal import Decimal
from typing import List, Optional

from sqlalchemy.orm import Session

from app.modules.equipment.exceptions import (
    DuplicateEquipmentCodeError,
    EquipmentNotFoundError,
)
from app.modules.equipment.models.equipment_model import (
    Equipment,
    EquipmentStatus,
    EquipmentUsage,
    MaintenanceLog,
)
from app.modules.equipment.repositories.equipment_repository import (
    EquipmentRepository,
    MaintenanceRepository,
    UsageRepository,
)
from app.modules.equipment.schemas.equipment_schema import (
    EquipmentCreate,
    EquipmentUpdate,
    MaintenanceCreate,
    PaginatedEquipment,
    SiteEquipmentCostItem,
    UsageCreate,
)


class EquipmentService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = EquipmentRepository(db)

    def create(self, org_id, created_by, payload: EquipmentCreate) -> Equipment:
        if self.repo.get_by_code(org_id, payload.code) is not None:
            raise DuplicateEquipmentCodeError(payload.code)
        eq = Equipment(org_id=org_id, created_by=created_by, **payload.model_dump())
        eq = self.repo.create(eq)
        self.db.commit()
        self.db.refresh(eq)
        return eq

    def get(self, org_id, eq_id) -> Equipment:
        eq = self.repo.get_by_id(org_id, eq_id)
        if eq is None:
            raise EquipmentNotFoundError(eq_id)
        return eq

    def list(self, org_id, page=1, page_size=20, status=None) -> PaginatedEquipment:
        items, total = self.repo.list(org_id, page=page, page_size=page_size, status=status)
        return PaginatedEquipment(items=items, total=total, page=page, page_size=page_size)

    def update(self, org_id, eq_id, payload: EquipmentUpdate) -> Equipment:
        eq = self.get(org_id, eq_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(eq, field, value)
        self.db.commit()
        self.db.refresh(eq)
        return eq

    def archive(self, org_id, eq_id) -> None:
        eq = self.get(org_id, eq_id)
        eq.status = EquipmentStatus.RETIRED
        self.repo.soft_delete(eq)
        self.db.commit()


class UsageService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = UsageRepository(db)
        self.eq_repo = EquipmentRepository(db)

    def add_usage(self, org_id, site_id, created_by, payload: UsageCreate) -> EquipmentUsage:
        eq = self.eq_repo.get_by_id(org_id, payload.equipment_id)
        if eq is None:
            raise EquipmentNotFoundError(payload.equipment_id)
        # Prefill cost from rental_rate × quantity when not given.
        if payload.cost is not None:
            cost = Decimal(str(payload.cost))
        else:
            cost = Decimal(str(eq.rental_rate)) * Decimal(str(payload.quantity))
        usage = EquipmentUsage(
            org_id=org_id,
            site_id=site_id,
            created_by=created_by,
            equipment_id=payload.equipment_id,
            usage_date=payload.usage_date,
            quantity=payload.quantity,
            cost=cost,
            notes=payload.notes,
        )
        usage = self.repo.create(usage)
        self.db.commit()
        self.db.refresh(usage)
        return usage

    def list_usage(self, org_id, site_id) -> List[EquipmentUsage]:
        return self.repo.list_for_site(org_id, site_id)

    def cost_summary(self, org_id, site_id) -> List[SiteEquipmentCostItem]:
        rows = self.repo.cost_summary_for_site(org_id, site_id)
        return [
            SiteEquipmentCostItem(
                equipment_id=row["equipment_id"],
                equipment_name=row["equipment_name"],
                equipment_code=row["equipment_code"],
                total_quantity=float(row["total_quantity"]),
                total_cost=float(row["total_cost"]),
            )
            for row in rows
        ]


class MaintenanceService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = MaintenanceRepository(db)
        self.eq_repo = EquipmentRepository(db)

    def add_log(self, org_id, equipment_id, created_by, payload: MaintenanceCreate) -> MaintenanceLog:
        if self.eq_repo.get_by_id(org_id, equipment_id) is None:
            raise EquipmentNotFoundError(equipment_id)
        log = MaintenanceLog(
            org_id=org_id, equipment_id=equipment_id, created_by=created_by, **payload.model_dump()
        )
        log = self.repo.create(log)
        self.db.commit()
        self.db.refresh(log)
        return log

    def list_logs(self, org_id, equipment_id) -> List[MaintenanceLog]:
        return self.repo.list_for_equipment(org_id, equipment_id)
