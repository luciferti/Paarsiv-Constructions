import uuid
from typing import List, Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.permissions import VALID_ROLES
from app.core.security import create_access_token, hash_password, verify_password
from app.modules.auth.exceptions import (
    EmailAlreadyRegisteredError,
    InvalidCredentialsError,
    InvalidRoleError,
    SelfModificationError,
    UserNotFoundError,
)
from app.modules.auth.models.auth_model import Organization, User
from app.modules.auth.schemas.auth_schema import (
    LoginRequest,
    SignupRequest,
    UserCreate,
    UserRoleUpdate,
)


class AuthService:
    def __init__(self, db: Session):
        self.db = db

    def _user_by_email(self, email: str) -> Optional[User]:
        stmt = select(User).where(func.lower(User.email) == email.lower())
        return self.db.execute(stmt).scalar_one_or_none()

    def signup(self, payload: SignupRequest) -> Tuple[str, User, Organization]:
        if self._user_by_email(payload.email) is not None:
            raise EmailAlreadyRegisteredError(payload.email)

        org = Organization(name=payload.company_name.strip())
        self.db.add(org)
        self.db.flush()

        user = User(
            org_id=org.id,
            name=payload.name.strip(),
            email=payload.email.lower(),
            password_hash=hash_password(payload.password),
            role="admin",
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        self.db.refresh(org)

        return create_access_token(user.id, org.id), user, org

    def login(self, payload: LoginRequest) -> Tuple[str, User, Organization]:
        user = self._user_by_email(payload.email)
        if user is None or not user.is_active or not verify_password(payload.password, user.password_hash):
            raise InvalidCredentialsError()

        org = self.db.get(Organization, user.org_id)
        return create_access_token(user.id, user.org_id), user, org

    def get_user(self, user_id: uuid.UUID) -> Optional[User]:
        user = self.db.get(User, user_id)
        if user is None or not user.is_active:
            return None
        return user

    # ---- user management (admin) ----

    def list_users(self, org_id: uuid.UUID) -> List[User]:
        stmt = select(User).where(User.org_id == org_id).order_by(User.created_at)
        return list(self.db.execute(stmt).scalars().all())

    def create_user(self, org_id: uuid.UUID, payload: UserCreate) -> User:
        if payload.role not in VALID_ROLES:
            raise InvalidRoleError(payload.role)
        if self._user_by_email(payload.email) is not None:
            raise EmailAlreadyRegisteredError(payload.email)
        user = User(
            org_id=org_id,
            name=payload.name.strip(),
            email=payload.email.lower(),
            password_hash=hash_password(payload.password),
            role=payload.role,
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def update_user(
        self, org_id: uuid.UUID, acting_user_id: uuid.UUID, user_id: uuid.UUID, payload: UserRoleUpdate
    ) -> User:
        if user_id == acting_user_id:
            # Guard against locking yourself out of admin / deactivating self.
            raise SelfModificationError()
        user = self.db.get(User, user_id)
        if user is None or user.org_id != org_id:
            raise UserNotFoundError(user_id)
        if payload.role is not None:
            if payload.role not in VALID_ROLES:
                raise InvalidRoleError(payload.role)
            user.role = payload.role
        if payload.is_active is not None:
            user.is_active = payload.is_active
        self.db.commit()
        self.db.refresh(user)
        return user
