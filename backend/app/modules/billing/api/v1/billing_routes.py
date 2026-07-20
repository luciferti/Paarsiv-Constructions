import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, status

from app.core.deps import CurrentUser
from app.modules.billing.dependencies import (
    get_billing_service,
    require_bill_create,
    require_bill_delete,
    require_bill_edit,
    require_bill_view,
)
from app.modules.billing.models.billing_model import BillStatus
from app.modules.billing.schemas.billing_schema import (
    ClientBillCreate,
    ClientBillingSummary,
    ClientBillOut,
    ClientBillUpdate,
    PaginatedClientBills,
)
from app.modules.billing.services.billing_service import BillingService

router = APIRouter(prefix="/client-bills", tags=["client-bills"])


@router.post("", response_model=ClientBillOut, status_code=status.HTTP_201_CREATED)
def create_bill(
    payload: ClientBillCreate,
    user: CurrentUser = Depends(require_bill_create),
    service: BillingService = Depends(get_billing_service),
) -> ClientBillOut:
    bill = service.create_bill(
        org_id=uuid.UUID(user.org_id), created_by=uuid.UUID(user.id), payload=payload
    )
    return ClientBillOut.model_validate(bill)


@router.get("/summary", response_model=ClientBillingSummary)
def billing_summary(
    site_id: Optional[uuid.UUID] = Query(None),
    user: CurrentUser = Depends(require_bill_view),
    service: BillingService = Depends(get_billing_service),
) -> ClientBillingSummary:
    return service.summary(org_id=uuid.UUID(user.org_id), site_id=site_id)


@router.get("", response_model=PaginatedClientBills)
def list_bills(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    site_id: Optional[uuid.UUID] = Query(None),
    status_filter: Optional[BillStatus] = Query(None, alias="status"),
    user: CurrentUser = Depends(require_bill_view),
    service: BillingService = Depends(get_billing_service),
) -> PaginatedClientBills:
    return service.list_bills(
        org_id=uuid.UUID(user.org_id),
        page=page,
        page_size=page_size,
        site_id=site_id,
        status=status_filter,
    )


@router.get("/{bill_id}", response_model=ClientBillOut)
def get_bill(
    bill_id: uuid.UUID,
    user: CurrentUser = Depends(require_bill_view),
    service: BillingService = Depends(get_billing_service),
) -> ClientBillOut:
    bill = service.get_bill(org_id=uuid.UUID(user.org_id), bill_id=bill_id)
    return ClientBillOut.model_validate(bill)


@router.patch("/{bill_id}", response_model=ClientBillOut)
def update_bill(
    bill_id: uuid.UUID,
    payload: ClientBillUpdate,
    user: CurrentUser = Depends(require_bill_edit),
    service: BillingService = Depends(get_billing_service),
) -> ClientBillOut:
    bill = service.update_bill(org_id=uuid.UUID(user.org_id), bill_id=bill_id, payload=payload)
    return ClientBillOut.model_validate(bill)


@router.delete("/{bill_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bill(
    bill_id: uuid.UUID,
    user: CurrentUser = Depends(require_bill_delete),
    service: BillingService = Depends(get_billing_service),
) -> None:
    service.delete_bill(org_id=uuid.UUID(user.org_id), bill_id=bill_id)
