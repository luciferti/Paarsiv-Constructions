from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_permission
from app.modules.assistant.services.assistant_service import AssistantService

require_assistant_use = require_permission("assistant:use")


def get_assistant_service(db: Session = Depends(get_db)) -> AssistantService:
    return AssistantService(db)
