import uuid
from datetime import date

import pytest
from fastapi.testclient import TestClient

from app.core.database import get_db
from app.core.deps import CurrentUser, get_current_user
from app.main import app

ALL_PERMISSIONS = frozenset(
    {
        "worker:view",
        "worker:create",
        "worker:edit",
        "worker:archive",
        "labour:attendance:create",
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


def create_worker(client, code="W-01", rate=600, **overrides):
    payload = {"name": "Ramesh", "code": code, "default_wage_rate": rate, "trade": "mason", **overrides}
    return client.post("/api/v1/workers", json=payload)


def mark(client, site_id, worker_id, day="2026-07-20", status="present", **overrides):
    payload = {"worker_id": worker_id, "work_date": day, "status": status, **overrides}
    return client.post(f"/api/v1/sites/{site_id}/labour/attendance", json=payload)


class TestWorkerEndpoints:
    def test_creates_and_fetches_worker(self, client):
        created = create_worker(client)
        assert created.status_code == 201, created.text
        wid = created.json()["id"]
        got = client.get(f"/api/v1/workers/{wid}")
        assert got.status_code == 200
        assert got.json()["trade"] == "mason"
        assert float(got.json()["default_wage_rate"]) == 600

    def test_rejects_duplicate_code(self, client):
        create_worker(client)
        assert create_worker(client).status_code == 409

    def test_archives_worker(self, client):
        wid = create_worker(client).json()["id"]
        assert client.delete(f"/api/v1/workers/{wid}").status_code == 204
        assert client.get(f"/api/v1/workers/{wid}").status_code == 404


class TestAttendanceAndWages:
    def test_present_pays_full_day_rate(self, client):
        wid = create_worker(client, rate=600).json()["id"]
        site = uuid.uuid4()
        r = mark(client, site, wid, status="present")
        assert r.status_code == 201, r.text
        assert float(r.json()["wage_amount"]) == 600.0

    def test_half_day_pays_half(self, client):
        wid = create_worker(client, rate=600).json()["id"]
        r = mark(client, uuid.uuid4(), wid, status="half_day")
        assert float(r.json()["wage_amount"]) == 300.0

    def test_absent_pays_zero(self, client):
        wid = create_worker(client, rate=600).json()["id"]
        r = mark(client, uuid.uuid4(), wid, status="absent")
        assert float(r.json()["wage_amount"]) == 0.0

    def test_overtime_added_at_hourly_equivalent(self, client):
        # 600/day, 2h OT -> 600 + (600/8)*2 = 750
        wid = create_worker(client, rate=600).json()["id"]
        r = mark(client, uuid.uuid4(), wid, status="present", overtime_hours=2)
        assert float(r.json()["wage_amount"]) == 750.0

    def test_wage_rate_override(self, client):
        wid = create_worker(client, rate=600).json()["id"]
        r = mark(client, uuid.uuid4(), wid, status="present", wage_rate=800)
        assert float(r.json()["wage_amount"]) == 800.0

    def test_duplicate_worker_same_day_rejected(self, client):
        wid = create_worker(client).json()["id"]
        site = uuid.uuid4()
        assert mark(client, site, wid, day="2026-07-20").status_code == 201
        assert mark(client, site, wid, day="2026-07-20").status_code == 409

    def test_unknown_worker_rejected(self, client):
        r = mark(client, uuid.uuid4(), str(uuid.uuid4()))
        assert r.status_code == 404

    def test_wage_summary_rollup(self, client):
        wid = create_worker(client, rate=600).json()["id"]
        site = uuid.uuid4()
        mark(client, site, wid, day="2026-07-18", status="present")
        mark(client, site, wid, day="2026-07-19", status="half_day")
        mark(client, site, wid, day="2026-07-20", status="present", overtime_hours=2)

        summary = client.get(f"/api/v1/sites/{site}/labour/summary")
        assert summary.status_code == 200
        row = summary.json()[0]
        assert row["days_present"] == 2.5  # 1 + 0.5 + 1
        assert row["total_overtime_hours"] == 2.0
        assert row["total_wages"] == 600 + 300 + 750  # 1650

    def test_attendance_list_filtered_by_date(self, client):
        wid = create_worker(client).json()["id"]
        site = uuid.uuid4()
        mark(client, site, wid, day="2026-07-19")
        mark(client, site, wid, day="2026-07-20")
        all_days = client.get(f"/api/v1/sites/{site}/labour/attendance")
        assert len(all_days.json()) == 2
        one_day = client.get(f"/api/v1/sites/{site}/labour/attendance?date=2026-07-20")
        assert len(one_day.json()) == 1


class TestOrgIsolation:
    def test_worker_not_visible_across_orgs(self, db, org_id, user_id):
        # Org A creates a worker.
        def use_db():
            yield db

        app.dependency_overrides[get_db] = use_db
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(
            id=str(user_id), org_id=str(org_id), permissions=ALL_PERMISSIONS
        )
        a = TestClient(app)
        wid = create_worker(a, code="SHARED").json()["id"]

        # Org B (different org) must not see it.
        other_org = uuid.uuid4()
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(
            id=str(uuid.uuid4()), org_id=str(other_org), permissions=ALL_PERMISSIONS
        )
        b = TestClient(app)
        assert b.get(f"/api/v1/workers/{wid}").status_code == 404
        assert b.get("/api/v1/workers").json()["total"] == 0
        app.dependency_overrides.clear()
