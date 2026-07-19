import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, status

from app.core.deps import CurrentUser
from app.modules.vendor.dependencies import (
    get_vendor_service,
    require_vendor_archive,
    require_vendor_create,
    require_vendor_edit,
    require_vendor_view,
)
from app.modules.vendor.models.vendor_model import VendorStatus
from app.modules.vendor.schemas.vendor_schema import (
    PaginatedVendors,
    VendorCreate,
    VendorOut,
    VendorUpdate,
)
from app.modules.vendor.services.vendor_service import VendorService

router = APIRouter(prefix="/vendors", tags=["vendors"])


@router.post("", response_model=VendorOut, status_code=status.HTTP_201_CREATED)
def create_vendor(
    payload: VendorCreate,
    user: CurrentUser = Depends(require_vendor_create),
    service: VendorService = Depends(get_vendor_service),
) -> VendorOut:
    vendor = service.create_vendor(
        org_id=uuid.UUID(user.org_id), created_by=uuid.UUID(user.id), payload=payload
    )
    return VendorOut.model_validate(vendor)


@router.get("", response_model=PaginatedVendors)
def list_vendors(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: Optional[VendorStatus] = Query(None, alias="status"),
    category: Optional[str] = Query(None),
    user: CurrentUser = Depends(require_vendor_view),
    service: VendorService = Depends(get_vendor_service),
) -> PaginatedVendors:
    return service.list_vendors(
        org_id=uuid.UUID(user.org_id),
        page=page,
        page_size=page_size,
        status=status_filter,
        category=category,
    )


@router.get("/{vendor_id}", response_model=VendorOut)
def get_vendor(
    vendor_id: uuid.UUID,
    user: CurrentUser = Depends(require_vendor_view),
    service: VendorService = Depends(get_vendor_service),
) -> VendorOut:
    vendor = service.get_vendor(org_id=uuid.UUID(user.org_id), vendor_id=vendor_id)
    return VendorOut.model_validate(vendor)


@router.patch("/{vendor_id}", response_model=VendorOut)
def update_vendor(
    vendor_id: uuid.UUID,
    payload: VendorUpdate,
    user: CurrentUser = Depends(require_vendor_edit),
    service: VendorService = Depends(get_vendor_service),
) -> VendorOut:
    vendor = service.update_vendor(
        org_id=uuid.UUID(user.org_id), vendor_id=vendor_id, payload=payload
    )
    return VendorOut.model_validate(vendor)


@router.delete("/{vendor_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_vendor(
    vendor_id: uuid.UUID,
    user: CurrentUser = Depends(require_vendor_archive),
    service: VendorService = Depends(get_vendor_service),
) -> None:
    service.archive_vendor(org_id=uuid.UUID(user.org_id), vendor_id=vendor_id)
