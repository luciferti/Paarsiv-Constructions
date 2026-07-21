from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_permission
from app.modules.progress.services.progress_service import ProgressService

require_progress_view = require_permission("progress:view")
require_progress_edit = require_permission("progress:edit")


def get_progress_service(db: Session = Depends(get_db)) -> ProgressService:
    return ProgressService(db)
