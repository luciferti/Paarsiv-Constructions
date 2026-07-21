"""create milestones table

Revision ID: 20260720_0016
Revises: 20260720_0015
Create Date: 2026-07-20

Per-site schedule milestones with % completion. Additive. Own enum via
idempotent DO-block guard, referenced with create_type=False.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260720_0016"
down_revision: Union[str, None] = "20260720_0015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _create_enum_if_absent(name: str, values: Sequence[str]) -> None:
    labels = ", ".join(f"'{v}'" for v in values)
    op.execute(
        f"""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '{name}') THEN
                CREATE TYPE {name} AS ENUM ({labels});
            END IF;
        END
        $$;
        """
    )


def upgrade() -> None:
    _create_enum_if_absent("milestone_status", ["pending", "in_progress", "completed", "delayed"])
    ms_status = postgresql.ENUM(
        "pending", "in_progress", "completed", "delayed", name="milestone_status", create_type=False
    )

    op.create_table(
        "milestones",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("site_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sites.id"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("target_date", sa.Date(), nullable=True),
        sa.Column("actual_date", sa.Date(), nullable=True),
        sa.Column("progress_percent", sa.Numeric(5, 2), nullable=False, server_default="0"),
        sa.Column("weight", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("status", ms_status, nullable=False, server_default="pending"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_milestones_org_id", "milestones", ["org_id"])
    op.create_index("ix_milestones_site_id", "milestones", ["site_id"])


def downgrade() -> None:
    op.drop_table("milestones")
    op.execute("DROP TYPE IF EXISTS milestone_status")
