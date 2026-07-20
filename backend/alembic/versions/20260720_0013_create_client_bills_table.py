"""create client_bills table (RA billing)

Revision ID: 20260720_0013
Revises: 20260720_0012
Create Date: 2026-07-20

Running-account client bills. Additive. Own enum via idempotent DO-block guard,
referenced with create_type=False.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260720_0013"
down_revision: Union[str, None] = "20260720_0012"
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
    _create_enum_if_absent("bill_status", ["draft", "submitted", "certified", "paid"])
    bill_status_enum = postgresql.ENUM(
        "draft", "submitted", "certified", "paid", name="bill_status", create_type=False
    )

    op.create_table(
        "client_bills",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("site_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sites.id"), nullable=False),
        sa.Column("bill_number", sa.String(50), nullable=False),
        sa.Column("bill_date", sa.Date(), nullable=False),
        sa.Column("gross_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("retention_percent", sa.Numeric(5, 2), nullable=False, server_default="0"),
        sa.Column("tds_percent", sa.Numeric(5, 2), nullable=False, server_default="0"),
        sa.Column("other_deductions", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("status", bill_status_enum, nullable=False, server_default="draft"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("org_id", "bill_number", name="uq_client_bill_org_number"),
    )
    op.create_index("ix_client_bills_org_id", "client_bills", ["org_id"])
    op.create_index("ix_client_bills_site_id", "client_bills", ["site_id"])


def downgrade() -> None:
    op.drop_table("client_bills")
    op.execute("DROP TYPE IF EXISTS bill_status")
