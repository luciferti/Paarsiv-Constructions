from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_permission
from app.modules.labour.services.labour_service import AttendanceService, WorkerService

require_worker_view = require_permission("worker:view")
require_worker_create = require_permission("worker:create")
require_worker_edit = require_permission("worker:edit")
require_worker_archive = require_permission("worker:archive")
require_attendance_create = require_permission("labour:attendance:create")


def get_worker_service(db: Session = Depends(get_db)) -> WorkerService:
    return WorkerService(db)


def get_attendance_service(db: Session = Depends(get_db)) -> AttendanceService:
    return AttendanceService(db)
