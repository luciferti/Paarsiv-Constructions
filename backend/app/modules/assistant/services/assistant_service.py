import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple

from sqlalchemy.orm import Session

from app.modules.assistant.models.assistant_model import (
    AssistantMessage,
    MessageChannel,
    MessageRole,
)
from app.modules.assistant.repositories.assistant_repository import AssistantRepository
from app.modules.assistant.services.answer_engine import (
    AnswerProvider,
    AssistantContext,
    get_answer_provider,
)


class AssistantService:
    def __init__(self, db: Session, provider: Optional[AnswerProvider] = None):
        self.db = db
        self.repo = AssistantRepository(db)
        self.provider = provider or get_answer_provider()

    def ask(
        self,
        org_id: uuid.UUID,
        question: str,
        channel: MessageChannel = MessageChannel.WEB,
        created_by: Optional[uuid.UUID] = None,
        sender_phone: Optional[str] = None,
    ) -> Tuple[AssistantMessage, AssistantMessage]:
        context = AssistantContext(self.db, org_id)
        answer_text = self.provider.answer(question, context)

        # Explicit microsecond timestamps: the DB server default has
        # second resolution on SQLite, which made the user/assistant
        # ordering within one exchange nondeterministic.
        now = datetime.now(timezone.utc)
        user_message = self.repo.create(
            AssistantMessage(
                org_id=org_id,
                role=MessageRole.USER,
                channel=channel,
                content=question,
                created_by=created_by,
                sender_phone=sender_phone,
                created_at=now,
            )
        )
        assistant_message = self.repo.create(
            AssistantMessage(
                org_id=org_id,
                role=MessageRole.ASSISTANT,
                channel=channel,
                content=answer_text,
                sender_phone=sender_phone,
                created_at=now + timedelta(microseconds=1),
            )
        )
        self.db.commit()
        self.db.refresh(user_message)
        self.db.refresh(assistant_message)
        return user_message, assistant_message

    def history(
        self, org_id: uuid.UUID, channel: MessageChannel = MessageChannel.WEB
    ) -> List[AssistantMessage]:
        return self.repo.history(org_id, channel)
