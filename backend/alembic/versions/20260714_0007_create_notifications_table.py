"""create notifications table

Revision ID: 20260714_0007
Revises: 20260714_0006
Create Date: 2026-07-14

Purely additive migration — no existing HRMS tables are modified.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260714_0007"
down_revision: Union[str, None] = "20260714_0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

notification_status_enum = postgresql.ENUM("sent", "logged", "failed", name="notification_status")


def upgrade() -> None:

    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("site_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sites.id"), nullable=True),
        sa.Column("recipient_name", sa.String(255), nullable=True),
        sa.Column("recipient_phone", sa.String(30), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("status", notification_status_enum, nullable=False),
        sa.Column("provider_used", sa.String(50), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_notifications_org_id", "notifications", ["org_id"])
    op.create_index("ix_notifications_site_id", "notifications", ["site_id"])


def downgrade() -> None:
    op.drop_table("notifications")
    # notification_status enum dropped in 0000 downgrade
