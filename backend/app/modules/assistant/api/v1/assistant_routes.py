import uuid

from fastapi import APIRouter, Depends

from app.core.deps import CurrentUser
from app.modules.assistant.dependencies import get_assistant_service, require_assistant_use
from app.modules.assistant.models.assistant_model import MessageChannel
from app.modules.assistant.schemas.assistant_schema import (
    AssistantAsk,
    AssistantHistory,
    AssistantMessageOut,
    AssistantReply,
)
from app.modules.assistant.services.assistant_service import AssistantService

router = APIRouter(prefix="/assistant", tags=["assistant"])


@router.post("/messages", response_model=AssistantReply)
def ask_assistant(
    payload: AssistantAsk,
    user: CurrentUser = Depends(require_assistant_use),
    service: AssistantService = Depends(get_assistant_service),
) -> AssistantReply:
    user_message, assistant_message = service.ask(
        org_id=uuid.UUID(user.org_id),
        question=payload.message,
        channel=MessageChannel.WEB,
        created_by=uuid.UUID(user.id),
    )
    return AssistantReply(
        user_message=AssistantMessageOut.model_validate(user_message),
        assistant_message=AssistantMessageOut.model_validate(assistant_message),
    )


@router.get("/messages", response_model=AssistantHistory)
def assistant_history(
    user: CurrentUser = Depends(require_assistant_use),
    service: AssistantService = Depends(get_assistant_service),
) -> AssistantHistory:
    items = service.history(org_id=uuid.UUID(user.org_id), channel=MessageChannel.WEB)
    return AssistantHistory(items=[AssistantMessageOut.model_validate(m) for m in items])
