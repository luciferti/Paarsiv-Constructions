from app.core.errors import ConflictError, NotFoundError


class ReportError(Exception):
    """Base exception for the daily report module."""


class DailyReportNotFoundError(ReportError, NotFoundError):
    def __init__(self, report_id: object):
        super().__init__(f"Daily report {report_id} not found")


class DuplicateDailyReportError(ReportError, ConflictError):
    def __init__(self, site_id: object, report_date: object):
        super().__init__(f"A report for site {site_id} on {report_date} already exists")
