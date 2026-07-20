import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.database import get_db
from app.core.deps import CurrentUser, get_current_user
from app.main import app

ALL_PERMISSIONS = frozenset({"expense:view", "expense:create", "expense:delete"})


@pytest.fixture()
def client(db, org_id, user_id):
    def override_get_db():
        yield db

    def override_get_current_user():
        return CurrentUser(id=str(user_id), org_id=str(org_id), permissions=ALL_PERMISSIONS)

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    yield TestClient(app)
    app.dependency_overrides.clear()


def entry(client, **ov):
    payload = {
        "entry_type": "expense",
        "category": "Transport",
        "amount": 500,
        "entry_date": "2026-07-20",
        **ov,
    }
    return client.post("/api/v1/petty-cash/entries", json=payload)


class TestPettyCash:
    def test_topup_and_expense_balance(self, client):
        assert entry(client, entry_type="topup", category=None, amount=10000).status_code == 201
        assert entry(client, category="Transport", amount=1500).status_code == 201
        assert entry(client, category="Food", amount=800).status_code == 201

        s = client.get("/api/v1/petty-cash/summary").json()
        assert s["total_topup"] == 10000.0
        assert s["total_expense"] == 2300.0
        assert s["balance"] == 7700.0

    def test_expense_requires_category(self, client):
        r = entry(client, category=None)
        assert r.status_code == 422

    def test_topup_allows_no_category(self, client):
        assert entry(client, entry_type="topup", category=None, amount=5000).status_code == 201

    def test_amount_must_be_positive(self, client):
        assert entry(client, amount=0).status_code == 422

    def test_expense_by_category(self, client):
        entry(client, entry_type="topup", category=None, amount=10000)
        entry(client, category="Transport", amount=1500)
        entry(client, category="Transport", amount=500)
        entry(client, category="Food", amount=800)
        s = client.get("/api/v1/petty-cash/summary").json()
        cats = {r["category"]: r["amount"] for r in s["expense_by_category"]}
        assert cats == {"Transport": 2000.0, "Food": 800.0}

    def test_delete_entry_updates_balance(self, client):
        entry(client, entry_type="topup", category=None, amount=10000)
        eid = entry(client, category="Transport", amount=1500).json()["id"]
        assert client.delete(f"/api/v1/petty-cash/entries/{eid}").status_code == 204
        assert client.get("/api/v1/petty-cash/summary").json()["balance"] == 10000.0

    def test_site_filter(self, client):
        site = str(uuid.uuid4())
        entry(client, entry_type="topup", category=None, amount=10000, site_id=site)
        entry(client, category="Transport", amount=1500, site_id=site)
        entry(client, category="Food", amount=800)  # no site
        site_summary = client.get(f"/api/v1/petty-cash/summary?site_id={site}").json()
        assert site_summary["total_expense"] == 1500.0
        all_summary = client.get("/api/v1/petty-cash/summary").json()
        assert all_summary["total_expense"] == 2300.0


class TestOrgIsolation:
    def test_entries_not_visible_across_orgs(self, db, org_id, user_id):
        def use_db():
            yield db

        app.dependency_overrides[get_db] = use_db
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(
            id=str(user_id), org_id=str(org_id), permissions=ALL_PERMISSIONS
        )
        a = TestClient(app)
        entry(a, entry_type="topup", category=None, amount=9999)

        other = uuid.uuid4()
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(
            id=str(uuid.uuid4()), org_id=str(other), permissions=ALL_PERMISSIONS
        )
        b = TestClient(app)
        assert b.get("/api/v1/petty-cash/entries").json() == []
        assert b.get("/api/v1/petty-cash/summary").json()["balance"] == 0.0
        app.dependency_overrides.clear()
