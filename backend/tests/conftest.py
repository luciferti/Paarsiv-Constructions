import importlib
import pkgutil
import uuid

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.modules as _modules_pkg
from app.core.database import Base
from tests import stubs  # noqa: F401  (registers organizations/employees/projects stub tables)

for _module_info in pkgutil.walk_packages(_modules_pkg.__path__, prefix="app.modules."):
    if _module_info.name.endswith("_model"):
        importlib.import_module(_module_info.name)  # registers every module's tables with Base


@pytest.fixture()
def db() -> Session:
    # StaticPool + check_same_thread=False: TestClient runs sync routes in a
    # worker thread, which would otherwise get its own separate `:memory:` DB.
    engine = create_engine(
        "sqlite:///:memory:",
        future=True,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session_local = sessionmaker(bind=engine, future=True)
    session = session_local()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture()
def org_id() -> uuid.UUID:
    return uuid.uuid4()


@pytest.fixture()
def user_id() -> uuid.UUID:
    return uuid.uuid4()
