from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_permission
from app.modules.report.services.report_service import ReportService

require_report_view = require_permission("report:view")
require_report_create = require_permission("report:create")
require_report_edit = require_permission("report:edit")


def get_report_service(db: Session = Depends(get_db)) -> ReportService:
    return ReportService(db)
