from app.core.errors import ConflictError, NotFoundError, UnauthorizedError, ValidationError


class AuthError(Exception):
    """Base exception for the auth module."""


class UserNotFoundError(AuthError, NotFoundError):
    def __init__(self, user_id: object):
        super().__init__(f"User {user_id} not found")


class InvalidRoleError(AuthError, ValidationError):
    def __init__(self, role: str):
        super().__init__(f"'{role}' is not a valid role")


class SelfModificationError(AuthError, ValidationError):
    def __init__(self):
        super().__init__("You can't change your own role or active status")


class EmailAlreadyRegisteredError(AuthError, ConflictError):
    def __init__(self, email: str):
        super().__init__(f"An account with {email} already exists")


class InvalidCredentialsError(AuthError, UnauthorizedError):
    def __init__(self):
        super().__init__("Invalid email or password")
