"""create subcontractors, work_orders, work_order_payments tables

Revision ID: 20260720_0014
Revises: 20260720_0013
Create Date: 2026-07-20

Subcontractors + work orders + payments. Additive. Own enums via idempotent
DO-block guards, referenced with create_type=False.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260720_0014"
down_revision: Union[str, None] = "20260720_0013"
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
    _create_enum_if_absent("subcontractor_status", ["active", "inactive"])
    _create_enum_if_absent("wo_status", ["open", "in_progress", "completed", "closed", "cancelled"])

    sub_status = postgresql.ENUM(
        "active", "inactive", name="subcontractor_status", create_type=False
    )
    wo_status = postgresql.ENUM(
        "open", "in_progress", "completed", "closed", "cancelled",
        name="wo_status", create_type=False,
    )

    op.create_table(
        "subcontractors",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("code", sa.String(50), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("trade", sa.String(50), nullable=True),
        sa.Column("contact_name", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(30), nullable=True),
        sa.Column("status", sub_status, nullable=False, server_default="active"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("org_id", "code", name="uq_subcontractor_org_code"),
    )
    op.create_index("ix_subcontractors_org_id", "subcontractors", ["org_id"])

    op.create_table(
        "work_orders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("wo_number", sa.String(50), nullable=False),
        sa.Column("site_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sites.id"), nullable=False),
        sa.Column("subcontractor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("subcontractors.id"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("order_date", sa.Date(), nullable=False),
        sa.Column("wo_value", sa.Numeric(14, 2), nullable=False),
        sa.Column("progress_percent", sa.Numeric(5, 2), nullable=False, server_default="0"),
        sa.Column("status", wo_status, nullable=False, server_default="open"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("org_id", "wo_number", name="uq_work_order_org_number"),
    )
    op.create_index("ix_work_orders_org_id", "work_orders", ["org_id"])
    op.create_index("ix_work_orders_site_id", "work_orders", ["site_id"])
    op.create_index("ix_work_orders_subcontractor_id", "work_orders", ["subcontractor_id"])

    op.create_table(
        "work_order_payments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("wo_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("work_orders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("payment_date", sa.Date(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_work_order_payments_wo_id", "work_order_payments", ["wo_id"])


def downgrade() -> None:
    op.drop_table("work_order_payments")
    op.drop_table("work_orders")
    op.drop_table("subcontractors")
    op.execute("DROP TYPE IF EXISTS wo_status")
    op.execute("DROP TYPE IF EXISTS subcontractor_status")
