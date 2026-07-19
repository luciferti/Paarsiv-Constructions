import uuid
from typing import List

from fastapi import APIRouter, Depends, status

from app.core.deps import CurrentUser
from app.modules.report.dependencies import (
    get_report_service,
    require_report_create,
    require_report_edit,
    require_report_view,
)
from app.modules.report.schemas.report_schema import (
    DailyReportCreate,
    DailyReportOut,
    DailyReportUpdate,
)
from app.modules.report.services.report_service import ReportService

router = APIRouter(prefix="/sites/{site_id}/reports", tags=["site-reports"])


@router.post("", response_model=DailyReportOut, status_code=status.HTTP_201_CREATED)
def create_report(
    site_id: uuid.UUID,
    payload: DailyReportCreate,
    user: CurrentUser = Depends(require_report_create),
    service: ReportService = Depends(get_report_service),
) -> DailyReportOut:
    report = service.create_report(
        org_id=uuid.UUID(user.org_id),
        site_id=site_id,
        created_by=uuid.UUID(user.id),
        payload=payload,
    )
    return DailyReportOut.model_validate(report)


@router.get("", response_model=List[DailyReportOut])
def list_reports(
    site_id: uuid.UUID,
    user: CurrentUser = Depends(require_report_view),
    service: ReportService = Depends(get_report_service),
) -> List[DailyReportOut]:
    reports = service.list_reports(org_id=uuid.UUID(user.org_id), site_id=site_id)
    return [DailyReportOut.model_validate(r) for r in reports]


@router.get("/{report_id}", response_model=DailyReportOut)
def get_report(
    site_id: uuid.UUID,
    report_id: uuid.UUID,
    user: CurrentUser = Depends(require_report_view),
    service: ReportService = Depends(get_report_service),
) -> DailyReportOut:
    report = service.get_report(org_id=uuid.UUID(user.org_id), report_id=report_id)
    return DailyReportOut.model_validate(report)


@router.patch("/{report_id}", response_model=DailyReportOut)
def update_report(
    site_id: uuid.UUID,
    report_id: uuid.UUID,
    payload: DailyReportUpdate,
    user: CurrentUser = Depends(require_report_edit),
    service: ReportService = Depends(get_report_service),
) -> DailyReportOut:
    report = service.update_report(org_id=uuid.UUID(user.org_id), report_id=report_id, payload=payload)
    return DailyReportOut.model_validate(report)
