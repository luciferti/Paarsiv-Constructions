from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_permission
from app.modules.summary.services.summary_service import SummaryService

require_summary_view = require_permission("summary:view")
require_summary_generate = require_permission("summary:generate")


def get_summary_service(db: Session = Depends(get_db)) -> SummaryService:
    return SummaryService(db)
