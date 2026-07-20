import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, status

from app.core.deps import CurrentUser
from app.modules.purchase.dependencies import (
    get_po_service,
    require_po_cancel,
    require_po_create,
    require_po_edit,
    require_po_view,
)
from app.modules.purchase.models.po_model import POStatus
from app.modules.purchase.schemas.po_schema import (
    PaginatedPurchaseOrders,
    PurchaseOrderCreate,
    PurchaseOrderOut,
    PurchaseOrderUpdate,
)
from app.modules.purchase.services.po_service import PurchaseOrderService

router = APIRouter(prefix="/purchase-orders", tags=["purchase-orders"])


@router.post("", response_model=PurchaseOrderOut, status_code=status.HTTP_201_CREATED)
def create_purchase_order(
    payload: PurchaseOrderCreate,
    user: CurrentUser = Depends(require_po_create),
    service: PurchaseOrderService = Depends(get_po_service),
) -> PurchaseOrderOut:
    po = service.create_po(
        org_id=uuid.UUID(user.org_id), created_by=uuid.UUID(user.id), payload=payload
    )
    return PurchaseOrderOut.model_validate(po)


@router.get("", response_model=PaginatedPurchaseOrders)
def list_purchase_orders(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: Optional[POStatus] = Query(None, alias="status"),
    vendor_id: Optional[uuid.UUID] = Query(None),
    user: CurrentUser = Depends(require_po_view),
    service: PurchaseOrderService = Depends(get_po_service),
) -> PaginatedPurchaseOrders:
    return service.list_pos(
        org_id=uuid.UUID(user.org_id),
        page=page,
        page_size=page_size,
        status=status_filter,
        vendor_id=vendor_id,
    )


@router.get("/{po_id}", response_model=PurchaseOrderOut)
def get_purchase_order(
    po_id: uuid.UUID,
    user: CurrentUser = Depends(require_po_view),
    service: PurchaseOrderService = Depends(get_po_service),
) -> PurchaseOrderOut:
    po = service.get_po(org_id=uuid.UUID(user.org_id), po_id=po_id)
    return PurchaseOrderOut.model_validate(po)


@router.patch("/{po_id}", response_model=PurchaseOrderOut)
def update_purchase_order(
    po_id: uuid.UUID,
    payload: PurchaseOrderUpdate,
    user: CurrentUser = Depends(require_po_edit),
    service: PurchaseOrderService = Depends(get_po_service),
) -> PurchaseOrderOut:
    po = service.update_po(org_id=uuid.UUID(user.org_id), po_id=po_id, payload=payload)
    return PurchaseOrderOut.model_validate(po)


@router.delete("/{po_id}", status_code=status.HTTP_204_NO_CONTENT)
def cancel_purchase_order(
    po_id: uuid.UUID,
    user: CurrentUser = Depends(require_po_cancel),
    service: PurchaseOrderService = Depends(get_po_service),
) -> None:
    service.cancel_po(org_id=uuid.UUID(user.org_id), po_id=po_id)
