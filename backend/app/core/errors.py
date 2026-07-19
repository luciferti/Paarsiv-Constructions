"""Shared error base classes. Module-specific exceptions inherit from
these so main.py only needs one handler per HTTP status, regardless of
how many feature modules exist."""


class NotFoundError(Exception):
    """Raise when a requested resource doesn't exist (or isn't visible to the caller)."""


class ConflictError(Exception):
    """Raise when a request would violate a uniqueness constraint or similar."""


class UnauthorizedError(Exception):
    """Raise when credentials are missing, invalid, or expired."""
