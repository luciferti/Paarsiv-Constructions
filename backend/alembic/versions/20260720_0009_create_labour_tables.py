"""create workers and attendance_entries tables

Revision ID: 20260720_0009
Revises: 20260714_0008
Create Date: 2026-07-20

Labour attendance & wages. Purely additive — no existing tables are modified.
Creates its own enums with the same idempotent DO-block guard used by the base
migration, then references them with create_type=False so table creation never
re-emits CREATE TYPE.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260720_0009"
down_revision: Union[str, None] = "20260714_0008"
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
    _create_enum_if_absent("worker_status", ["active", "inactive"])
    _create_enum_if_absent("attendance_status", ["present", "absent", "half_day"])

    worker_status_enum = postgresql.ENUM(
        "active", "inactive", name="worker_status", create_type=False
    )
    attendance_status_enum = postgresql.ENUM(
        "present", "absent", "half_day", name="attendance_status", create_type=False
    )

    op.create_table(
        "workers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("code", sa.String(50), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("phone", sa.String(30), nullable=True),
        sa.Column("trade", sa.String(50), nullable=True),
        sa.Column("default_wage_rate", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("status", worker_status_enum, nullable=False, server_default="active"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("org_id", "code", name="uq_workers_org_code"),
    )
    op.create_index("ix_workers_org_id", "workers", ["org_id"])

    op.create_table(
        "attendance_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("site_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sites.id"), nullable=False),
        sa.Column("worker_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("workers.id"), nullable=False),
        sa.Column("work_date", sa.Date(), nullable=False),
        sa.Column("status", attendance_status_enum, nullable=False),
        sa.Column("overtime_hours", sa.Numeric(6, 2), nullable=False, server_default="0"),
        sa.Column("wage_rate", sa.Numeric(12, 2), nullable=False),
        sa.Column("wage_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("worker_id", "work_date", name="uq_attendance_worker_date"),
    )
    op.create_index("ix_attendance_entries_org_id", "attendance_entries", ["org_id"])
    op.create_index("ix_attendance_entries_site_id", "attendance_entries", ["site_id"])
    op.create_index("ix_attendance_entries_worker_id", "attendance_entries", ["worker_id"])
    op.create_index("ix_attendance_entries_work_date", "attendance_entries", ["work_date"])


def downgrade() -> None:
    op.drop_table("attendance_entries")
    op.drop_table("workers")
    op.execute("DROP TYPE IF EXISTS attendance_status")
    op.execute("DROP TYPE IF EXISTS worker_status")
