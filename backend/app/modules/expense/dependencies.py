from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_permission
from app.modules.expense.services.expense_service import ExpenseService

require_expense_view = require_permission("expense:view")
require_expense_create = require_permission("expense:create")
require_expense_delete = require_permission("expense:delete")


def get_expense_service(db: Session = Depends(get_db)) -> ExpenseService:
    return ExpenseService(db)
