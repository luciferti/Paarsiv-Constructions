from app.core.errors import ConflictError, NotFoundError


class VendorError(Exception):
    """Base exception for the vendor module."""


class VendorNotFoundError(VendorError, NotFoundError):
    def __init__(self, vendor_id: object):
        super().__init__(f"Vendor {vendor_id} not found")


class DuplicateVendorCodeError(VendorError, ConflictError):
    def __init__(self, code: str):
        super().__init__(f"Vendor code '{code}' already exists in this organization")
