import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.database import get_db
from app.core.deps import CurrentUser, get_current_user
from app.main import app

ALL_PERMISSIONS = frozenset(
    {"bill:view", "bill:create", "bill:edit", "bill:delete"}
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


def make_bill(client, number="RA-1", site=None, gross=1000000, **ov):
    payload = {
        "site_id": site or str(uuid.uuid4()),
        "bill_number": number,
        "bill_date": "2026-07-20",
        "gross_amount": gross,
        "retention_percent": 5,
        "tds_percent": 2,
        "other_deductions": 0,
        **ov,
    }
    return client.post("/api/v1/client-bills", json=payload)


class TestClientBills:
    def test_creates_bill_with_deductions(self, client):
        r = make_bill(client)
        assert r.status_code == 201, r.text
        b = r.json()
        # gross 1,000,000; retention 5% = 50,000; tds 2% = 20,000; net = 930,000
        assert b["retention_amount"] == 50000.0
        assert b["tds_amount"] == 20000.0
        assert b["net_payable"] == 930000.0
        assert b["status"] == "draft"

    def test_other_deductions_reduce_net(self, client):
        b = make_bill(client, gross=100000, retention_percent=0, tds_percent=0, other_deductions=1500).json()
        assert b["net_payable"] == 98500.0

    def test_rejects_duplicate_bill_number(self, client):
        make_bill(client)
        assert make_bill(client).status_code == 409

    def test_status_workflow(self, client):
        bid = make_bill(client).json()["id"]
        for st in ["submitted", "certified", "paid"]:
            r = client.patch(f"/api/v1/client-bills/{bid}", json={"status": st})
            assert r.status_code == 200
            assert r.json()["status"] == st

    def test_list_has_net_payable(self, client):
        make_bill(client)
        listing = client.get("/api/v1/client-bills").json()
        assert listing["total"] == 1
        assert listing["items"][0]["net_payable"] == 930000.0

    def test_summary_paid_vs_outstanding(self, client):
        site = str(uuid.uuid4())
        b1 = make_bill(client, "RA-1", site, 1000000).json()["id"]  # net 930000
        make_bill(client, "RA-2", site, 500000)  # net 465000, stays draft
        # certify + pay bill 1
        client.patch(f"/api/v1/client-bills/{b1}", json={"status": "paid"})
        # submit bill 2 -> outstanding
        bills = client.get("/api/v1/client-bills").json()["items"]
        b2 = [b for b in bills if b["bill_number"] == "RA-2"][0]["id"]
        client.patch(f"/api/v1/client-bills/{b2}", json={"status": "submitted"})

        s = client.get(f"/api/v1/client-bills/summary?site_id={site}").json()
        assert s["total_gross"] == 1500000.0
        assert s["total_paid"] == 930000.0
        assert s["total_outstanding"] == 465000.0
        assert s["bill_count"] == 2

    def test_delete_bill(self, client):
        bid = make_bill(client).json()["id"]
        assert client.delete(f"/api/v1/client-bills/{bid}").status_code == 204
        assert client.get(f"/api/v1/client-bills/{bid}").status_code == 404


class TestOrgIsolation:
    def test_bills_not_visible_across_orgs(self, db, org_id, user_id):
        def use_db():
            yield db

        app.dependency_overrides[get_db] = use_db
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(
            id=str(user_id), org_id=str(org_id), permissions=ALL_PERMISSIONS
        )
        a = TestClient(app)
        bid = make_bill(a).json()["id"]

        other = uuid.uuid4()
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(
            id=str(uuid.uuid4()), org_id=str(other), permissions=ALL_PERMISSIONS
        )
        b = TestClient(app)
        assert b.get(f"/api/v1/client-bills/{bid}").status_code == 404
        assert b.get("/api/v1/client-bills").json()["total"] == 0
        app.dependency_overrides.clear()
