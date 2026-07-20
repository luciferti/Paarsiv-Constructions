from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_permission
from app.modules.subcontract.services.subcontract_service import (
    SubcontractorService,
    WorkOrderService,
)

require_sub_view = require_permission("subcontractor:view")
require_sub_create = require_permission("subcontractor:create")
require_sub_edit = require_permission("subcontractor:edit")
require_sub_archive = require_permission("subcontractor:archive")
require_wo_view = require_permission("workorder:view")
require_wo_create = require_permission("workorder:create")
require_wo_edit = require_permission("workorder:edit")
require_wo_delete = require_permission("workorder:delete")
require_wo_payment = require_permission("workorder:payment")


def get_subcontractor_service(db: Session = Depends(get_db)) -> SubcontractorService:
    return SubcontractorService(db)


def get_work_order_service(db: Session = Depends(get_db)) -> WorkOrderService:
    return WorkOrderService(db)
