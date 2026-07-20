from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_permission
from app.modules.purchase.services.po_service import PurchaseOrderService

require_po_view = require_permission("po:view")
require_po_create = require_permission("po:create")
require_po_edit = require_permission("po:edit")
require_po_cancel = require_permission("po:cancel")


def get_po_service(db: Session = Depends(get_db)) -> PurchaseOrderService:
    return PurchaseOrderService(db)
