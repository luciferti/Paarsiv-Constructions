import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import CurrentUser, get_current_user
from app.modules.auth.schemas.auth_schema import (
    AuthResponse,
    LoginRequest,
    SignupRequest,
    UserOut,
)
from app.modules.auth.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


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
