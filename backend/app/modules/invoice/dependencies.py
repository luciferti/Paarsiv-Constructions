from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_permission
from app.modules.invoice.services.invoice_service import InvoiceService

require_invoice_view = require_permission("invoice:view")
require_invoice_upload = require_permission("invoice:upload")
require_invoice_review = require_permission("invoice:review")


def get_invoice_service(db: Session = Depends(get_db)) -> InvoiceService:
    return InvoiceService(db)
