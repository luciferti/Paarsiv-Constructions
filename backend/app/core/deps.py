"""
Authentication dependencies.

`get_current_user` verifies the Bearer JWT issued by the auth module
(app/modules/auth) and loads the active user. `demo_mode` short-circuits
this with a fixed full-permission user for local preview only.

TODO(rbac): permissions are all-or-nothing per authenticated user today
(`_AllPermissions`). When granular roles matter, derive the permission
set from `User.role` here — the `require_permission` checks throughout
the modules already enforce whatever set is returned.
"""

from dataclasses import dataclass
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import decode_access_token

bearer_scheme = HTTPBearer(auto_error=False)
settings = get_settings()

_DEMO_USER_ID = "00000000-0000-0000-0000-000000000001"
_DEMO_ORG_ID = "00000000-0000-0000-0000-000000000000"


class _AllPermissions:
    """Full-access permission set — contains every permission string."""

    def __contains__(self, item: object) -> bool:
        return True


_DEMO_PERMISSIONS = _AllPermissions()


@dataclass(frozen=True)
class CurrentUser:
    id: str
    org_id: str
    permissions: object


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> CurrentUser:
    if settings.demo_mode:
        return CurrentUser(id=_DEMO_USER_ID, org_id=_DEMO_ORG_ID, permissions=_DEMO_PERMISSIONS)

    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
        )

    payload = decode_access_token(credentials.credentials)
    if payload is None or "sub" not in payload or "org_id" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token"
        )

    # Confirm the user still exists and is active — a revoked/deactivated
    # user's outstanding tokens stop working immediately.
    from app.modules.auth.models.auth_model import User

    import uuid as _uuid

    user = db.get(User, _uuid.UUID(payload["sub"]))
    if user is None or not user.is_active or str(user.org_id) != payload["org_id"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token"
        )

    return CurrentUser(id=str(user.id), org_id=str(user.org_id), permissions=_AllPermissions())


def require_permission(permission: str):
    def dependency(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if permission not in user.permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing required permission: {permission}",
            )
        return user

    return dependency
