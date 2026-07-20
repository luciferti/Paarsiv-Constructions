"""create cash_entries table (petty cash / expenses)

Revision ID: 20260720_0012
Revises: 20260720_0011
Create Date: 2026-07-20

Petty-cash ledger: topups and expenses. Additive. Creates its own enum with
the idempotent DO-block guard, referenced with create_type=False.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260720_0012"
down_revision: Union[str, None] = "20260720_0011"
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
    _create_enum_if_absent("cash_entry_type", ["topup", "expense"])
    cash_entry_type_enum = postgresql.ENUM(
        "topup", "expense", name="cash_entry_type", create_type=False
    )

    op.create_table(
        "cash_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("site_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sites.id"), nullable=True),
        sa.Column("entry_type", cash_entry_type_enum, nullable=False),
        sa.Column("category", sa.String(50), nullable=True),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("entry_date", sa.Date(), nullable=False),
        sa.Column("paid_to", sa.String(255), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_cash_entries_org_id", "cash_entries", ["org_id"])
    op.create_index("ix_cash_entries_site_id", "cash_entries", ["site_id"])
    op.create_index("ix_cash_entries_entry_date", "cash_entries", ["entry_date"])


def downgrade() -> None:
    op.drop_table("cash_entries")
    op.execute("DROP TYPE IF EXISTS cash_entry_type")
