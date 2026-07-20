from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_permission
from app.modules.budget.services.budget_service import BudgetService

require_budget_view = require_permission("budget:view")
require_budget_edit = require_permission("budget:edit")


def get_budget_service(db: Session = Depends(get_db)) -> BudgetService:
    return BudgetService(db)
