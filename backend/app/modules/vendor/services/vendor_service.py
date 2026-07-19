import uuid
from typing import Optional

from sqlalchemy.orm import Session

from app.modules.vendor.exceptions import DuplicateVendorCodeError, VendorNotFoundError
from app.modules.vendor.models.vendor_model import Vendor, VendorStatus
from app.modules.vendor.repositories.vendor_repository import VendorRepository
from app.modules.vendor.schemas.vendor_schema import PaginatedVendors, VendorCreate, VendorUpdate


class VendorService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = VendorRepository(db)

    def create_vendor(
        self, org_id: uuid.UUID, created_by: uuid.UUID, payload: VendorCreate
    ) -> Vendor:
        if self.repo.get_by_code(org_id, payload.code) is not None:
            raise DuplicateVendorCodeError(payload.code)

        vendor = Vendor(org_id=org_id, created_by=created_by, **payload.model_dump())
        vendor = self.repo.create(vendor)
        self.db.commit()
        self.db.refresh(vendor)
        return vendor

    def get_vendor(self, org_id: uuid.UUID, vendor_id: uuid.UUID) -> Vendor:
        vendor = self.repo.get_by_id(org_id, vendor_id)
        if vendor is None:
            raise VendorNotFoundError(vendor_id)
        return vendor

    def list_vendors(
        self,
        org_id: uuid.UUID,
        page: int = 1,
        page_size: int = 20,
        status: Optional[VendorStatus] = None,
        category: Optional[str] = None,
    ) -> PaginatedVendors:
        items, total = self.repo.list(
            org_id, page=page, page_size=page_size, status=status, category=category
        )
        return PaginatedVendors(items=items, total=total, page=page, page_size=page_size)

    def update_vendor(
        self, org_id: uuid.UUID, vendor_id: uuid.UUID, payload: VendorUpdate
    ) -> Vendor:
        vendor = self.get_vendor(org_id, vendor_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(vendor, field, value)
        self.db.commit()
        self.db.refresh(vendor)
        return vendor

    def archive_vendor(self, org_id: uuid.UUID, vendor_id: uuid.UUID) -> None:
        vendor = self.get_vendor(org_id, vendor_id)
        vendor.status = VendorStatus.INACTIVE
        self.repo.soft_delete(vendor)
        self.db.commit()
