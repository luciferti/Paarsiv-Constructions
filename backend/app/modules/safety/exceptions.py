from app.core.errors import NotFoundError


class SafetyError(Exception):
    """Base exception for the safety module."""


class IncidentNotFoundError(SafetyError, NotFoundError):
    def __init__(self, incident_id: object):
        super().__init__(f"Incident {incident_id} not found")
