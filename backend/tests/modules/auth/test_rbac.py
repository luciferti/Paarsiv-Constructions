import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.database import get_db
from app.core.deps import CurrentUser, get_current_user
from app.core.permissions import permissions_for_role
from app.main import app


def as_role(role: str, org_id, user_id=None):
    return CurrentUser(
        id=str(user_id or uuid.uuid4()),
        org_id=str(org_id),
        permissions=permissions_for_role(role),
        role=role,
    )


@pytest.fixture()
def make_client(db, org_id):
    def _make(role: str, user_id=None):
        def override_get_db():
            yield db

        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[get_current_user] = lambda: as_role(role, org_id, user_id)
        return TestClient(app)

    yield _make
    app.dependency_overrides.clear()


class TestPermissionMatrix:
    def test_admin_all(self):
        p = permissions_for_role("admin")
        assert "users:manage" in p and "site:create" in p and "bill:delete" in p

    def test_viewer_read_only(self):
        p = permissions_for_role("viewer")
        assert "site:view" in p
        assert "site:create" not in p and "bill:view" in p and "bill:create" not in p

    def test_accountant_financial_only(self):
        p = permissions_for_role("accountant")
        assert "bill:create" in p and "invoice:review" in p and "budget:edit" in p
        assert "site:create" not in p and "worker:create" not in p

    def test_site_engineer_ops_only(self):
        p = permissions_for_role("site_engineer")
        assert "site:create" in p and "material:transfer" in p and "safety:create" in p
        assert "bill:create" not in p and "users:manage" not in p

    def test_unknown_role_defaults_viewer(self):
        p = permissions_for_role("intern")
        assert "site:view" in p and "site:create" not in p


class TestEndpointEnforcement:
    def test_viewer_can_read_not_write_sites(self, make_client):
        viewer = make_client("viewer")
        assert viewer.get("/api/v1/sites").status_code == 200
        r = viewer.post("/api/v1/sites", json={"name": "X", "code": "X-1"})
        assert r.status_code == 403

    def test_site_engineer_creates_site_but_not_bill(self, make_client):
        eng = make_client("site_engineer")
        assert eng.post("/api/v1/sites", json={"name": "Tower", "code": "T-1"}).status_code == 201
        bill = eng.post(
            "/api/v1/client-bills",
            json={"site_id": str(uuid.uuid4()), "bill_number": "RA-1", "bill_date": "2026-07-20", "gross_amount": 1000},
        )
        assert bill.status_code == 403

    def test_accountant_creates_bill_but_not_site(self, make_client):
        acc = make_client("accountant")
        site = acc.post("/api/v1/sites", json={"name": "Y", "code": "Y-1"})
        assert site.status_code == 403
        bill = acc.post(
            "/api/v1/client-bills",
            json={"site_id": str(uuid.uuid4()), "bill_number": "RA-9", "bill_date": "2026-07-20", "gross_amount": 5000},
        )
        assert bill.status_code == 201


class TestUserManagement:
    def test_admin_lists_creates_updates(self, make_client):
        admin = make_client("admin", user_id=uuid.uuid4())
        # Initially no DB users for this org (auth overridden), list is empty.
        assert admin.get("/api/v1/auth/users").status_code == 200

        created = admin.post(
            "/api/v1/auth/users",
            json={"name": "Asha Rao", "email": "asha@example.com", "password": "password123", "role": "accountant"},
        )
        assert created.status_code == 201, created.text
        uid = created.json()["id"]
        assert created.json()["role"] == "accountant"

        upd = admin.patch(f"/api/v1/auth/users/{uid}", json={"role": "site_engineer"})
        assert upd.status_code == 200
        assert upd.json()["role"] == "site_engineer"

    def test_invalid_role_rejected(self, make_client):
        admin = make_client("admin")
        r = admin.post(
            "/api/v1/auth/users",
            json={"name": "Bad", "email": "bad@example.com", "password": "password123", "role": "superuser"},
        )
        assert r.status_code == 400

    def test_cannot_modify_self(self, make_client):
        me = uuid.uuid4()
        admin = make_client("admin", user_id=me)
        r = admin.patch(f"/api/v1/auth/users/{me}", json={"role": "viewer"})
        assert r.status_code == 400

    def test_non_admin_cannot_manage_users(self, make_client):
        manager = make_client("manager")
        assert manager.get("/api/v1/auth/users").status_code == 403
        viewer = make_client("viewer")
        assert viewer.get("/api/v1/auth/users").status_code == 403
