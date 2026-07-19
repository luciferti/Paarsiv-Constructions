from app.core.errors import ConflictError, NotFoundError


class SiteError(Exception):
    """Base exception for the site module."""


class SiteNotFoundError(SiteError, NotFoundError):
    def __init__(self, site_id: object):
        super().__init__(f"Site {site_id} not found")


class DuplicateSiteCodeError(SiteError, ConflictError):
    def __init__(self, code: str):
        super().__init__(f"Site code '{code}' already exists in this organization")


class SiteTeamMemberNotFoundError(SiteError, NotFoundError):
    def __init__(self, site_id: object, employee_id: object):
        super().__init__(f"Employee {employee_id} is not assigned to site {site_id}")


class DuplicateSiteTeamMemberError(SiteError, ConflictError):
    def __init__(self, employee_id: object):
        super().__init__(f"Employee {employee_id} is already assigned to this site")
