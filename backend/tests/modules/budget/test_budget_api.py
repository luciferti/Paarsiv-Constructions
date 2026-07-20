import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.database import get_db
from app.core.deps import CurrentUser, get_current_user
from app.main import app

ALL_PERMISSIONS = frozenset(
    {
        "budget:view",
        "budget:edit",
        "worker:create",
        "labour:attendance:create",
        "material:create",
        "material:entry:create",
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


def add_line(client, site, category="Material", amount=500000, **ov):
    return client.post(
        f"/api/v1/sites/{site}/budget/lines",
        json={"category": category, "budgeted_amount": amount, **ov},
    )


class TestBudgetLines:
    def test_add_and_list_lines(self, client):
        site = str(uuid.uuid4())
        assert add_line(client, site, "Material", 500000).status_code == 201
        assert add_line(client, site, "Labour", 300000).status_code == 201
        lines = client.get(f"/api/v1/sites/{site}/budget/lines")
        assert lines.status_code == 200
        assert len(lines.json()) == 2

    def test_summary_totals_and_category_grouping(self, client):
        site = str(uuid.uuid4())
        add_line(client, site, "Material", 500000)
        add_line(client, site, "Material", 100000)  # second material line
        add_line(client, site, "Labour", 300000)

        summary = client.get(f"/api/v1/sites/{site}/budget/summary").json()
        assert summary["total_budgeted"] == 900000.0
        cats = {row["category"]: row["budgeted"] for row in summary["budget_by_category"]}
        assert cats == {"Material": 600000.0, "Labour": 300000.0}
        # No actuals logged yet.
        assert summary["actual_total"] == 0.0
        assert summary["variance"] == 900000.0
        assert summary["percent_used"] == 0.0

    def test_delete_line(self, client):
        site = str(uuid.uuid4())
        line_id = add_line(client, site).json()["id"]
        assert client.delete(f"/api/v1/sites/{site}/budget/lines/{line_id}").status_code == 204
        assert client.get(f"/api/v1/sites/{site}/budget/lines").json() == []


class TestActualsRollup:
    def test_labour_and_material_actuals_feed_budget(self, client):
        site = str(uuid.uuid4())
        add_line(client, site, "Labour", 100000)
        add_line(client, site, "Material", 100000)

        # Labour actual: 1 present day @ 600.
        worker = client.post(
            "/api/v1/workers", json={"name": "R", "code": "W-1", "default_wage_rate": 600}
        ).json()["id"]
        client.post(
            f"/api/v1/sites/{site}/labour/attendance",
            json={"worker_id": worker, "work_date": "2026-07-20", "status": "present"},
        )

        # Material actual: received 10 bags @ 400 = 4000.
        material = client.post(
            "/api/v1/materials", json={"name": "Cement", "code": "C-1", "unit": "bag"}
        ).json()["id"]
        client.post(
            f"/api/v1/sites/{site}/materials/entries",
            json={
                "material_id": material,
                "entry_type": "received",
                "quantity": 10,
                "unit_cost": 400,
                "entry_date": "2026-07-20",
            },
        )

        summary = client.get(f"/api/v1/sites/{site}/budget/summary").json()
        assert summary["actual_labour"] == 600.0
        assert summary["actual_material"] == 4000.0
        assert summary["actual_total"] == 4600.0
        assert summary["total_budgeted"] == 200000.0
        assert summary["variance"] == 195400.0
        assert summary["percent_used"] == 2.3  # 4600 / 200000 * 100


class TestOrgIsolation:
    def test_budget_not_visible_across_orgs(self, db, org_id, user_id):
        site = str(uuid.uuid4())

        def use_db():
            yield db

        app.dependency_overrides[get_db] = use_db
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(
            id=str(user_id), org_id=str(org_id), permissions=ALL_PERMISSIONS
        )
        a = TestClient(app)
        add_line(a, site, "Material", 500000)

        other = uuid.uuid4()
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(
            id=str(uuid.uuid4()), org_id=str(other), permissions=ALL_PERMISSIONS
        )
        b = TestClient(app)
        assert b.get(f"/api/v1/sites/{site}/budget/lines").json() == []
        assert b.get(f"/api/v1/sites/{site}/budget/summary").json()["total_budgeted"] == 0.0
        app.dependency_overrides.clear()
