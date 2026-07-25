from app.core.errors import ConflictError, NotFoundError, ValidationError


class MaterialError(Exception):
    """Base exception for the material module."""


class SameSiteTransferError(MaterialError, ValidationError):
    def __init__(self):
        super().__init__("Source and destination sites must be different")


class MaterialNotFoundError(MaterialError, NotFoundError):
    def __init__(self, material_id: object):
        super().__init__(f"Material {material_id} not found")


class DuplicateMaterialCodeError(MaterialError, ConflictError):
    def __init__(self, code: str):
        super().__init__(f"Material code '{code}' already exists in this organization")
