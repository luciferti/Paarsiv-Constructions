from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_permission
from app.modules.document.services.document_service import DocumentService

require_document_view = require_permission("document:view")
require_document_create = require_permission("document:create")
require_document_edit = require_permission("document:edit")
require_document_delete = require_permission("document:delete")


def get_document_service(db: Session = Depends(get_db)) -> DocumentService:
    return DocumentService(db)
