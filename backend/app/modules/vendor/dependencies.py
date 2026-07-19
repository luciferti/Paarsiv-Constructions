from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_permission
from app.modules.vendor.services.vendor_service import VendorService

require_vendor_view = require_permission("vendor:view")
require_vendor_create = require_permission("vendor:create")
require_vendor_edit = require_permission("vendor:edit")
require_vendor_archive = require_permission("vendor:archive")


def get_vendor_service(db: Session = Depends(get_db)) -> VendorService:
    return VendorService(db)
