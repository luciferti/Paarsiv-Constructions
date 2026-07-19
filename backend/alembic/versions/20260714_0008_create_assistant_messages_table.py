"""create assistant_messages table

Revision ID: 20260714_0008
Revises: 20260714_0007
Create Date: 2026-07-19

Purely additive migration — no existing HRMS tables are modified.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260714_0008"
down_revision: Union[str, None] = "20260714_0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # assistant enums created in 0000 base migration
    role_enum = postgresql.ENUM("user", "assistant", name="assistant_message_role")
    channel_enum = postgresql.ENUM("web", "whatsapp", name="assistant_message_channel")

    op.create_table(
        "assistant_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("role", role_enum, nullable=False),
        sa.Column("channel", channel_enum, nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("sender_phone", sa.String(30), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_assistant_messages_org_id", "assistant_messages", ["org_id"])


def downgrade() -> None:
    op.drop_table("assistant_messages")
