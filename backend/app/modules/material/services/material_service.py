import uuid
from typing import List, Optional

from sqlalchemy.orm import Session

from app.modules.material.exceptions import DuplicateMaterialCodeError, MaterialNotFoundError
from app.modules.material.models.material_model import Material, MaterialEntry, MaterialStatus
from app.modules.material.repositories.material_repository import (
    MaterialEntryRepository,
    MaterialRepository,
)
from app.modules.material.schemas.material_schema import (
    MaterialCreate,
    MaterialEntryCreate,
    MaterialUpdate,
    PaginatedMaterials,
    SiteMaterialStockItem,
)


class MaterialService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = MaterialRepository(db)

    def create_material(
        self, org_id: uuid.UUID, created_by: uuid.UUID, payload: MaterialCreate
    ) -> Material:
        if self.repo.get_by_code(org_id, payload.code) is not None:
            raise DuplicateMaterialCodeError(payload.code)

        material = Material(org_id=org_id, created_by=created_by, **payload.model_dump())
        material = self.repo.create(material)
        self.db.commit()
        self.db.refresh(material)
        return material

    def get_material(self, org_id: uuid.UUID, material_id: uuid.UUID) -> Material:
        material = self.repo.get_by_id(org_id, material_id)
        if material is None:
            raise MaterialNotFoundError(material_id)
        return material

    def list_materials(
        self,
        org_id: uuid.UUID,
        page: int = 1,
        page_size: int = 20,
        status: Optional[MaterialStatus] = None,
    ) -> PaginatedMaterials:
        items, total = self.repo.list(org_id, page=page, page_size=page_size, status=status)
        return PaginatedMaterials(items=items, total=total, page=page, page_size=page_size)

    def update_material(
        self, org_id: uuid.UUID, material_id: uuid.UUID, payload: MaterialUpdate
    ) -> Material:
        material = self.get_material(org_id, material_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(material, field, value)
        self.db.commit()
        self.db.refresh(material)
        return material

    def archive_material(self, org_id: uuid.UUID, material_id: uuid.UUID) -> None:
        material = self.get_material(org_id, material_id)
        material.status = MaterialStatus.INACTIVE
        self.repo.soft_delete(material)
        self.db.commit()


class MaterialEntryService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = MaterialEntryRepository(db)
        self.material_repo = MaterialRepository(db)

    def add_entry(
        self,
        org_id: uuid.UUID,
        site_id: uuid.UUID,
        created_by: uuid.UUID,
        payload: MaterialEntryCreate,
    ) -> MaterialEntry:
        # Validates the material belongs to this org before logging against it.
        if self.material_repo.get_by_id(org_id, payload.material_id) is None:
            raise MaterialNotFoundError(payload.material_id)

        entry = MaterialEntry(
            org_id=org_id, site_id=site_id, created_by=created_by, **payload.model_dump()
        )
        entry = self.repo.create(entry)
        self.db.commit()
        self.db.refresh(entry)
        return entry

    def list_entries(self, org_id: uuid.UUID, site_id: uuid.UUID) -> List[MaterialEntry]:
        return self.repo.list_for_site(org_id, site_id)

    def stock_summary(self, org_id: uuid.UUID, site_id: uuid.UUID) -> List[SiteMaterialStockItem]:
        rows = self.repo.stock_summary_for_site(org_id, site_id)
        return [
            SiteMaterialStockItem(
                material_id=row["material_id"],
                material_name=row["material_name"],
                material_code=row["material_code"],
                unit=row["unit"],
                quantity_received=float(row["quantity_received"]),
                quantity_used=float(row["quantity_used"]),
                quantity_adjusted=float(row["quantity_adjusted"]),
                quantity_on_hand=float(row["quantity_received"])
                - float(row["quantity_used"])
                + float(row["quantity_adjusted"]),
            )
            for row in rows
        ]
