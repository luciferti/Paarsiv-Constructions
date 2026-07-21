"""create equipment, equipment_usage, equipment_maintenance tables

Revision ID: 20260720_0015
Revises: 20260720_0014
Create Date: 2026-07-20

Plant register + per-site usage + maintenance log. Additive. Own enums via
idempotent DO-block guards, referenced with create_type=False.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260720_0015"
down_revision: Union[str, None] = "20260720_0014"
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
    _create_enum_if_absent("equipment_ownership", ["owned", "rented"])
    _create_enum_if_absent("equipment_status", ["available", "in_use", "maintenance", "retired"])

    ownership = postgresql.ENUM("owned", "rented", name="equipment_ownership", create_type=False)
    eq_status = postgresql.ENUM(
        "available", "in_use", "maintenance", "retired", name="equipment_status", create_type=False
    )

    op.create_table(
        "equipment",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("code", sa.String(50), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("category", sa.String(50), nullable=True),
        sa.Column("ownership", ownership, nullable=False, server_default="owned"),
        sa.Column("status", eq_status, nullable=False, server_default="available"),
        sa.Column("rental_rate", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("org_id", "code", name="uq_equipment_org_code"),
    )
    op.create_index("ix_equipment_org_id", "equipment", ["org_id"])

    op.create_table(
        "equipment_usage",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("equipment_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("equipment.id"), nullable=False),
        sa.Column("site_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sites.id"), nullable=False),
        sa.Column("usage_date", sa.Date(), nullable=False),
        sa.Column("quantity", sa.Numeric(10, 2), nullable=False),
        sa.Column("cost", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_equipment_usage_org_id", "equipment_usage", ["org_id"])
    op.create_index("ix_equipment_usage_equipment_id", "equipment_usage", ["equipment_id"])
    op.create_index("ix_equipment_usage_site_id", "equipment_usage", ["site_id"])

    op.create_table(
        "equipment_maintenance",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("equipment_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("equipment.id"), nullable=False),
        sa.Column("service_date", sa.Date(), nullable=False),
        sa.Column("description", sa.String(255), nullable=False),
        sa.Column("cost", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_equipment_maintenance_equipment_id", "equipment_maintenance", ["equipment_id"])


def downgrade() -> None:
    op.drop_table("equipment_maintenance")
    op.drop_table("equipment_usage")
    op.drop_table("equipment")
    op.execute("DROP TYPE IF EXISTS equipment_status")
    op.execute("DROP TYPE IF EXISTS equipment_ownership")
