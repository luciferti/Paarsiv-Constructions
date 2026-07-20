import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, status

from app.core.deps import CurrentUser
from app.modules.subcontract.dependencies import (
    get_subcontractor_service,
    require_sub_archive,
    require_sub_create,
    require_sub_edit,
    require_sub_view,
)
from app.modules.subcontract.models.subcontract_model import SubcontractorStatus
from app.modules.subcontract.schemas.subcontract_schema import (
    PaginatedSubcontractors,
    SubcontractorCreate,
    SubcontractorOut,
    SubcontractorUpdate,
)
from app.modules.subcontract.services.subcontract_service import SubcontractorService

router = APIRouter(prefix="/subcontractors", tags=["subcontractors"])


@router.post("", response_model=SubcontractorOut, status_code=status.HTTP_201_CREATED)
def create_subcontractor(
    payload: SubcontractorCreate,
    user: CurrentUser = Depends(require_sub_create),
    service: SubcontractorService = Depends(get_subcontractor_service),
) -> SubcontractorOut:
    sub = service.create(uuid.UUID(user.org_id), uuid.UUID(user.id), payload)
    return SubcontractorOut.model_validate(sub)


@router.get("", response_model=PaginatedSubcontractors)
def list_subcontractors(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: Optional[SubcontractorStatus] = Query(None, alias="status"),
    user: CurrentUser = Depends(require_sub_view),
    service: SubcontractorService = Depends(get_subcontractor_service),
) -> PaginatedSubcontractors:
    return service.list(uuid.UUID(user.org_id), page=page, page_size=page_size, status=status_filter)


@router.get("/{sub_id}", response_model=SubcontractorOut)
def get_subcontractor(
    sub_id: uuid.UUID,
    user: CurrentUser = Depends(require_sub_view),
    service: SubcontractorService = Depends(get_subcontractor_service),
) -> SubcontractorOut:
    return SubcontractorOut.model_validate(service.get(uuid.UUID(user.org_id), sub_id))


@router.patch("/{sub_id}", response_model=SubcontractorOut)
def update_subcontractor(
    sub_id: uuid.UUID,
    payload: SubcontractorUpdate,
    user: CurrentUser = Depends(require_sub_edit),
    service: SubcontractorService = Depends(get_subcontractor_service),
) -> SubcontractorOut:
    return SubcontractorOut.model_validate(service.update(uuid.UUID(user.org_id), sub_id, payload))


@router.delete("/{sub_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_subcontractor(
    sub_id: uuid.UUID,
    user: CurrentUser = Depends(require_sub_archive),
    service: SubcontractorService = Depends(get_subcontractor_service),
) -> None:
    service.archive(uuid.UUID(user.org_id), sub_id)
