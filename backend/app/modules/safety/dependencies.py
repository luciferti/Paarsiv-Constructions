from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_permission
from app.modules.safety.services.safety_service import SafetyService

require_safety_view = require_permission("safety:view")
require_safety_create = require_permission("safety:create")
require_safety_edit = require_permission("safety:edit")
require_safety_delete = require_permission("safety:delete")


def get_safety_service(db: Session = Depends(get_db)) -> SafetyService:
    return SafetyService(db)
