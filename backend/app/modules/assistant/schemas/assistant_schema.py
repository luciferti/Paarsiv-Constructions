import uuid
from datetime import datetime
from typing import List

from pydantic import BaseModel, ConfigDict, Field

from app.modules.assistant.models.assistant_model import MessageChannel, MessageRole


class AssistantAsk(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)


class AssistantMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    role: MessageRole
    channel: MessageChannel
    content: str
    created_at: datetime


class AssistantReply(BaseModel):
    user_message: AssistantMessageOut
    assistant_message: AssistantMessageOut


class AssistantHistory(BaseModel):
    items: List[AssistantMessageOut]
