"""
Registers the HRMS-owned `employees` and `projects` tables as SQLAlchemy
Table objects in the shared metadata.

These are stand-ins. The actual database tables are created by Alembic
migration 0000 (production/Postgres) or by `create_all` (demo/SQLite);
their only job *here* is to let feature models' `ForeignKey("employees.id")`
and `ForeignKey("projects.id")` resolve at mapper-configuration time. Without
them registered, the first query touching e.g. `Site` raises
`NoReferencedTableError` because the FK target table isn't in the metadata.

Must be imported at startup in every environment (see app.main). When merging
into the real HRMS repo, delete this and import the real Employee/Project
models instead.
"""
from sqlalchemy import Column, Table, Uuid

from app.core.database import Base

employees = Table(
    "employees", Base.metadata, Column("id", Uuid(as_uuid=True), primary_key=True)
)
projects = Table(
    "projects", Base.metadata, Column("id", Uuid(as_uuid=True), primary_key=True)
)
