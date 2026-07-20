from app.core.errors import ConflictError, NotFoundError


class PurchaseError(Exception):
    """Base exception for the purchase module."""


class PurchaseOrderNotFoundError(PurchaseError, NotFoundError):
    def __init__(self, po_id: object):
        super().__init__(f"Purchase order {po_id} not found")


class DuplicatePONumberError(PurchaseError, ConflictError):
    def __init__(self, po_number: str):
        super().__init__(f"PO number '{po_number}' already exists in this organization")


class VendorNotFoundForPOError(PurchaseError, NotFoundError):
    def __init__(self, vendor_id: object):
        super().__init__(f"Vendor {vendor_id} not found")
