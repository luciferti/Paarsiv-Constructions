"""create documents table (document register)

Revision ID: 20260720_0019
Revises: 20260720_0018
Create Date: 2026-07-20

Link-based document register (metadata + external URL). Additive. Own enum via
idempotent DO-block guard, referenced with create_type=False.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260720_0019"
down_revision: Union[str, None] = "20260720_0018"
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
        "document_category",
        ["contract", "permit", "drawing", "license", "ra_bill", "safety", "compliance", "other"],
    )
    category = postgresql.ENUM(
        "contract", "permit", "drawing", "license", "ra_bill", "safety", "compliance", "other",
        name="document_category", create_type=False,
    )

    op.create_table(
        "documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("site_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sites.id"), nullable=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("category", category, nullable=False),
        sa.Column("url", sa.String(1000), nullable=False),
        sa.Column("reference_no", sa.String(100), nullable=True),
        sa.Column("issue_date", sa.Date(), nullable=True),
        sa.Column("expiry_date", sa.Date(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_documents_org_id", "documents", ["org_id"])
    op.create_index("ix_documents_site_id", "documents", ["site_id"])
    op.create_index("ix_documents_expiry_date", "documents", ["expiry_date"])


def downgrade() -> None:
    op.drop_table("documents")
    op.execute("DROP TYPE IF EXISTS document_category")
