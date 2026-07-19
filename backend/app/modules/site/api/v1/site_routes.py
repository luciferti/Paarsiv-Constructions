import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, status

from app.core.deps import CurrentUser
from app.modules.site.dependencies import (
    get_site_service,
    require_site_archive,
    require_site_create,
    require_site_edit,
    require_site_view,
)
from app.modules.site.models.site_model import SiteStatus
from app.modules.site.schemas.site_schema import (
    PaginatedSites,
    SiteCreate,
    SiteOut,
    SiteUpdate,
)
from app.modules.site.services.site_service import SiteService

router = APIRouter(prefix="/sites", tags=["sites"])


@router.post("", response_model=SiteOut, status_code=status.HTTP_201_CREATED)
def create_site(
    payload: SiteCreate,
    user: CurrentUser = Depends(require_site_create),
    service: SiteService = Depends(get_site_service),
) -> SiteOut:
    site = service.create_site(
        org_id=uuid.UUID(user.org_id), created_by=uuid.UUID(user.id), payload=payload
    )
    return SiteOut.model_validate(site)


@router.get("", response_model=PaginatedSites)
def list_sites(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: Optional[SiteStatus] = Query(None, alias="status"),
    project_id: Optional[uuid.UUID] = Query(None),
    user: CurrentUser = Depends(require_site_view),
    service: SiteService = Depends(get_site_service),
) -> PaginatedSites:
    return service.list_sites(
        org_id=uuid.UUID(user.org_id),
        page=page,
        page_size=page_size,
        status=status_filter,
        project_id=project_id,
    )


@router.get("/{site_id}", response_model=SiteOut)
def get_site(
    site_id: uuid.UUID,
    user: CurrentUser = Depends(require_site_view),
    service: SiteService = Depends(get_site_service),
) -> SiteOut:
    site = service.get_site(org_id=uuid.UUID(user.org_id), site_id=site_id)
    return SiteOut.model_validate(site)


@router.patch("/{site_id}", response_model=SiteOut)
def update_site(
    site_id: uuid.UUID,
    payload: SiteUpdate,
    user: CurrentUser = Depends(require_site_edit),
    service: SiteService = Depends(get_site_service),
) -> SiteOut:
    site = service.update_site(org_id=uuid.UUID(user.org_id), site_id=site_id, payload=payload)
    return SiteOut.model_validate(site)


@router.delete("/{site_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_site(
    site_id: uuid.UUID,
    user: CurrentUser = Depends(require_site_archive),
    service: SiteService = Depends(get_site_service),
) -> None:
    service.archive_site(org_id=uuid.UUID(user.org_id), site_id=site_id)
