import uuid
from typing import List

from fastapi import APIRouter, Depends, status

from app.core.deps import CurrentUser
from app.modules.equipment.dependencies import (
    get_usage_service,
    require_equipment_view,
    require_usage_create,
)
from app.modules.equipment.schemas.equipment_schema import (
    SiteEquipmentCostItem,
    UsageCreate,
    UsageOut,
)
from app.modules.equipment.services.equipment_service import UsageService

router = APIRouter(prefix="/sites/{site_id}/equipment", tags=["site-equipment"])


@router.get("/cost-summary", response_model=List[SiteEquipmentCostItem])
def site_equipment_cost(
    site_id: uuid.UUID,
    user: CurrentUser = Depends(require_equipment_view),
    service: UsageService = Depends(get_usage_service),
) -> List[SiteEquipmentCostItem]:
    return service.cost_summary(uuid.UUID(user.org_id), site_id)


@router.get("/usage", response_model=List[UsageOut])
def list_site_usage(
    site_id: uuid.UUID,
    user: CurrentUser = Depends(require_equipment_view),
    service: UsageService = Depends(get_usage_service),
) -> List[UsageOut]:
    return [UsageOut.model_validate(u) for u in service.list_usage(uuid.UUID(user.org_id), site_id)]


@router.post("/usage", response_model=UsageOut, status_code=status.HTTP_201_CREATED)
def add_site_usage(
    site_id: uuid.UUID,
    payload: UsageCreate,
    user: CurrentUser = Depends(require_usage_create),
    service: UsageService = Depends(get_usage_service),
) -> UsageOut:
    usage = service.add_usage(uuid.UUID(user.org_id), site_id, uuid.UUID(user.id), payload)
    return UsageOut.model_validate(usage)
