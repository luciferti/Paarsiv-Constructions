import uuid
from typing import List

from fastapi import APIRouter, Depends, status

from app.core.deps import CurrentUser
from app.modules.progress.dependencies import (
    get_progress_service,
    require_progress_edit,
    require_progress_view,
)
from app.modules.progress.schemas.progress_schema import (
    MilestoneCreate,
    MilestoneOut,
    MilestoneUpdate,
    SiteProgressSummary,
)
from app.modules.progress.services.progress_service import ProgressService

router = APIRouter(prefix="/sites/{site_id}/milestones", tags=["site-progress"])


@router.get("/summary", response_model=SiteProgressSummary)
def get_site_progress(
    site_id: uuid.UUID,
    user: CurrentUser = Depends(require_progress_view),
    service: ProgressService = Depends(get_progress_service),
) -> SiteProgressSummary:
    return service.summary(org_id=uuid.UUID(user.org_id), site_id=site_id)


@router.get("", response_model=List[MilestoneOut])
def list_milestones(
    site_id: uuid.UUID,
    user: CurrentUser = Depends(require_progress_view),
    service: ProgressService = Depends(get_progress_service),
) -> List[MilestoneOut]:
    return service.summary(org_id=uuid.UUID(user.org_id), site_id=site_id).milestones


@router.post("", response_model=MilestoneOut, status_code=status.HTTP_201_CREATED)
def add_milestone(
    site_id: uuid.UUID,
    payload: MilestoneCreate,
    user: CurrentUser = Depends(require_progress_edit),
    service: ProgressService = Depends(get_progress_service),
) -> MilestoneOut:
    m = service.add_milestone(
        org_id=uuid.UUID(user.org_id), site_id=site_id, created_by=uuid.UUID(user.id), payload=payload
    )
    return MilestoneOut.model_validate(m)


@router.patch("/{milestone_id}", response_model=MilestoneOut)
def update_milestone(
    site_id: uuid.UUID,
    milestone_id: uuid.UUID,
    payload: MilestoneUpdate,
    user: CurrentUser = Depends(require_progress_edit),
    service: ProgressService = Depends(get_progress_service),
) -> MilestoneOut:
    return MilestoneOut.model_validate(
        service.update(org_id=uuid.UUID(user.org_id), milestone_id=milestone_id, payload=payload)
    )


@router.delete("/{milestone_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_milestone(
    site_id: uuid.UUID,
    milestone_id: uuid.UUID,
    user: CurrentUser = Depends(require_progress_edit),
    service: ProgressService = Depends(get_progress_service),
) -> None:
    service.delete(org_id=uuid.UUID(user.org_id), milestone_id=milestone_id)
