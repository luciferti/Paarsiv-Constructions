import uuid
from typing import List

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import CurrentUser, get_current_user, require_permission
from app.modules.auth.schemas.auth_schema import (
    AuthResponse,
    LoginRequest,
    SignupRequest,
    TeamMemberOut,
    UserCreate,
    UserOut,
    UserRoleUpdate,
)
from app.modules.auth.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])

require_users_manage = require_permission("users:manage")


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: SignupRequest, db: Session = Depends(get_db)) -> AuthResponse:
    token, user, org = AuthService(db).signup(payload)
    return AuthResponse(access_token=token, user=UserOut.model_validate(user), org_name=org.name)


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> AuthResponse:
    token, user, org = AuthService(db).login(payload)
    return AuthResponse(access_token=token, user=UserOut.model_validate(user), org_name=org.name)


@router.get("/me", response_model=UserOut)
def me(
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserOut:
    user = AuthService(db).get_user(uuid.UUID(current.id))
    if user is None:
        # Demo mode's synthetic user has no DB row; synthesize the shape.
        return UserOut(
            id=uuid.UUID(current.id),
            org_id=uuid.UUID(current.org_id),
            name="Demo User",
            email="demo@example.com",
            role="admin",
        )
    return UserOut.model_validate(user)


@router.get("/users", response_model=List[TeamMemberOut])
def list_users(
    current: CurrentUser = Depends(require_users_manage),
    db: Session = Depends(get_db),
) -> List[TeamMemberOut]:
    users = AuthService(db).list_users(uuid.UUID(current.org_id))
    return [TeamMemberOut.model_validate(u) for u in users]


@router.post("/users", response_model=TeamMemberOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    current: CurrentUser = Depends(require_users_manage),
    db: Session = Depends(get_db),
) -> TeamMemberOut:
    user = AuthService(db).create_user(uuid.UUID(current.org_id), payload)
    return TeamMemberOut.model_validate(user)


@router.patch("/users/{user_id}", response_model=TeamMemberOut)
def update_user(
    user_id: uuid.UUID,
    payload: UserRoleUpdate,
    current: CurrentUser = Depends(require_users_manage),
    db: Session = Depends(get_db),
) -> TeamMemberOut:
    user = AuthService(db).update_user(
        org_id=uuid.UUID(current.org_id),
        acting_user_id=uuid.UUID(current.id),
        user_id=user_id,
        payload=payload,
    )
    return TeamMemberOut.model_validate(user)
