from app.core.errors import NotFoundError


class BudgetError(Exception):
    """Base exception for the budget module."""


class BudgetLineNotFoundError(BudgetError, NotFoundError):
    def __init__(self, line_id: object):
        super().__init__(f"Budget line {line_id} not found")
