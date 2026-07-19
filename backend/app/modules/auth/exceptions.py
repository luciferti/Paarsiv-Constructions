from app.core.errors import ConflictError, UnauthorizedError


class AuthError(Exception):
    """Base exception for the auth module."""


class EmailAlreadyRegisteredError(AuthError, ConflictError):
    def __init__(self, email: str):
        super().__init__(f"An account with {email} already exists")


class InvalidCredentialsError(AuthError, UnauthorizedError):
    def __init__(self):
        super().__init__("Invalid email or password")
