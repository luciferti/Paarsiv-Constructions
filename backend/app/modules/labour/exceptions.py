from app.core.errors import ConflictError, NotFoundError


class LabourError(Exception):
    """Base exception for the labour module."""


class WorkerNotFoundError(LabourError, NotFoundError):
    def __init__(self, worker_id: object):
        super().__init__(f"Worker {worker_id} not found")


class DuplicateWorkerCodeError(LabourError, ConflictError):
    def __init__(self, code: str):
        super().__init__(f"Worker code '{code}' already exists in this organization")


class DuplicateAttendanceError(LabourError, ConflictError):
    def __init__(self, work_date: object):
        super().__init__(f"Attendance for this worker on {work_date} is already recorded")
