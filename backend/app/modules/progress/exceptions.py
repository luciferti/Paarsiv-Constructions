from app.core.errors import NotFoundError


class ProgressError(Exception):
    """Base exception for the progress module."""


class MilestoneNotFoundError(ProgressError, NotFoundError):
    def __init__(self, milestone_id: object):
        super().__init__(f"Milestone {milestone_id} not found")
