import enum
import uuid
from typing import Optional

from sqlalchemy import Enum, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.mixins import OrgScopedMixin, TimestampMixin, UUIDPrimaryKeyMixin


class MessageRole(str, enum.Enum):
    USER = "user"
    ASSISTANT = "assistant"


class MessageChannel(str, enum.Enum):
    WEB = "web"
    WHATSAPP = "whatsapp"


class AssistantMessage(UUIDPrimaryKeyMixin, OrgScopedMixin, TimestampMixin, Base):
    __tablename__ = "assistant_messages"

    role: Mapped[MessageRole] = mapped_column(
        Enum(MessageRole, name="assistant_message_role"), nullable=False
    )
    channel: Mapped[MessageChannel] = mapped_column(
        Enum(MessageChannel, name="assistant_message_channel"), nullable=False
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # WhatsApp sender number for channel=whatsapp; null for web.
    sender_phone: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid(as_uuid=True), nullable=True)
