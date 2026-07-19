import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, status

from app.core.deps import CurrentUser
from app.modules.material.dependencies import (
    get_material_service,
    require_material_archive,
    require_material_create,
    require_material_edit,
    require_material_view,
)
from app.modules.material.models.material_model import MaterialStatus
from app.modules.material.schemas.material_schema import (
    MaterialCreate,
    MaterialOut,
    MaterialUpdate,
    PaginatedMaterials,
)
from app.modules.material.services.material_service import MaterialService

router = APIRouter(prefix="/materials", tags=["materials"])


@router.post("", response_model=MaterialOut, status_code=status.HTTP_201_CREATED)
def create_material(
    payload: MaterialCreate,
    user: CurrentUser = Depends(require_material_create),
    service: MaterialService = Depends(get_material_service),
) -> MaterialOut:
    material = service.create_material(
        org_id=uuid.UUID(user.org_id), created_by=uuid.UUID(user.id), payload=payload
    )
    return MaterialOut.model_validate(material)


@router.get("", response_model=PaginatedMaterials)
def list_materials(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: Optional[MaterialStatus] = Query(None, alias="status"),
    user: CurrentUser = Depends(require_material_view),
    service: MaterialService = Depends(get_material_service),
) -> PaginatedMaterials:
    return service.list_materials(
        org_id=uuid.UUID(user.org_id), page=page, page_size=page_size, status=status_filter
    )


@router.get("/{material_id}", response_model=MaterialOut)
def get_material(
    material_id: uuid.UUID,
    user: CurrentUser = Depends(require_material_view),
    service: MaterialService = Depends(get_material_service),
) -> MaterialOut:
    material = service.get_material(org_id=uuid.UUID(user.org_id), material_id=material_id)
    return MaterialOut.model_validate(material)


@router.patch("/{material_id}", response_model=MaterialOut)
def update_material(
    material_id: uuid.UUID,
    payload: MaterialUpdate,
    user: CurrentUser = Depends(require_material_edit),
    service: MaterialService = Depends(get_material_service),
) -> MaterialOut:
    material = service.update_material(
        org_id=uuid.UUID(user.org_id), material_id=material_id, payload=payload
    )
    return MaterialOut.model_validate(material)


@router.delete("/{material_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_material(
    material_id: uuid.UUID,
    user: CurrentUser = Depends(require_material_archive),
    service: MaterialService = Depends(get_material_service),
) -> None:
    service.archive_material(org_id=uuid.UUID(user.org_id), material_id=material_id)
