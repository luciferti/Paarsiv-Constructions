"""create site_ai_summaries table

Revision ID: 20260714_0006
Revises: 20260714_0005
Create Date: 2026-07-14

Purely additive migration — no existing HRMS tables are modified.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260714_0006"
down_revision: Union[str, None] = "20260714_0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "site_ai_summaries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("site_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sites.id"), nullable=False),
        sa.Column("summary_text", sa.Text(), nullable=False),
        sa.Column("source_report_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("model_used", sa.String(50), nullable=False),
        sa.Column("generated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("site_id", name="uq_site_ai_summaries_site"),
    )
    op.create_index("ix_site_ai_summaries_org_id", "site_ai_summaries", ["org_id"])


def downgrade() -> None:
    op.drop_table("site_ai_summaries")
