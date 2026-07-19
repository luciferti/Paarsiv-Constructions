import uuid

from fastapi import APIRouter, Depends, status

from app.core.deps import CurrentUser
from app.modules.summary.dependencies import (
    get_summary_service,
    require_summary_generate,
    require_summary_view,
)
from app.modules.summary.schemas.summary_schema import SiteAISummaryOut
from app.modules.summary.services.summary_service import SummaryService

router = APIRouter(prefix="/sites/{site_id}/ai-summary", tags=["site-ai-summary"])


@router.get("", response_model=SiteAISummaryOut)
def get_summary(
    site_id: uuid.UUID,
    user: CurrentUser = Depends(require_summary_view),
    service: SummaryService = Depends(get_summary_service),
) -> SiteAISummaryOut:
    summary = service.get_summary(org_id=uuid.UUID(user.org_id), site_id=site_id)
    return SiteAISummaryOut.model_validate(summary)


@router.post("", response_model=SiteAISummaryOut, status_code=status.HTTP_201_CREATED)
def generate_summary(
    site_id: uuid.UUID,
    user: CurrentUser = Depends(require_summary_generate),
    service: SummaryService = Depends(get_summary_service),
) -> SiteAISummaryOut:
    summary = service.generate_summary(
        org_id=uuid.UUID(user.org_id), site_id=site_id, created_by=uuid.UUID(user.id)
    )
    return SiteAISummaryOut.model_validate(summary)
