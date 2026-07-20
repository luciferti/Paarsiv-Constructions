from app.core.errors import NotFoundError


class ExpenseError(Exception):
    """Base exception for the petty-cash / expense module."""


class CashEntryNotFoundError(ExpenseError, NotFoundError):
    def __init__(self, entry_id: object):
        super().__init__(f"Cash entry {entry_id} not found")
