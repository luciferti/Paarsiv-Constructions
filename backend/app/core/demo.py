"""
Local preview only. Provides table stand-ins for `employees` and
`projects` (HRMS-owned; `organizations`/`users` are now real tables
owned by the auth module), auto-registers every feature module's ORM models,
and creates the schema directly against SQLite so the app can be
clicked through end-to-end before it's wired into the real HRMS repo
and its Postgres/Alembic migration chain.

Never imported unless `settings.demo_mode` is true.
"""
import importlib
import pkgutil

from app.core.database import Base, engine

# Registers the employees/projects stub tables in the metadata. Imported for
# its side effect; also used in production (see app.main) so FKs resolve there.
import app.core.hrms_stubs  # noqa: F401


def _register_all_models() -> None:
    import app.modules as modules_pkg

    for module_info in pkgutil.walk_packages(modules_pkg.__path__, prefix="app.modules."):
        if module_info.name.endswith("_model"):
            importlib.import_module(module_info.name)


def init_demo_db() -> None:
    _register_all_models()
    Base.metadata.create_all(engine)
