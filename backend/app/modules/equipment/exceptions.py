from app.core.errors import ConflictError, NotFoundError


class EquipmentError(Exception):
    """Base exception for the equipment module."""


class EquipmentNotFoundError(EquipmentError, NotFoundError):
    def __init__(self, equipment_id: object):
        super().__init__(f"Equipment {equipment_id} not found")


class DuplicateEquipmentCodeError(EquipmentError, ConflictError):
    def __init__(self, code: str):
        super().__init__(f"Equipment code '{code}' already exists in this organization")
