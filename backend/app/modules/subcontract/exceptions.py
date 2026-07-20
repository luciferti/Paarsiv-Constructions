from app.core.errors import ConflictError, NotFoundError


class SubcontractError(Exception):
    """Base exception for the subcontract module."""


class SubcontractorNotFoundError(SubcontractError, NotFoundError):
    def __init__(self, subcontractor_id: object):
        super().__init__(f"Subcontractor {subcontractor_id} not found")


class DuplicateSubcontractorCodeError(SubcontractError, ConflictError):
    def __init__(self, code: str):
        super().__init__(f"Subcontractor code '{code}' already exists in this organization")


class WorkOrderNotFoundError(SubcontractError, NotFoundError):
    def __init__(self, wo_id: object):
        super().__init__(f"Work order {wo_id} not found")


class DuplicateWorkOrderNumberError(SubcontractError, ConflictError):
    def __init__(self, wo_number: str):
        super().__init__(f"Work order number '{wo_number}' already exists in this organization")
