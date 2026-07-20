from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_permission
from app.modules.billing.services.billing_service import BillingService

require_bill_view = require_permission("bill:view")
require_bill_create = require_permission("bill:create")
require_bill_edit = require_permission("bill:edit")
require_bill_delete = require_permission("bill:delete")


def get_billing_service(db: Session = Depends(get_db)) -> BillingService:
    return BillingService(db)
