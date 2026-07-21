import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status

from app.core.deps import CurrentUser
from app.modules.equipment.dependencies import (
    get_equipment_service,
    get_maintenance_service,
    require_equipment_archive,
    require_equipment_create,
    require_equipment_edit,
    require_equipment_view,
    require_maintenance_create,
)
from app.modules.equipment.models.equipment_model import EquipmentStatus
from app.modules.equipment.schemas.equipment_schema import (
    EquipmentCreate,
    EquipmentOut,
    EquipmentUpdate,
    MaintenanceCreate,
    MaintenanceOut,
    PaginatedEquipment,
)
from app.modules.equipment.services.equipment_service import (
    EquipmentService,
    MaintenanceService,
)

router = APIRouter(prefix="/equipment", tags=["equipment"])


@router.post("", response_model=EquipmentOut, status_code=status.HTTP_201_CREATED)
def create_equipment(
    payload: EquipmentCreate,
    user: CurrentUser = Depends(require_equipment_create),
    service: EquipmentService = Depends(get_equipment_service),
) -> EquipmentOut:
    return EquipmentOut.model_validate(
        service.create(uuid.UUID(user.org_id), uuid.UUID(user.id), payload)
    )


@router.get("", response_model=PaginatedEquipment)
def list_equipment(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: Optional[EquipmentStatus] = Query(None, alias="status"),
    user: CurrentUser = Depends(require_equipment_view),
    service: EquipmentService = Depends(get_equipment_service),
) -> PaginatedEquipment:
    return service.list(uuid.UUID(user.org_id), page=page, page_size=page_size, status=status_filter)


@router.get("/{eq_id}", response_model=EquipmentOut)
def get_equipment(
    eq_id: uuid.UUID,
    user: CurrentUser = Depends(require_equipment_view),
    service: EquipmentService = Depends(get_equipment_service),
) -> EquipmentOut:
    return EquipmentOut.model_validate(service.get(uuid.UUID(user.org_id), eq_id))


@router.patch("/{eq_id}", response_model=EquipmentOut)
def update_equipment(
    eq_id: uuid.UUID,
    payload: EquipmentUpdate,
    user: CurrentUser = Depends(require_equipment_edit),
    service: EquipmentService = Depends(get_equipment_service),
) -> EquipmentOut:
    return EquipmentOut.model_validate(service.update(uuid.UUID(user.org_id), eq_id, payload))


@router.delete("/{eq_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_equipment(
    eq_id: uuid.UUID,
    user: CurrentUser = Depends(require_equipment_archive),
    service: EquipmentService = Depends(get_equipment_service),
) -> None:
    service.archive(uuid.UUID(user.org_id), eq_id)


@router.get("/{eq_id}/maintenance", response_model=List[MaintenanceOut])
def list_maintenance(
    eq_id: uuid.UUID,
    user: CurrentUser = Depends(require_equipment_view),
    service: MaintenanceService = Depends(get_maintenance_service),
) -> List[MaintenanceOut]:
    return [MaintenanceOut.model_validate(m) for m in service.list_logs(uuid.UUID(user.org_id), eq_id)]


@router.post("/{eq_id}/maintenance", response_model=MaintenanceOut, status_code=status.HTTP_201_CREATED)
def add_maintenance(
    eq_id: uuid.UUID,
    payload: MaintenanceCreate,
    user: CurrentUser = Depends(require_maintenance_create),
    service: MaintenanceService = Depends(get_maintenance_service),
) -> MaintenanceOut:
    return MaintenanceOut.model_validate(
        service.add_log(uuid.UUID(user.org_id), eq_id, uuid.UUID(user.id), payload)
    )
