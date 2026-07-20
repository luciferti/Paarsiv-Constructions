import importlib
import pkgutil
from contextlib import asynccontextmanager

from pathlib import Path

from fastapi import APIRouter, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import get_settings
from app.core.errors import ConflictError, NotFoundError, UnauthorizedError

# Side-effect import: registers the HRMS `employees`/`projects` stub tables in
# the ORM metadata so feature models' foreign keys resolve in every environment
# (not just demo mode). Must run before the first query configures the mappers.
import app.core.hrms_stubs  # noqa: F401,E402

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # SQLite (local dev/demo) gets its schema via create_all; Postgres
    # deployments run `alembic upgrade head` before start instead.
    if settings.demo_mode or settings.database_url.startswith("sqlite"):
        from app.core.demo import init_demo_db

        init_demo_db()
    yield


app = FastAPI(title="HRMS AI Business OS", version="0.1.0", lifespan=lifespan)

_cors_origins = []
if settings.frontend_origin:
    _cors_origins.extend(o.strip() for o in settings.frontend_origin.split(",") if o.strip())
if settings.demo_mode:
    _cors_origins.append("http://localhost:3000")
if _cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Serves locally stored invoice uploads. Note: on hosts with ephemeral
# disks (Render free tier) uploaded files don't survive a redeploy —
# swap in S3 via invoice/services/file_storage.py for durable storage.
uploads_dir = Path(__file__).resolve().parents[1] / "uploads"
uploads_dir.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")


def _include_all_module_routers(app: FastAPI) -> None:
    """Every app/modules/*/api/v1/*_routes.py that defines `router` is
    mounted automatically — new feature modules don't require editing
    this file."""
    import app.modules as modules_pkg

    for module_info in pkgutil.walk_packages(modules_pkg.__path__, prefix="app.modules."):
        if module_info.name.endswith("_routes"):
            module = importlib.import_module(module_info.name)
            router = getattr(module, "router", None)
            if isinstance(router, APIRouter):
                app.include_router(router, prefix="/api/v1")


_include_all_module_routers(app)


@app.exception_handler(NotFoundError)
def handle_not_found(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(status_code=404, content={"detail": str(exc)})


@app.exception_handler(ConflictError)
def handle_conflict(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(status_code=409, content={"detail": str(exc)})


@app.exception_handler(UnauthorizedError)
def handle_unauthorized(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(status_code=401, content={"detail": str(exc)})


@app.get("/health")
def health_check() -> dict:
    return {"status": "ok"}
