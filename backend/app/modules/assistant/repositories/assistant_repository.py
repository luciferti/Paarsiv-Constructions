import uuid
from typing import List

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.assistant.models.assistant_model import AssistantMessage, MessageChannel


class AssistantRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, message: AssistantMessage) -> AssistantMessage:
        self.db.add(message)
        self.db.flush()
        return message

    def history(
        self, org_id: uuid.UUID, channel: MessageChannel, limit: int = 50
    ) -> List[AssistantMessage]:
        stmt = (
            select(AssistantMessage)
            .where(AssistantMessage.org_id == org_id, AssistantMessage.channel == channel)
            .order_by(AssistantMessage.created_at.desc(), AssistantMessage.id.desc())
            .limit(limit)
        )
        rows = list(self.db.execute(stmt).scalars().all())
        rows.reverse()
        return rows
