import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, status

from app.core.deps import CurrentUser
from app.modules.labour.dependencies import (
    get_worker_service,
    require_worker_archive,
    require_worker_create,
    require_worker_edit,
    require_worker_view,
)
from app.modules.labour.models.labour_model import WorkerStatus
from app.modules.labour.schemas.labour_schema import (
    PaginatedWorkers,
    WorkerCreate,
    WorkerOut,
    WorkerUpdate,
)
from app.modules.labour.services.labour_service import WorkerService

router = APIRouter(prefix="/workers", tags=["workers"])


@router.post("", response_model=WorkerOut, status_code=status.HTTP_201_CREATED)
def create_worker(
    payload: WorkerCreate,
    user: CurrentUser = Depends(require_worker_create),
    service: WorkerService = Depends(get_worker_service),
) -> WorkerOut:
    worker = service.create_worker(
        org_id=uuid.UUID(user.org_id), created_by=uuid.UUID(user.id), payload=payload
    )
    return WorkerOut.model_validate(worker)


@router.get("", response_model=PaginatedWorkers)
def list_workers(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: Optional[WorkerStatus] = Query(None, alias="status"),
    user: CurrentUser = Depends(require_worker_view),
    service: WorkerService = Depends(get_worker_service),
) -> PaginatedWorkers:
    return service.list_workers(
        org_id=uuid.UUID(user.org_id), page=page, page_size=page_size, status=status_filter
    )


@router.get("/{worker_id}", response_model=WorkerOut)
def get_worker(
    worker_id: uuid.UUID,
    user: CurrentUser = Depends(require_worker_view),
    service: WorkerService = Depends(get_worker_service),
) -> WorkerOut:
    worker = service.get_worker(org_id=uuid.UUID(user.org_id), worker_id=worker_id)
    return WorkerOut.model_validate(worker)


@router.patch("/{worker_id}", response_model=WorkerOut)
def update_worker(
    worker_id: uuid.UUID,
    payload: WorkerUpdate,
    user: CurrentUser = Depends(require_worker_edit),
    service: WorkerService = Depends(get_worker_service),
) -> WorkerOut:
    worker = service.update_worker(
        org_id=uuid.UUID(user.org_id), worker_id=worker_id, payload=payload
    )
    return WorkerOut.model_validate(worker)


@router.delete("/{worker_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_worker(
    worker_id: uuid.UUID,
    user: CurrentUser = Depends(require_worker_archive),
    service: WorkerService = Depends(get_worker_service),
) -> None:
    service.archive_worker(org_id=uuid.UUID(user.org_id), worker_id=worker_id)
