import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import CurrentUser, require_permission
from app.modules.dashboard.schemas.dashboard_schema import DashboardSummary
from app.modules.dashboard.services.dashboard_service import DashboardService

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

require_dashboard_view = require_permission("dashboard:view")


@router.get("/summary", response_model=DashboardSummary)
def get_dashboard_summary(
    user: CurrentUser = Depends(require_dashboard_view),
    db: Session = Depends(get_db),
) -> DashboardSummary:
    return DashboardService(db).get_summary(org_id=uuid.UUID(user.org_id))
