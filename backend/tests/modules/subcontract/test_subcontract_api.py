import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.database import get_db
from app.core.deps import CurrentUser, get_current_user
from app.main import app

ALL_PERMISSIONS = frozenset(
    {
        "subcontractor:view", "subcontractor:create", "subcontractor:edit", "subcontractor:archive",
        "workorder:view", "workorder:create", "workorder:edit", "workorder:delete", "workorder:payment",
    }
)


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


def make_sub(client, code="SC-01"):
    return client.post(
        "/api/v1/subcontractors", json={"name": "Sharma Tiling", "code": code, "trade": "Tiling"}
    )


def make_wo(client, sub_id, number="WO-01", value=200000, site=None):
    return client.post(
        "/api/v1/work-orders",
        json={
            "wo_number": number,
            "site_id": site or str(uuid.uuid4()),
            "subcontractor_id": sub_id,
            "title": "Second floor tiling",
            "order_date": "2026-07-20",
            "wo_value": value,
        },
    )


class TestSubcontractors:
    def test_create_and_duplicate(self, client):
        assert make_sub(client).status_code == 201
        assert make_sub(client).status_code == 409

    def test_archive(self, client):
        sid = make_sub(client).json()["id"]
        assert client.delete(f"/api/v1/subcontractors/{sid}").status_code == 204
        assert client.get(f"/api/v1/subcontractors/{sid}").status_code == 404


class TestWorkOrders:
    def test_create_requires_valid_subcontractor(self, client):
        assert make_wo(client, str(uuid.uuid4())).status_code == 404

    def test_create_and_balance(self, client):
        sid = make_sub(client).json()["id"]
        r = make_wo(client, sid, value=200000)
        assert r.status_code == 201, r.text
        wo = r.json()
        assert wo["wo_value"] == 200000.0
        assert wo["total_paid"] == 0.0
        assert wo["balance"] == 200000.0
        assert wo["status"] == "open"

    def test_duplicate_wo_number(self, client):
        sid = make_sub(client).json()["id"]
        make_wo(client, sid)
        assert make_wo(client, sid).status_code == 409

    def test_payments_reduce_balance(self, client):
        sid = make_sub(client).json()["id"]
        wo_id = make_wo(client, sid, value=200000).json()["id"]
        client.post(f"/api/v1/work-orders/{wo_id}/payments", json={"amount": 50000, "payment_date": "2026-07-21"})
        r = client.post(f"/api/v1/work-orders/{wo_id}/payments", json={"amount": 30000, "payment_date": "2026-07-22"})
        wo = r.json()
        assert wo["total_paid"] == 80000.0
        assert wo["balance"] == 120000.0
        assert len(wo["payments"]) == 2

    def test_update_progress_and_status(self, client):
        sid = make_sub(client).json()["id"]
        wo_id = make_wo(client, sid).json()["id"]
        r = client.patch(
            f"/api/v1/work-orders/{wo_id}", json={"progress_percent": 60, "status": "in_progress"}
        )
        assert r.status_code == 200
        assert r.json()["progress_percent"] == 60.0
        assert r.json()["status"] == "in_progress"

    def test_list_has_balance(self, client):
        sid = make_sub(client).json()["id"]
        wo_id = make_wo(client, sid, value=100000).json()["id"]
        client.post(f"/api/v1/work-orders/{wo_id}/payments", json={"amount": 40000, "payment_date": "2026-07-21"})
        row = client.get("/api/v1/work-orders").json()["items"][0]
        assert row["total_paid"] == 40000.0
        assert row["balance"] == 60000.0


class TestOrgIsolation:
    def test_wo_not_visible_across_orgs(self, db, org_id, user_id):
        def use_db():
            yield db

        app.dependency_overrides[get_db] = use_db
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(
            id=str(user_id), org_id=str(org_id), permissions=ALL_PERMISSIONS
        )
        a = TestClient(app)
        sid = make_sub(a).json()["id"]
        wo_id = make_wo(a, sid).json()["id"]

        other = uuid.uuid4()
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(
            id=str(uuid.uuid4()), org_id=str(other), permissions=ALL_PERMISSIONS
        )
        b = TestClient(app)
        assert b.get(f"/api/v1/work-orders/{wo_id}").status_code == 404
        assert b.get("/api/v1/work-orders").json()["total"] == 0
        assert b.get("/api/v1/subcontractors").json()["total"] == 0
        app.dependency_overrides.clear()
