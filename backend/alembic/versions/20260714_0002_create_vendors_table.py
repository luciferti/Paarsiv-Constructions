"""create vendors table

Revision ID: 20260714_0002
Revises: 20260714_0001
Create Date: 2026-07-14

Purely additive migration — no existing HRMS tables are modified.
Assumes `organizations` already exists (owned by existing HRMS modules).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260714_0002"
down_revision: Union[str, None] = "20260714_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # vendor_status enum created in 0000 base migration
    vendor_status_enum = postgresql.ENUM("active", "inactive", "blacklisted", name="vendor_status")

    op.create_table(
        "vendors",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("code", sa.String(50), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("category", sa.String(50), nullable=True),
        sa.Column("contact_name", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(30), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("address_line", sa.String(255), nullable=True),
        sa.Column("city", sa.String(100), nullable=True),
        sa.Column("state", sa.String(100), nullable=True),
        sa.Column("country", sa.String(100), nullable=True),
        sa.Column("postal_code", sa.String(20), nullable=True),
        sa.Column("tax_id", sa.String(50), nullable=True),
        sa.Column("status", vendor_status_enum, nullable=False, server_default="active"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("org_id", "code", name="uq_vendors_org_code"),
    )
    op.create_index("ix_vendors_org_id", "vendors", ["org_id"])
    op.create_index("ix_vendors_status", "vendors", ["status"])


def downgrade() -> None:
    op.drop_table("vendors")
    vendor_status_enum.drop(op.get_bind(), checkfirst=True)
