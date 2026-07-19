"""create sites and site_team_members tables

Revision ID: 20260714_0001
Revises: 20260714_0000
Create Date: 2026-07-14

Purely additive migration — no existing HRMS tables are modified.
Assumes `organizations`, `projects`, and `employees` tables already
exist in the target database (owned by existing HRMS modules).
Before running, set `down_revision` below to the current head
revision of the existing HRMS migration chain.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260714_0001"
down_revision: Union[str, None] = "20260714_0000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # site_status enum created in 0000 base migration
    site_status_enum = postgresql.ENUM(
        "planning", "active", "on_hold", "completed", "archived", name="site_status"
    )

    op.create_table(
        "sites",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("projects.id"), nullable=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("code", sa.String(50), nullable=False),
        sa.Column("address_line", sa.String(255), nullable=True),
        sa.Column("city", sa.String(100), nullable=True),
        sa.Column("state", sa.String(100), nullable=True),
        sa.Column("country", sa.String(100), nullable=True),
        sa.Column("postal_code", sa.String(20), nullable=True),
        sa.Column("latitude", sa.Numeric(9, 6), nullable=True),
        sa.Column("longitude", sa.Numeric(9, 6), nullable=True),
        sa.Column("site_type", sa.String(50), nullable=True),
        sa.Column("status", site_status_enum, nullable=False, server_default="planning"),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("expected_end_date", sa.Date(), nullable=True),
        sa.Column("actual_end_date", sa.Date(), nullable=True),
        sa.Column("site_manager_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("employees.id"), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("org_id", "code", name="uq_sites_org_code"),
    )
    op.create_index("ix_sites_org_id", "sites", ["org_id"])
    op.create_index("ix_sites_project_id", "sites", ["project_id"])
    op.create_index("ix_sites_status", "sites", ["status"])

    op.create_table(
        "site_team_members",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("site_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sites.id", ondelete="CASCADE"), nullable=False),
        sa.Column("employee_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("employees.id"), nullable=False),
        sa.Column("role_on_site", sa.String(50), nullable=False),
        sa.Column("assigned_at", sa.Date(), nullable=False),
        sa.UniqueConstraint("site_id", "employee_id", name="uq_site_team_member"),
    )
    op.create_index("ix_site_team_members_site_id", "site_team_members", ["site_id"])
    op.create_index("ix_site_team_members_employee_id", "site_team_members", ["employee_id"])


def downgrade() -> None:
    op.drop_table("site_team_members")
    op.drop_table("sites")
