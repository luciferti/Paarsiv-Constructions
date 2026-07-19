"""
Minimal stand-ins for tables owned by existing HRMS modules
(employees, projects) that the site module's
foreign keys point to. In the real HRMS repo these already exist —
this file only exists so the site module's test suite can run in
isolation against SQLite.
"""
from sqlalchemy import Table, Column
from sqlalchemy import Uuid

from app.core.database import Base

employees = Table("employees", Base.metadata, Column("id", Uuid(as_uuid=True), primary_key=True))
projects = Table("projects", Base.metadata, Column("id", Uuid(as_uuid=True), primary_key=True))
