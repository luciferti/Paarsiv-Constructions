import uuid
from typing import List

from fastapi import APIRouter, Depends, status

from app.core.deps import CurrentUser
from app.modules.site.dependencies import (
    get_site_service,
    require_site_team_manage,
    require_site_view,
)
from app.modules.site.schemas.site_schema import SiteTeamMemberCreate, SiteTeamMemberOut
from app.modules.site.services.site_service import SiteService

router = APIRouter(prefix="/sites/{site_id}/team", tags=["site-team"])


@router.get("", response_model=List[SiteTeamMemberOut])
def list_team_members(
    site_id: uuid.UUID,
    user: CurrentUser = Depends(require_site_view),
    service: SiteService = Depends(get_site_service),
) -> List[SiteTeamMemberOut]:
    members = service.list_team_members(org_id=uuid.UUID(user.org_id), site_id=site_id)
    return [SiteTeamMemberOut.model_validate(m) for m in members]


@router.post("", response_model=SiteTeamMemberOut, status_code=status.HTTP_201_CREATED)
def add_team_member(
    site_id: uuid.UUID,
    payload: SiteTeamMemberCreate,
    user: CurrentUser = Depends(require_site_team_manage),
    service: SiteService = Depends(get_site_service),
) -> SiteTeamMemberOut:
    member = service.add_team_member(org_id=uuid.UUID(user.org_id), site_id=site_id, payload=payload)
    return SiteTeamMemberOut.model_validate(member)


@router.delete("/{employee_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_team_member(
    site_id: uuid.UUID,
    employee_id: uuid.UUID,
    user: CurrentUser = Depends(require_site_team_manage),
    service: SiteService = Depends(get_site_service),
) -> None:
    service.remove_team_member(org_id=uuid.UUID(user.org_id), site_id=site_id, employee_id=employee_id)
