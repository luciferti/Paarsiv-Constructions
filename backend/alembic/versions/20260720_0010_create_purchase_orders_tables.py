"""create purchase_orders and purchase_order_lines tables

Revision ID: 20260720_0010
Revises: 20260720_0009
Create Date: 2026-07-20

Purchase orders (header + line items). Additive only. Creates its own enum
with the idempotent DO-block guard, then references it with create_type=False.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260720_0010"
down_revision: Union[str, None] = "20260720_0009"
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
    _create_enum_if_absent(
        "po_status",
        ["draft", "sent", "partially_received", "received", "closed", "cancelled"],
    )
    po_status_enum = postgresql.ENUM(
        "draft", "sent", "partially_received", "received", "closed", "cancelled",
        name="po_status", create_type=False,
    )

    op.create_table(
        "purchase_orders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("po_number", sa.String(50), nullable=False),
        sa.Column("vendor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("vendors.id"), nullable=False),
        sa.Column("site_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sites.id"), nullable=True),
        sa.Column("status", po_status_enum, nullable=False, server_default="draft"),
        sa.Column("order_date", sa.Date(), nullable=False),
        sa.Column("expected_date", sa.Date(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("org_id", "po_number", name="uq_po_org_number"),
    )
    op.create_index("ix_purchase_orders_org_id", "purchase_orders", ["org_id"])
    op.create_index("ix_purchase_orders_vendor_id", "purchase_orders", ["vendor_id"])
    op.create_index("ix_purchase_orders_site_id", "purchase_orders", ["site_id"])

    op.create_table(
        "purchase_order_lines",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("po_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("material_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("materials.id"), nullable=True),
        sa.Column("description", sa.String(255), nullable=False),
        sa.Column("quantity", sa.Numeric(12, 2), nullable=False),
        sa.Column("unit", sa.String(20), nullable=True),
        sa.Column("unit_price", sa.Numeric(12, 2), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_purchase_order_lines_po_id", "purchase_order_lines", ["po_id"])


def downgrade() -> None:
    op.drop_table("purchase_order_lines")
    op.drop_table("purchase_orders")
    op.execute("DROP TYPE IF EXISTS po_status")
