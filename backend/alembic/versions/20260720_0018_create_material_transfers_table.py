"""create material_transfers table (stock transfers between sites)

Revision ID: 20260720_0018
Revises: 20260720_0017
Create Date: 2026-07-20

Cross-site stock movement, audit record. Additive; no enums. The stock summary
credits the destination and debits the source from this table.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260720_0018"
down_revision: Union[str, None] = "20260720_0017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "material_transfers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("material_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("materials.id"), nullable=False),
        sa.Column("from_site_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sites.id"), nullable=False),
        sa.Column("to_site_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sites.id"), nullable=False),
        sa.Column("quantity", sa.Numeric(12, 2), nullable=False),
        sa.Column("transfer_date", sa.Date(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_material_transfers_org_id", "material_transfers", ["org_id"])
    op.create_index("ix_material_transfers_material_id", "material_transfers", ["material_id"])
    op.create_index("ix_material_transfers_from_site_id", "material_transfers", ["from_site_id"])
    op.create_index("ix_material_transfers_to_site_id", "material_transfers", ["to_site_id"])


def downgrade() -> None:
    op.drop_table("material_transfers")
