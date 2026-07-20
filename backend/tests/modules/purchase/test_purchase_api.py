import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.database import get_db
from app.core.deps import CurrentUser, get_current_user
from app.main import app

ALL_PERMISSIONS = frozenset(
    {
        "po:view",
        "po:create",
        "po:edit",
        "po:cancel",
        "vendor:view",
        "vendor:create",
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


def make_vendor(client, code="V-01"):
    return client.post("/api/v1/vendors", json={"name": "Steel Co", "code": code}).json()["id"]


def make_po(client, vendor_id, number="PO-01", lines=None):
    if lines is None:
        lines = [
            {"description": "Cement", "quantity": 100, "unit": "bag", "unit_price": 400},
            {"description": "Steel", "quantity": 2, "unit": "ton", "unit_price": 55000},
        ]
    payload = {
        "po_number": number,
        "vendor_id": vendor_id,
        "order_date": "2026-07-20",
        "lines": lines,
    }
    return client.post("/api/v1/purchase-orders", json=payload)


class TestPurchaseOrderEndpoints:
    def test_creates_po_with_computed_total(self, client):
        vid = make_vendor(client)
        r = make_po(client, vid)
        assert r.status_code == 201, r.text
        body = r.json()
        # 100*400 + 2*55000 = 40000 + 110000 = 150000
        assert body["total_amount"] == 150000.0
        assert len(body["lines"]) == 2
        assert body["lines"][0]["line_total"] == 40000.0
        assert body["status"] == "draft"

    def test_rejects_duplicate_po_number(self, client):
        vid = make_vendor(client)
        make_po(client, vid)
        assert make_po(client, vid).status_code == 409

    def test_rejects_unknown_vendor(self, client):
        r = make_po(client, str(uuid.uuid4()))
        assert r.status_code == 404

    def test_requires_at_least_one_line(self, client):
        vid = make_vendor(client)
        r = make_po(client, vid, lines=[])
        assert r.status_code == 422

    def test_get_and_list(self, client):
        vid = make_vendor(client)
        po_id = make_po(client, vid).json()["id"]

        got = client.get(f"/api/v1/purchase-orders/{po_id}")
        assert got.status_code == 200
        assert got.json()["total_amount"] == 150000.0

        listing = client.get("/api/v1/purchase-orders")
        assert listing.status_code == 200
        assert listing.json()["total"] == 1
        assert listing.json()["items"][0]["total_amount"] == 150000.0

    def test_update_status(self, client):
        vid = make_vendor(client)
        po_id = make_po(client, vid).json()["id"]
        r = client.patch(f"/api/v1/purchase-orders/{po_id}", json={"status": "sent"})
        assert r.status_code == 200
        assert r.json()["status"] == "sent"

    def test_cancel_soft_deletes(self, client):
        vid = make_vendor(client)
        po_id = make_po(client, vid).json()["id"]
        assert client.delete(f"/api/v1/purchase-orders/{po_id}").status_code == 204
        assert client.get(f"/api/v1/purchase-orders/{po_id}").status_code == 404


class TestOrgIsolation:
    def test_po_not_visible_across_orgs(self, db, org_id, user_id):
        def use_db():
            yield db

        app.dependency_overrides[get_db] = use_db
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(
            id=str(user_id), org_id=str(org_id), permissions=ALL_PERMISSIONS
        )
        a = TestClient(app)
        vid = make_vendor(a)
        po_id = make_po(a, vid).json()["id"]

        other_org = uuid.uuid4()
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(
            id=str(uuid.uuid4()), org_id=str(other_org), permissions=ALL_PERMISSIONS
        )
        b = TestClient(app)
        assert b.get(f"/api/v1/purchase-orders/{po_id}").status_code == 404
        assert b.get("/api/v1/purchase-orders").json()["total"] == 0
        app.dependency_overrides.clear()
