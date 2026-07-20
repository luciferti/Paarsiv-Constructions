import uuid
from typing import Optional

from sqlalchemy.orm import Session

from app.modules.purchase.exceptions import (
    DuplicatePONumberError,
    PurchaseOrderNotFoundError,
    VendorNotFoundForPOError,
)
from app.modules.purchase.models.po_model import POStatus, PurchaseOrder, PurchaseOrderLine
from app.modules.purchase.repositories.po_repository import PurchaseOrderRepository
from app.modules.purchase.schemas.po_schema import (
    PaginatedPurchaseOrders,
    PurchaseOrderCreate,
    PurchaseOrderListItem,
    PurchaseOrderUpdate,
)
from app.modules.vendor.repositories.vendor_repository import VendorRepository


def _po_total(po: PurchaseOrder) -> float:
    return round(sum(float(line.quantity) * float(line.unit_price) for line in po.lines), 2)


class PurchaseOrderService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = PurchaseOrderRepository(db)
        self.vendor_repo = VendorRepository(db)

    def create_po(
        self, org_id: uuid.UUID, created_by: uuid.UUID, payload: PurchaseOrderCreate
    ) -> PurchaseOrder:
        if self.repo.get_by_number(org_id, payload.po_number) is not None:
            raise DuplicatePONumberError(payload.po_number)
        if self.vendor_repo.get_by_id(org_id, payload.vendor_id) is None:
            raise VendorNotFoundForPOError(payload.vendor_id)

        po = PurchaseOrder(
            org_id=org_id,
            created_by=created_by,
            po_number=payload.po_number,
            vendor_id=payload.vendor_id,
            site_id=payload.site_id,
            order_date=payload.order_date,
            expected_date=payload.expected_date,
            notes=payload.notes,
            status=POStatus.DRAFT,
        )
        po.lines = [
            PurchaseOrderLine(
                material_id=line.material_id,
                description=line.description,
                quantity=line.quantity,
                unit=line.unit,
                unit_price=line.unit_price,
            )
            for line in payload.lines
        ]
        po = self.repo.create(po)
        self.db.commit()
        return self.repo.get_by_id(org_id, po.id)

    def get_po(self, org_id: uuid.UUID, po_id: uuid.UUID) -> PurchaseOrder:
        po = self.repo.get_by_id(org_id, po_id)
        if po is None:
            raise PurchaseOrderNotFoundError(po_id)
        return po

    def list_pos(
        self,
        org_id: uuid.UUID,
        page: int = 1,
        page_size: int = 20,
        status: Optional[POStatus] = None,
        vendor_id: Optional[uuid.UUID] = None,
    ) -> PaginatedPurchaseOrders:
        pos, total = self.repo.list(
            org_id, page=page, page_size=page_size, status=status, vendor_id=vendor_id
        )
        items = [
            PurchaseOrderListItem(
                id=po.id,
                po_number=po.po_number,
                vendor_id=po.vendor_id,
                site_id=po.site_id,
                status=po.status,
                order_date=po.order_date,
                total_amount=_po_total(po),
            )
            for po in pos
        ]
        return PaginatedPurchaseOrders(items=items, total=total, page=page, page_size=page_size)

    def update_po(
        self, org_id: uuid.UUID, po_id: uuid.UUID, payload: PurchaseOrderUpdate
    ) -> PurchaseOrder:
        po = self.get_po(org_id, po_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(po, field, value)
        self.db.commit()
        return self.repo.get_by_id(org_id, po_id)

    def cancel_po(self, org_id: uuid.UUID, po_id: uuid.UUID) -> None:
        po = self.get_po(org_id, po_id)
        po.status = POStatus.CANCELLED
        self.repo.soft_delete(po)
        self.db.commit()
