import uuid
from typing import List, Optional

from sqlalchemy.orm import Session

from app.modules.material.exceptions import (
    DuplicateMaterialCodeError,
    MaterialNotFoundError,
    SameSiteTransferError,
)
from app.modules.material.models.material_model import (
    Material,
    MaterialEntry,
    MaterialStatus,
    MaterialTransfer,
)
from app.modules.material.repositories.material_repository import (
    MaterialEntryRepository,
    MaterialRepository,
    MaterialTransferRepository,
)
from app.modules.material.schemas.material_schema import (
    MaterialCreate,
    MaterialEntryCreate,
    MaterialTransferCreate,
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
        # Merge entry-based stock with cross-site transfer totals, keyed by
        # material, so a material that only arrived here via transfer still shows.
        merged: dict = {}
        for row in self.repo.stock_summary_for_site(org_id, site_id):
            merged[row["material_id"]] = {
                "material_id": row["material_id"],
                "material_name": row["material_name"],
                "material_code": row["material_code"],
                "unit": row["unit"],
                "received": float(row["quantity_received"]),
                "used": float(row["quantity_used"]),
                "adjusted": float(row["quantity_adjusted"]),
                "in": 0.0,
                "out": 0.0,
            }

        for row in MaterialTransferRepository(self.db).totals_for_site(org_id, site_id):
            item = merged.setdefault(
                row["material_id"],
                {
                    "material_id": row["material_id"],
                    "material_name": row["material_name"],
                    "material_code": row["material_code"],
                    "unit": row["unit"],
                    "received": 0.0,
                    "used": 0.0,
                    "adjusted": 0.0,
                    "in": 0.0,
                    "out": 0.0,
                },
            )
            item["in"] = float(row["transferred_in"])
            item["out"] = float(row["transferred_out"])

        return [
            SiteMaterialStockItem(
                material_id=m["material_id"],
                material_name=m["material_name"],
                material_code=m["material_code"],
                unit=m["unit"],
                quantity_received=m["received"],
                quantity_used=m["used"],
                quantity_adjusted=m["adjusted"],
                quantity_transferred_in=m["in"],
                quantity_transferred_out=m["out"],
                quantity_on_hand=m["received"] - m["used"] + m["adjusted"] + m["in"] - m["out"],
            )
            for m in sorted(merged.values(), key=lambda x: x["material_name"])
        ]


class MaterialTransferService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = MaterialTransferRepository(db)
        self.material_repo = MaterialRepository(db)

    def create_transfer(
        self, org_id: uuid.UUID, created_by: uuid.UUID, payload: MaterialTransferCreate
    ) -> MaterialTransfer:
        if payload.from_site_id == payload.to_site_id:
            raise SameSiteTransferError()
        if self.material_repo.get_by_id(org_id, payload.material_id) is None:
            raise MaterialNotFoundError(payload.material_id)
        transfer = MaterialTransfer(org_id=org_id, created_by=created_by, **payload.model_dump())
        transfer = self.repo.create(transfer)
        self.db.commit()
        self.db.refresh(transfer)
        return transfer

    def list_for_site(self, org_id: uuid.UUID, site_id: uuid.UUID) -> List[MaterialTransfer]:
        return self.repo.list_for_site(org_id, site_id)
