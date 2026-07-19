import uuid
from typing import List

from fastapi import APIRouter, Depends, status

from app.core.deps import CurrentUser
from app.modules.material.dependencies import (
    get_material_entry_service,
    require_material_entry_create,
    require_material_view,
)
from app.modules.material.schemas.material_schema import (
    MaterialEntryCreate,
    MaterialEntryOut,
    SiteMaterialStockItem,
)
from app.modules.material.services.material_service import MaterialEntryService

router = APIRouter(prefix="/sites/{site_id}/materials", tags=["site-materials"])


@router.get("/stock", response_model=List[SiteMaterialStockItem])
def get_site_material_stock(
    site_id: uuid.UUID,
    user: CurrentUser = Depends(require_material_view),
    service: MaterialEntryService = Depends(get_material_entry_service),
) -> List[SiteMaterialStockItem]:
    return service.stock_summary(org_id=uuid.UUID(user.org_id), site_id=site_id)


@router.get("/entries", response_model=List[MaterialEntryOut])
def list_site_material_entries(
    site_id: uuid.UUID,
    user: CurrentUser = Depends(require_material_view),
    service: MaterialEntryService = Depends(get_material_entry_service),
) -> List[MaterialEntryOut]:
    entries = service.list_entries(org_id=uuid.UUID(user.org_id), site_id=site_id)
    return [MaterialEntryOut.model_validate(e) for e in entries]


@router.post("/entries", response_model=MaterialEntryOut, status_code=status.HTTP_201_CREATED)
def add_site_material_entry(
    site_id: uuid.UUID,
    payload: MaterialEntryCreate,
    user: CurrentUser = Depends(require_material_entry_create),
    service: MaterialEntryService = Depends(get_material_entry_service),
) -> MaterialEntryOut:
    entry = service.add_entry(
        org_id=uuid.UUID(user.org_id),
        site_id=site_id,
        created_by=uuid.UUID(user.id),
        payload=payload,
    )
    return MaterialEntryOut.model_validate(entry)
