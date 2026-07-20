import uuid
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status

from app.core.deps import CurrentUser
from app.modules.labour.dependencies import (
    get_attendance_service,
    require_attendance_create,
    require_worker_view,
)
from app.modules.labour.schemas.labour_schema import (
    AttendanceCreate,
    AttendanceOut,
    SiteLabourSummaryItem,
)
from app.modules.labour.services.labour_service import AttendanceService

router = APIRouter(prefix="/sites/{site_id}/labour", tags=["site-labour"])


@router.get("/summary", response_model=List[SiteLabourSummaryItem])
def get_site_labour_summary(
    site_id: uuid.UUID,
    date_from: Optional[date] = Query(None, alias="from"),
    date_to: Optional[date] = Query(None, alias="to"),
    user: CurrentUser = Depends(require_worker_view),
    service: AttendanceService = Depends(get_attendance_service),
) -> List[SiteLabourSummaryItem]:
    return service.wage_summary(
        org_id=uuid.UUID(user.org_id), site_id=site_id, date_from=date_from, date_to=date_to
    )


@router.get("/attendance", response_model=List[AttendanceOut])
def list_site_attendance(
    site_id: uuid.UUID,
    work_date: Optional[date] = Query(None, alias="date"),
    user: CurrentUser = Depends(require_worker_view),
    service: AttendanceService = Depends(get_attendance_service),
) -> List[AttendanceOut]:
    entries = service.list_attendance(
        org_id=uuid.UUID(user.org_id), site_id=site_id, work_date=work_date
    )
    return [AttendanceOut.model_validate(e) for e in entries]


@router.post("/attendance", response_model=AttendanceOut, status_code=status.HTTP_201_CREATED)
def mark_site_attendance(
    site_id: uuid.UUID,
    payload: AttendanceCreate,
    user: CurrentUser = Depends(require_attendance_create),
    service: AttendanceService = Depends(get_attendance_service),
) -> AttendanceOut:
    entry = service.mark_attendance(
        org_id=uuid.UUID(user.org_id),
        site_id=site_id,
        created_by=uuid.UUID(user.id),
        payload=payload,
    )
    return AttendanceOut.model_validate(entry)
