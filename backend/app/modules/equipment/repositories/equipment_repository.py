import uuid
from typing import List, Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.equipment.models.equipment_model import (
    Equipment,
    EquipmentStatus,
    EquipmentUsage,
    MaintenanceLog,
)


class EquipmentRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, eq: Equipment) -> Equipment:
        self.db.add(eq)
        self.db.flush()
        return eq

    def get_by_id(self, org_id: uuid.UUID, eq_id: uuid.UUID) -> Optional[Equipment]:
        stmt = select(Equipment).where(
            Equipment.id == eq_id, Equipment.org_id == org_id, Equipment.is_deleted.is_(False)
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def get_by_code(self, org_id: uuid.UUID, code: str) -> Optional[Equipment]:
        stmt = select(Equipment).where(
            Equipment.org_id == org_id, Equipment.code == code, Equipment.is_deleted.is_(False)
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def list(
        self,
        org_id: uuid.UUID,
        page: int,
        page_size: int,
        status: Optional[EquipmentStatus] = None,
    ) -> Tuple[List[Equipment], int]:
        conditions = [Equipment.org_id == org_id, Equipment.is_deleted.is_(False)]
        if status is not None:
            conditions.append(Equipment.status == status)
        total = self.db.execute(
            select(func.count()).select_from(Equipment).where(*conditions)
        ).scalar_one()
        stmt = (
            select(Equipment)
            .where(*conditions)
            .order_by(Equipment.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        return list(self.db.execute(stmt).scalars().all()), total

    def soft_delete(self, eq: Equipment) -> None:
        eq.is_deleted = True
        self.db.flush()


class UsageRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, usage: EquipmentUsage) -> EquipmentUsage:
        self.db.add(usage)
        self.db.flush()
        return usage

    def list_for_site(self, org_id: uuid.UUID, site_id: uuid.UUID) -> List[EquipmentUsage]:
        stmt = (
            select(EquipmentUsage)
            .where(EquipmentUsage.org_id == org_id, EquipmentUsage.site_id == site_id)
            .order_by(EquipmentUsage.usage_date.desc(), EquipmentUsage.created_at.desc())
        )
        return list(self.db.execute(stmt).scalars().all())

    def cost_summary_for_site(self, org_id: uuid.UUID, site_id: uuid.UUID) -> List[dict]:
        stmt = (
            select(
                Equipment.id.label("equipment_id"),
                Equipment.name.label("equipment_name"),
                Equipment.code.label("equipment_code"),
                func.coalesce(func.sum(EquipmentUsage.quantity), 0).label("total_quantity"),
                func.coalesce(func.sum(EquipmentUsage.cost), 0).label("total_cost"),
            )
            .join(EquipmentUsage, EquipmentUsage.equipment_id == Equipment.id)
            .where(EquipmentUsage.org_id == org_id, EquipmentUsage.site_id == site_id)
            .group_by(Equipment.id, Equipment.name, Equipment.code)
            .order_by(Equipment.name)
        )
        return [dict(row) for row in self.db.execute(stmt).mappings().all()]


class MaintenanceRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, log: MaintenanceLog) -> MaintenanceLog:
        self.db.add(log)
        self.db.flush()
        return log

    def list_for_equipment(self, org_id: uuid.UUID, equipment_id: uuid.UUID) -> List[MaintenanceLog]:
        stmt = (
            select(MaintenanceLog)
            .where(MaintenanceLog.org_id == org_id, MaintenanceLog.equipment_id == equipment_id)
            .order_by(MaintenanceLog.service_date.desc())
        )
        return list(self.db.execute(stmt).scalars().all())
