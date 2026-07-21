import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.database import get_db
from app.core.deps import CurrentUser, get_current_user
from app.main import app

ALL_PERMISSIONS = frozenset(
    {
        "equipment:view", "equipment:create", "equipment:edit", "equipment:archive",
        "equipment:usage:create", "equipment:maintenance:create",
        "budget:view", "budget:edit",
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


def make_eq(client, code="EQ-01", rate=5000, **ov):
    return client.post(
        "/api/v1/equipment",
        json={"name": "JCB Excavator", "code": code, "category": "Earthmoving",
              "ownership": "rented", "rental_rate": rate, **ov},
    )


class TestEquipment:
    def test_create_and_duplicate(self, client):
        assert make_eq(client).status_code == 201
        assert make_eq(client).status_code == 409

    def test_archive(self, client):
        eid = make_eq(client).json()["id"]
        assert client.delete(f"/api/v1/equipment/{eid}").status_code == 204
        assert client.get(f"/api/v1/equipment/{eid}").status_code == 404


class TestUsage:
    def test_cost_prefilled_from_rate(self, client):
        eid = make_eq(client, rate=5000).json()["id"]
        site = str(uuid.uuid4())
        # 3 days, no explicit cost -> 3 * 5000 = 15000
        r = client.post(
            f"/api/v1/sites/{site}/equipment/usage",
            json={"equipment_id": eid, "usage_date": "2026-07-20", "quantity": 3},
        )
        assert r.status_code == 201, r.text
        assert r.json()["cost"] == 15000.0

    def test_explicit_cost_wins(self, client):
        eid = make_eq(client, rate=5000).json()["id"]
        site = str(uuid.uuid4())
        r = client.post(
            f"/api/v1/sites/{site}/equipment/usage",
            json={"equipment_id": eid, "usage_date": "2026-07-20", "quantity": 3, "cost": 12000},
        )
        assert r.json()["cost"] == 12000.0

    def test_unknown_equipment_rejected(self, client):
        site = str(uuid.uuid4())
        r = client.post(
            f"/api/v1/sites/{site}/equipment/usage",
            json={"equipment_id": str(uuid.uuid4()), "usage_date": "2026-07-20", "quantity": 1},
        )
        assert r.status_code == 404

    def test_cost_summary_per_site(self, client):
        eid = make_eq(client, rate=5000).json()["id"]
        site = str(uuid.uuid4())
        client.post(f"/api/v1/sites/{site}/equipment/usage", json={"equipment_id": eid, "usage_date": "2026-07-20", "quantity": 2})
        client.post(f"/api/v1/sites/{site}/equipment/usage", json={"equipment_id": eid, "usage_date": "2026-07-21", "quantity": 1})
        summary = client.get(f"/api/v1/sites/{site}/equipment/cost-summary").json()
        assert summary[0]["total_quantity"] == 3.0
        assert summary[0]["total_cost"] == 15000.0


class TestMaintenance:
    def test_add_and_list(self, client):
        eid = make_eq(client).json()["id"]
        r = client.post(
            f"/api/v1/equipment/{eid}/maintenance",
            json={"service_date": "2026-07-20", "description": "Oil change", "cost": 2500},
        )
        assert r.status_code == 201
        logs = client.get(f"/api/v1/equipment/{eid}/maintenance").json()
        assert len(logs) == 1
        assert logs[0]["cost"] == 2500.0


class TestBudgetIntegration:
    def test_equipment_cost_feeds_budget_actuals(self, client):
        eid = make_eq(client, rate=5000).json()["id"]
        site = str(uuid.uuid4())
        client.post(f"/api/v1/sites/{site}/budget/lines", json={"category": "Equipment", "budgeted_amount": 100000})
        client.post(f"/api/v1/sites/{site}/equipment/usage", json={"equipment_id": eid, "usage_date": "2026-07-20", "quantity": 2})  # 10000
        summary = client.get(f"/api/v1/sites/{site}/budget/summary").json()
        assert summary["actual_equipment"] == 10000.0
        assert summary["actual_total"] == 10000.0


class TestOrgIsolation:
    def test_equipment_not_visible_across_orgs(self, db, org_id, user_id):
        def use_db():
            yield db

        app.dependency_overrides[get_db] = use_db
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(
            id=str(user_id), org_id=str(org_id), permissions=ALL_PERMISSIONS
        )
        a = TestClient(app)
        eid = make_eq(a).json()["id"]

        other = uuid.uuid4()
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(
            id=str(uuid.uuid4()), org_id=str(other), permissions=ALL_PERMISSIONS
        )
        b = TestClient(app)
        assert b.get(f"/api/v1/equipment/{eid}").status_code == 404
        assert b.get("/api/v1/equipment").json()["total"] == 0
        app.dependency_overrides.clear()
