import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.database import get_db
from app.core.deps import CurrentUser, get_current_user
from app.main import app

ALL_PERMISSIONS = frozenset({"progress:view", "progress:edit"})


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


def add_ms(client, site, title="Foundation", progress=0, weight=1, **ov):
    return client.post(
        f"/api/v1/sites/{site}/milestones",
        json={"title": title, "progress_percent": progress, "weight": weight, **ov},
    )


class TestMilestones:
    def test_add_and_list(self, client):
        site = str(uuid.uuid4())
        assert add_ms(client, site, "Foundation").status_code == 201
        assert add_ms(client, site, "Structure").status_code == 201
        assert len(client.get(f"/api/v1/sites/{site}/milestones").json()) == 2

    def test_unweighted_overall_is_simple_average(self, client):
        site = str(uuid.uuid4())
        add_ms(client, site, "A", progress=100)
        add_ms(client, site, "B", progress=0)
        add_ms(client, site, "C", progress=50)
        s = client.get(f"/api/v1/sites/{site}/milestones/summary").json()
        assert s["overall_percent"] == 50.0  # (100+0+50)/3
        assert s["milestone_count"] == 3

    def test_weighted_overall(self, client):
        site = str(uuid.uuid4())
        add_ms(client, site, "Big", progress=100, weight=3)
        add_ms(client, site, "Small", progress=0, weight=1)
        s = client.get(f"/api/v1/sites/{site}/milestones/summary").json()
        # (100*3 + 0*1) / 4 = 75
        assert s["overall_percent"] == 75.0

    def test_status_counts(self, client):
        site = str(uuid.uuid4())
        add_ms(client, site, "A", status="completed")
        add_ms(client, site, "B", status="in_progress")
        add_ms(client, site, "C", status="in_progress")
        s = client.get(f"/api/v1/sites/{site}/milestones/summary").json()
        assert s["by_status"] == {"completed": 1, "in_progress": 2}

    def test_update_progress_and_status(self, client):
        site = str(uuid.uuid4())
        mid = add_ms(client, site, "A").json()["id"]
        r = client.patch(
            f"/api/v1/sites/{site}/milestones/{mid}",
            json={"progress_percent": 80, "status": "in_progress", "actual_date": "2026-07-25"},
        )
        assert r.status_code == 200
        assert r.json()["progress_percent"] == 80.0
        assert r.json()["actual_date"] == "2026-07-25"

    def test_delete(self, client):
        site = str(uuid.uuid4())
        mid = add_ms(client, site, "A").json()["id"]
        assert client.delete(f"/api/v1/sites/{site}/milestones/{mid}").status_code == 204
        assert client.get(f"/api/v1/sites/{site}/milestones").json() == []


class TestOrgIsolation:
    def test_milestones_not_visible_across_orgs(self, db, org_id, user_id):
        site = str(uuid.uuid4())

        def use_db():
            yield db

        app.dependency_overrides[get_db] = use_db
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(
            id=str(user_id), org_id=str(org_id), permissions=ALL_PERMISSIONS
        )
        a = TestClient(app)
        add_ms(a, site, "Secret", progress=100)

        other = uuid.uuid4()
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(
            id=str(uuid.uuid4()), org_id=str(other), permissions=ALL_PERMISSIONS
        )
        b = TestClient(app)
        assert b.get(f"/api/v1/sites/{site}/milestones").json() == []
        assert b.get(f"/api/v1/sites/{site}/milestones/summary").json()["overall_percent"] == 0.0
        app.dependency_overrides.clear()
