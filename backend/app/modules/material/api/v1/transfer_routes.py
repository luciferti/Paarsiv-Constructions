import uuid
from typing import List

from fastapi import APIRouter, Depends, status

from app.core.deps import CurrentUser
from app.modules.material.dependencies import (
    get_material_transfer_service,
    require_material_transfer,
    require_material_view,
)
from app.modules.material.schemas.material_schema import (
    MaterialTransferCreate,
    MaterialTransferOut,
)
from app.modules.material.services.material_service import MaterialTransferService

router = APIRouter(prefix="/material-transfers", tags=["material-transfers"])


@router.post("", response_model=MaterialTransferOut, status_code=status.HTTP_201_CREATED)
def create_transfer(
    payload: MaterialTransferCreate,
    user: CurrentUser = Depends(require_material_transfer),
    service: MaterialTransferService = Depends(get_material_transfer_service),
) -> MaterialTransferOut:
    transfer = service.create_transfer(
        org_id=uuid.UUID(user.org_id), created_by=uuid.UUID(user.id), payload=payload
    )
    return MaterialTransferOut.model_validate(transfer)


@router.get("/site/{site_id}", response_model=List[MaterialTransferOut])
def list_site_transfers(
    site_id: uuid.UUID,
    user: CurrentUser = Depends(require_material_view),
    service: MaterialTransferService = Depends(get_material_transfer_service),
) -> List[MaterialTransferOut]:
    transfers = service.list_for_site(org_id=uuid.UUID(user.org_id), site_id=site_id)
    return [MaterialTransferOut.model_validate(t) for t in transfers]
