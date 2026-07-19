from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_permission
from app.modules.material.services.material_service import MaterialEntryService, MaterialService

require_material_view = require_permission("material:view")
require_material_create = require_permission("material:create")
require_material_edit = require_permission("material:edit")
require_material_archive = require_permission("material:archive")
require_material_entry_create = require_permission("material:entry:create")


def get_material_service(db: Session = Depends(get_db)) -> MaterialService:
    return MaterialService(db)


def get_material_entry_service(db: Session = Depends(get_db)) -> MaterialEntryService:
    return MaterialEntryService(db)
