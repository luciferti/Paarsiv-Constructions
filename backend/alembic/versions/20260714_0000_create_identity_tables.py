"""create organizations, users, and HRMS stand-in tables

Revision ID: 20260714_0000
Revises: None
Create Date: 2026-07-19

Base of the standalone migration chain. `organizations` and `users`
are real tables owned by the auth module. `employees` and `projects`
are minimal stand-ins for HRMS-owned tables that later migrations'
foreign keys point to — when merging into the real HRMS repo, drop
this migration and re-point 0001's down_revision at the HRMS head.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260714_0000"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Pre-create all enum types to avoid duplicate-type errors in later migrations
site_status_enum = postgresql.ENUM("planning", "active", "on_hold", "completed", "archived", name="site_status")
vendor_status_enum = postgresql.ENUM("active", "inactive", "blacklisted", name="vendor_status")
material_status_enum = postgresql.ENUM("active", "inactive", name="material_status")
material_entry_type_enum = postgresql.ENUM("received", "used", "adjustment", name="material_entry_type")
invoice_status_enum = postgresql.ENUM("pending_review", "approved", "rejected", name="invoice_status")
notification_status_enum = postgresql.ENUM("sent", "logged", "failed", name="notification_status")
assistant_message_role_enum = postgresql.ENUM("user", "assistant", name="assistant_message_role")
assistant_message_channel_enum = postgresql.ENUM("web", "whatsapp", name="assistant_message_channel")


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
    # PostgreSQL lacks CREATE TYPE ... IF NOT EXISTS, so guard each enum
    # with a DO block that checks pg_type. Idempotent across re-runs.
    _create_enum_if_absent("site_status", ["planning", "active", "on_hold", "completed", "archived"])
    _create_enum_if_absent("vendor_status", ["active", "inactive", "blacklisted"])
    _create_enum_if_absent("material_status", ["active", "inactive"])
    _create_enum_if_absent("material_entry_type", ["received", "used", "adjustment"])
    _create_enum_if_absent("invoice_status", ["pending_review", "approved", "rejected"])
    _create_enum_if_absent("notification_status", ["sent", "logged", "failed"])
    _create_enum_if_absent("assistant_message_role", ["user", "assistant"])
    _create_enum_if_absent("assistant_message_channel", ["web", "whatsapp"])
    op.create_table(
        "organizations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", sa.String(20), nullable=False, server_default="admin"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("ix_users_org_id", "users", ["org_id"])
    op.create_index("ix_users_email", "users", ["email"])

    op.create_table(
        "employees",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
    )
    op.create_table(
        "projects",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
    )


def downgrade() -> None:
    op.drop_table("projects")
    op.drop_table("employees")
    op.drop_table("users")
    op.drop_table("organizations")
    # Enums are dropped last to avoid FK constraint issues
    site_status_enum.drop(op.get_bind(), checkfirst=True)
    vendor_status_enum.drop(op.get_bind(), checkfirst=True)
    material_status_enum.drop(op.get_bind(), checkfirst=True)
    material_entry_type_enum.drop(op.get_bind(), checkfirst=True)
    invoice_status_enum.drop(op.get_bind(), checkfirst=True)
    notification_status_enum.drop(op.get_bind(), checkfirst=True)
    assistant_message_role_enum.drop(op.get_bind(), checkfirst=True)
    assistant_message_channel_enum.drop(op.get_bind(), checkfirst=True)
