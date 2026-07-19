from app.core.errors import NotFoundError


class InvoiceError(Exception):
    """Base exception for the invoice module."""


class InvoiceNotFoundError(InvoiceError, NotFoundError):
    def __init__(self, invoice_id: object):
        super().__init__(f"Invoice {invoice_id} not found")
