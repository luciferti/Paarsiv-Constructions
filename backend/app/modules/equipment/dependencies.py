from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_permission
from app.modules.equipment.services.equipment_service import (
    EquipmentService,
    MaintenanceService,
    UsageService,
)

require_equipment_view = require_permission("equipment:view")
require_equipment_create = require_permission("equipment:create")
require_equipment_edit = require_permission("equipment:edit")
require_equipment_archive = require_permission("equipment:archive")
require_usage_create = require_permission("equipment:usage:create")
require_maintenance_create = require_permission("equipment:maintenance:create")


def get_equipment_service(db: Session = Depends(get_db)) -> EquipmentService:
    return EquipmentService(db)


def get_usage_service(db: Session = Depends(get_db)) -> UsageService:
    return UsageService(db)


def get_maintenance_service(db: Session = Depends(get_db)) -> MaintenanceService:
    return MaintenanceService(db)
