"""create incidents table (safety)

Revision ID: 20260720_0017
Revises: 20260720_0016
Create Date: 2026-07-20

Safety incident register. Additive. Own enums via idempotent DO-block guards,
referenced with create_type=False.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260720_0017"
down_revision: Union[str, None] = "20260720_0016"
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
        "incident_type",
        ["near_miss", "first_aid", "injury", "property_damage", "environmental", "other"],
    )
    _create_enum_if_absent("incident_severity", ["low", "medium", "high", "critical"])
    _create_enum_if_absent("incident_status", ["open", "investigating", "closed"])

    itype = postgresql.ENUM(
        "near_miss", "first_aid", "injury", "property_damage", "environmental", "other",
        name="incident_type", create_type=False,
    )
    iseverity = postgresql.ENUM(
        "low", "medium", "high", "critical", name="incident_severity", create_type=False
    )
    istatus = postgresql.ENUM(
        "open", "investigating", "closed", name="incident_status", create_type=False
    )

    op.create_table(
        "incidents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("site_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sites.id"), nullable=False),
        sa.Column("incident_date", sa.Date(), nullable=False),
        sa.Column("incident_type", itype, nullable=False),
        sa.Column("severity", iseverity, nullable=False),
        sa.Column("status", istatus, nullable=False, server_default="open"),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("action_taken", sa.Text(), nullable=True),
        sa.Column("reported_by", sa.String(255), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_incidents_org_id", "incidents", ["org_id"])
    op.create_index("ix_incidents_site_id", "incidents", ["site_id"])
    op.create_index("ix_incidents_incident_date", "incidents", ["incident_date"])


def downgrade() -> None:
    op.drop_table("incidents")
    op.execute("DROP TYPE IF EXISTS incident_status")
    op.execute("DROP TYPE IF EXISTS incident_severity")
    op.execute("DROP TYPE IF EXISTS incident_type")
