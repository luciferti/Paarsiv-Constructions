"""
Role-based permission sets.

Every `require_permission("resource:action")` guard across the modules checks
membership in the current user's permission set. This maps a user's `role` to a
rule-based set so those guards become meaningful, without enumerating all ~75
permission strings per role.

Roles:
  - admin         full access, including user management and integration setup
  - manager       everything operational + financial; no user mgmt / setup
  - accountant    full on financial resources; view-only elsewhere
  - site_engineer full on operational resources; view-only on financial
  - viewer        read-only everywhere

Permissions are "resource:...:action" — the first segment is the resource, the
last is the action (e.g. material:entry:create → resource "material", action
"create"). Unknown roles fall back to viewer (least privilege).
"""
from __future__ import annotations

FINANCIAL = {"bill", "budget", "expense", "invoice", "po"}
OPERATIONAL = {
    "site", "material", "worker", "labour", "equipment", "report", "safety",
    "progress", "subcontractor", "workorder", "document", "summary", "notification",
    "vendor",
}
# Admin-only permissions no other role may hold.
ADMIN_ONLY = {"users:manage", "demo:seed", "messaging:admin"}

VALID_ROLES = ("admin", "manager", "accountant", "site_engineer", "viewer")


def _resource(perm: str) -> str:
    return perm.split(":", 1)[0]


def _action(perm: str) -> str:
    return perm.rsplit(":", 1)[-1]


class RolePermissions:
    """A permission set for one role; membership decided by rule."""

    def __init__(self, role: str):
        self.role = role if role in VALID_ROLES else "viewer"

    def __contains__(self, perm: object) -> bool:
        if not isinstance(perm, str):
            return False
        role = self.role

        if role == "admin":
            return True

        if perm in ADMIN_ONLY:
            return False

        if role == "manager":
            return True  # all non-admin-only permissions

        action = _action(perm)
        resource = _resource(perm)

        # Everyone (accountant/site_engineer/viewer) can read, and use the assistant.
        if action == "view" or perm == "assistant:use":
            return True

        if role == "accountant":
            return resource in FINANCIAL
        if role == "site_engineer":
            return resource in OPERATIONAL
        # viewer: read-only (already handled the view/assistant cases above)
        return False


def permissions_for_role(role: str) -> RolePermissions:
    return RolePermissions(role)
