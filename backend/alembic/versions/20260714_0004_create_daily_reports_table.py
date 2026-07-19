"""create daily_reports table

Revision ID: 20260714_0004
Revises: 20260714_0003
Create Date: 2026-07-14

Purely additive migration — no existing HRMS tables are modified.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260714_0004"
down_revision: Union[str, None] = "20260714_0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "daily_reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("site_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sites.id"), nullable=False),
        sa.Column("report_date", sa.Date(), nullable=False),
        sa.Column("manpower_count", sa.Integer(), nullable=True),
        sa.Column("weather", sa.Text(), nullable=True),
        sa.Column("work_summary", sa.Text(), nullable=False),
        sa.Column("issues", sa.Text(), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("site_id", "report_date", name="uq_daily_reports_site_date"),
    )
    op.create_index("ix_daily_reports_org_id", "daily_reports", ["org_id"])
    op.create_index("ix_daily_reports_site_id", "daily_reports", ["site_id"])


def downgrade() -> None:
    op.drop_table("daily_reports")
