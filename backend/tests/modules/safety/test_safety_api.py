import uuid
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from app.core.database import get_db
from app.core.deps import CurrentUser, get_current_user
from app.main import app

ALL_PERMISSIONS = frozenset(
    {"safety:view", "safety:create", "safety:edit", "safety:delete"}
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


def make_incident(client, site=None, sev="medium", itype="near_miss", when=None, title="Slip near scaffold", **ov):
    payload = {
        "site_id": site or str(uuid.uuid4()),
        "incident_date": when or str(date.today()),
        "incident_type": itype,
        "severity": sev,
        "title": title,
        **ov,
    }
    return client.post("/api/v1/incidents", json=payload)


class TestIncidents:
    def test_create_and_get(self, client):
        r = make_incident(client, sev="high", itype="injury")
        assert r.status_code == 201, r.text
        iid = r.json()["id"]
        got = client.get(f"/api/v1/incidents/{iid}")
        assert got.status_code == 200
        assert got.json()["severity"] == "high"
        assert got.json()["status"] == "open"

    def test_requires_valid_enums(self, client):
        assert make_incident(client, sev="catastrophic").status_code == 422

    def test_status_workflow(self, client):
        iid = make_incident(client).json()["id"]
        for st in ["investigating", "closed"]:
            r = client.patch(f"/api/v1/incidents/{iid}", json={"status": st})
            assert r.status_code == 200
            assert r.json()["status"] == st

    def test_delete(self, client):
        iid = make_incident(client).json()["id"]
        assert client.delete(f"/api/v1/incidents/{iid}").status_code == 204
        assert client.get(f"/api/v1/incidents/{iid}").status_code == 404

    def test_filter_by_severity(self, client):
        site = str(uuid.uuid4())
        make_incident(client, site=site, sev="low")
        make_incident(client, site=site, sev="critical")
        r = client.get("/api/v1/incidents", params={"severity": "critical"})
        assert r.json()["total"] == 1


class TestSummary:
    def test_summary_counts_and_days_since(self, client):
        site = str(uuid.uuid4())
        make_incident(client, site=site, sev="low", itype="near_miss", when=str(date.today() - timedelta(days=10)))
        make_incident(client, site=site, sev="high", itype="injury", when=str(date.today() - timedelta(days=3)))
        make_incident(client, site=site, sev="high", itype="injury", when=str(date.today() - timedelta(days=3)), title="Second")
        # close one
        listed = client.get("/api/v1/incidents").json()["items"]
        client.patch(f"/api/v1/incidents/{listed[0]['id']}", json={"status": "closed"})

        s = client.get("/api/v1/incidents/summary").json()
        assert s["total"] == 3
        assert s["by_severity"] == {"low": 1, "high": 2}
        assert s["by_type"] == {"near_miss": 1, "injury": 2}
        assert s["open_count"] == 2
        assert s["days_since_last_incident"] == 3

    def test_summary_empty(self, client):
        s = client.get("/api/v1/incidents/summary").json()
        assert s["total"] == 0
        assert s["days_since_last_incident"] is None


class TestOrgIsolation:
    def test_incidents_not_visible_across_orgs(self, db, org_id, user_id):
        def use_db():
            yield db

        app.dependency_overrides[get_db] = use_db
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(
            id=str(user_id), org_id=str(org_id), permissions=ALL_PERMISSIONS
        )
        a = TestClient(app)
        iid = make_incident(a).json()["id"]

        other = uuid.uuid4()
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(
            id=str(uuid.uuid4()), org_id=str(other), permissions=ALL_PERMISSIONS
        )
        b = TestClient(app)
        assert b.get(f"/api/v1/incidents/{iid}").status_code == 404
        assert b.get("/api/v1/incidents").json()["total"] == 0
        app.dependency_overrides.clear()
