import uuid
from typing import List

from fastapi import APIRouter, Depends, status

from app.core.deps import CurrentUser
from app.modules.budget.dependencies import (
    get_budget_service,
    require_budget_edit,
    require_budget_view,
)
from app.modules.budget.schemas.budget_schema import (
    BudgetLineCreate,
    BudgetLineOut,
    SiteBudgetSummary,
)
from app.modules.budget.services.budget_service import BudgetService

router = APIRouter(prefix="/sites/{site_id}/budget", tags=["site-budget"])


@router.get("/summary", response_model=SiteBudgetSummary)
def get_site_budget_summary(
    site_id: uuid.UUID,
    user: CurrentUser = Depends(require_budget_view),
    service: BudgetService = Depends(get_budget_service),
) -> SiteBudgetSummary:
    return service.summary(org_id=uuid.UUID(user.org_id), site_id=site_id)


@router.get("/lines", response_model=List[BudgetLineOut])
def list_budget_lines(
    site_id: uuid.UUID,
    user: CurrentUser = Depends(require_budget_view),
    service: BudgetService = Depends(get_budget_service),
) -> List[BudgetLineOut]:
    lines = service.list_lines(org_id=uuid.UUID(user.org_id), site_id=site_id)
    return [BudgetLineOut.model_validate(line) for line in lines]


@router.post("/lines", response_model=BudgetLineOut, status_code=status.HTTP_201_CREATED)
def add_budget_line(
    site_id: uuid.UUID,
    payload: BudgetLineCreate,
    user: CurrentUser = Depends(require_budget_edit),
    service: BudgetService = Depends(get_budget_service),
) -> BudgetLineOut:
    line = service.add_line(
        org_id=uuid.UUID(user.org_id),
        site_id=site_id,
        created_by=uuid.UUID(user.id),
        payload=payload,
    )
    return BudgetLineOut.model_validate(line)


@router.delete("/lines/{line_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_budget_line(
    site_id: uuid.UUID,
    line_id: uuid.UUID,
    user: CurrentUser = Depends(require_budget_edit),
    service: BudgetService = Depends(get_budget_service),
) -> None:
    service.delete_line(org_id=uuid.UUID(user.org_id), line_id=line_id)
