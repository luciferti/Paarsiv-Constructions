from app.core.errors import ConflictError, NotFoundError


class BillingError(Exception):
    """Base exception for the client-billing module."""


class ClientBillNotFoundError(BillingError, NotFoundError):
    def __init__(self, bill_id: object):
        super().__init__(f"Client bill {bill_id} not found")


class DuplicateBillNumberError(BillingError, ConflictError):
    def __init__(self, bill_number: str):
        super().__init__(f"Bill number '{bill_number}' already exists in this organization")
