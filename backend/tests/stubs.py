"""
Minimal stand-ins for tables owned by existing HRMS modules
(employees, projects) that the site module's foreign keys point to.

The definitions now live in `app.core.hrms_stubs` (so they are registered in
every environment, not just tests/demo). This module re-exports them so the
existing `from tests import stubs` import in conftest keeps working.
"""
from app.core.hrms_stubs import employees, projects  # noqa: F401
