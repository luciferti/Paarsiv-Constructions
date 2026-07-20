import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, status

from app.core.deps import CurrentUser
from app.modules.subcontract.dependencies import (
    get_work_order_service,
    require_wo_create,
    require_wo_delete,
    require_wo_edit,
    require_wo_payment,
    require_wo_view,
)
from app.modules.subcontract.models.subcontract_model import WorkOrderStatus
from app.modules.subcontract.schemas.subcontract_schema import (
    PaginatedWorkOrders,
    WorkOrderCreate,
    WorkOrderOut,
    WorkOrderPaymentCreate,
    WorkOrderUpdate,
)
from app.modules.subcontract.services.subcontract_service import WorkOrderService

router = APIRouter(prefix="/work-orders", tags=["work-orders"])


@router.post("", response_model=WorkOrderOut, status_code=status.HTTP_201_CREATED)
def create_work_order(
    payload: WorkOrderCreate,
    user: CurrentUser = Depends(require_wo_create),
    service: WorkOrderService = Depends(get_work_order_service),
) -> WorkOrderOut:
    wo = service.create(uuid.UUID(user.org_id), uuid.UUID(user.id), payload)
    return WorkOrderOut.model_validate(wo)


@router.get("", response_model=PaginatedWorkOrders)
def list_work_orders(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    site_id: Optional[uuid.UUID] = Query(None),
    status_filter: Optional[WorkOrderStatus] = Query(None, alias="status"),
    user: CurrentUser = Depends(require_wo_view),
    service: WorkOrderService = Depends(get_work_order_service),
) -> PaginatedWorkOrders:
    return service.list(
        uuid.UUID(user.org_id), page=page, page_size=page_size, site_id=site_id, status=status_filter
    )


@router.get("/{wo_id}", response_model=WorkOrderOut)
def get_work_order(
    wo_id: uuid.UUID,
    user: CurrentUser = Depends(require_wo_view),
    service: WorkOrderService = Depends(get_work_order_service),
) -> WorkOrderOut:
    return WorkOrderOut.model_validate(service.get(uuid.UUID(user.org_id), wo_id))


@router.patch("/{wo_id}", response_model=WorkOrderOut)
def update_work_order(
    wo_id: uuid.UUID,
    payload: WorkOrderUpdate,
    user: CurrentUser = Depends(require_wo_edit),
    service: WorkOrderService = Depends(get_work_order_service),
) -> WorkOrderOut:
    return WorkOrderOut.model_validate(service.update(uuid.UUID(user.org_id), wo_id, payload))


@router.post("/{wo_id}/payments", response_model=WorkOrderOut, status_code=status.HTTP_201_CREATED)
def add_work_order_payment(
    wo_id: uuid.UUID,
    payload: WorkOrderPaymentCreate,
    user: CurrentUser = Depends(require_wo_payment),
    service: WorkOrderService = Depends(get_work_order_service),
) -> WorkOrderOut:
    return WorkOrderOut.model_validate(service.add_payment(uuid.UUID(user.org_id), wo_id, payload))


@router.delete("/{wo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_work_order(
    wo_id: uuid.UUID,
    user: CurrentUser = Depends(require_wo_delete),
    service: WorkOrderService = Depends(get_work_order_service),
) -> None:
    service.delete(uuid.UUID(user.org_id), wo_id)
