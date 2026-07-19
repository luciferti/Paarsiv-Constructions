from app.core.errors import ConflictError, NotFoundError


class MaterialError(Exception):
    """Base exception for the material module."""


class MaterialNotFoundError(MaterialError, NotFoundError):
    def __init__(self, material_id: object):
        super().__init__(f"Material {material_id} not found")


class DuplicateMaterialCodeError(MaterialError, ConflictError):
    def __init__(self, code: str):
        super().__init__(f"Material code '{code}' already exists in this organization")
