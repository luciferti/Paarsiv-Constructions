import uuid
from typing import List, Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.vendor.models.vendor_model import Vendor, VendorStatus


class VendorRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, vendor: Vendor) -> Vendor:
        self.db.add(vendor)
        self.db.flush()
        return vendor

    def get_by_id(self, org_id: uuid.UUID, vendor_id: uuid.UUID) -> Optional[Vendor]:
        stmt = select(Vendor).where(
            Vendor.id == vendor_id, Vendor.org_id == org_id, Vendor.is_deleted.is_(False)
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def get_by_code(self, org_id: uuid.UUID, code: str) -> Optional[Vendor]:
        stmt = select(Vendor).where(
            Vendor.org_id == org_id, Vendor.code == code, Vendor.is_deleted.is_(False)
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def list(
        self,
        org_id: uuid.UUID,
        page: int,
        page_size: int,
        status: Optional[VendorStatus] = None,
        category: Optional[str] = None,
    ) -> Tuple[List[Vendor], int]:
        conditions = [Vendor.org_id == org_id, Vendor.is_deleted.is_(False)]
        if status is not None:
            conditions.append(Vendor.status == status)
        if category is not None:
            conditions.append(Vendor.category == category)

        base_stmt = select(Vendor).where(*conditions)
        count_stmt = select(func.count()).select_from(Vendor).where(*conditions)
        total = self.db.execute(count_stmt).scalar_one()

        stmt = (
            base_stmt.order_by(Vendor.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        items = list(self.db.execute(stmt).scalars().all())
        return items, total

    def soft_delete(self, vendor: Vendor) -> None:
        vendor.is_deleted = True
        self.db.flush()
