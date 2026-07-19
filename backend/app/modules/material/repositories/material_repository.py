import uuid
from typing import List, Optional, Tuple

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.modules.material.models.material_model import Material, MaterialEntry, MaterialEntryType, MaterialStatus


class MaterialRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, material: Material) -> Material:
        self.db.add(material)
        self.db.flush()
        return material

    def get_by_id(self, org_id: uuid.UUID, material_id: uuid.UUID) -> Optional[Material]:
        stmt = select(Material).where(
            Material.id == material_id, Material.org_id == org_id, Material.is_deleted.is_(False)
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def get_by_code(self, org_id: uuid.UUID, code: str) -> Optional[Material]:
        stmt = select(Material).where(
            Material.org_id == org_id, Material.code == code, Material.is_deleted.is_(False)
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def list(
        self,
        org_id: uuid.UUID,
        page: int,
        page_size: int,
        status: Optional[MaterialStatus] = None,
    ) -> Tuple[List[Material], int]:
        conditions = [Material.org_id == org_id, Material.is_deleted.is_(False)]
        if status is not None:
            conditions.append(Material.status == status)

        base_stmt = select(Material).where(*conditions)
        count_stmt = select(func.count()).select_from(Material).where(*conditions)
        total = self.db.execute(count_stmt).scalar_one()

        stmt = (
            base_stmt.order_by(Material.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        items = list(self.db.execute(stmt).scalars().all())
        return items, total

    def soft_delete(self, material: Material) -> None:
        material.is_deleted = True
        self.db.flush()


class MaterialEntryRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, entry: MaterialEntry) -> MaterialEntry:
        self.db.add(entry)
        self.db.flush()
        return entry

    def list_for_site(self, org_id: uuid.UUID, site_id: uuid.UUID) -> List[MaterialEntry]:
        stmt = (
            select(MaterialEntry)
            .where(MaterialEntry.site_id == site_id, MaterialEntry.org_id == org_id)
            .order_by(MaterialEntry.entry_date.desc(), MaterialEntry.created_at.desc())
        )
        return list(self.db.execute(stmt).scalars().all())

    def stock_summary_for_site(self, org_id: uuid.UUID, site_id: uuid.UUID) -> List[dict]:
        received = func.sum(
            case((MaterialEntry.entry_type == MaterialEntryType.RECEIVED, MaterialEntry.quantity), else_=0)
        ).label("quantity_received")
        used = func.sum(
            case((MaterialEntry.entry_type == MaterialEntryType.USED, MaterialEntry.quantity), else_=0)
        ).label("quantity_used")
        adjusted = func.sum(
            case((MaterialEntry.entry_type == MaterialEntryType.ADJUSTMENT, MaterialEntry.quantity), else_=0)
        ).label("quantity_adjusted")

        stmt = (
            select(
                Material.id.label("material_id"),
                Material.name.label("material_name"),
                Material.code.label("material_code"),
                Material.unit.label("unit"),
                received,
                used,
                adjusted,
            )
            .join(MaterialEntry, MaterialEntry.material_id == Material.id)
            .where(MaterialEntry.site_id == site_id, MaterialEntry.org_id == org_id)
            .group_by(Material.id, Material.name, Material.code, Material.unit)
            .order_by(Material.name)
        )
        rows = self.db.execute(stmt).mappings().all()
        return [dict(row) for row in rows]
