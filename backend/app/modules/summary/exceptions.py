from app.core.errors import NotFoundError


class SummaryError(Exception):
    """Base exception for the AI summary module."""


class SummaryNotFoundError(SummaryError, NotFoundError):
    def __init__(self, site_id: object):
        super().__init__(f"No AI summary has been generated yet for site {site_id}")
