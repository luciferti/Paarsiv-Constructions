import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status

from app.core.deps import CurrentUser
from app.modules.expense.dependencies import (
    get_expense_service,
    require_expense_create,
    require_expense_delete,
    require_expense_view,
)
from app.modules.expense.schemas.expense_schema import (
    CashEntryCreate,
    CashEntryOut,
    PettyCashSummary,
)
from app.modules.expense.services.expense_service import ExpenseService

router = APIRouter(prefix="/petty-cash", tags=["petty-cash"])


@router.get("/summary", response_model=PettyCashSummary)
def get_petty_cash_summary(
    site_id: Optional[uuid.UUID] = Query(None),
    user: CurrentUser = Depends(require_expense_view),
    service: ExpenseService = Depends(get_expense_service),
) -> PettyCashSummary:
    return service.summary(org_id=uuid.UUID(user.org_id), site_id=site_id)


@router.get("/entries", response_model=List[CashEntryOut])
def list_cash_entries(
    site_id: Optional[uuid.UUID] = Query(None),
    user: CurrentUser = Depends(require_expense_view),
    service: ExpenseService = Depends(get_expense_service),
) -> List[CashEntryOut]:
    entries = service.list_entries(org_id=uuid.UUID(user.org_id), site_id=site_id)
    return [CashEntryOut.model_validate(e) for e in entries]


@router.post("/entries", response_model=CashEntryOut, status_code=status.HTTP_201_CREATED)
def add_cash_entry(
    payload: CashEntryCreate,
    user: CurrentUser = Depends(require_expense_create),
    service: ExpenseService = Depends(get_expense_service),
) -> CashEntryOut:
    entry = service.add_entry(
        org_id=uuid.UUID(user.org_id), created_by=uuid.UUID(user.id), payload=payload
    )
    return CashEntryOut.model_validate(entry)


@router.delete("/entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cash_entry(
    entry_id: uuid.UUID,
    user: CurrentUser = Depends(require_expense_delete),
    service: ExpenseService = Depends(get_expense_service),
) -> None:
    service.delete_entry(org_id=uuid.UUID(user.org_id), entry_id=entry_id)
