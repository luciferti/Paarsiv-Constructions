import uuid
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from app.core.database import get_db
from app.core.deps import CurrentUser, get_current_user
from app.main import app

ALL_PERMISSIONS = frozenset(
    {"document:view", "document:create", "document:edit", "document:delete"}
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


def make_doc(client, category="permit", title="Building permit", url="https://drive.example/permit.pdf", **ov):
    payload = {"title": title, "category": category, "url": url, **ov}
    return client.post("/api/v1/documents", json=payload)


class TestDocuments:
    def test_create_and_get(self, client):
        r = make_doc(client, reference_no="BP-2026-14")
        assert r.status_code == 201, r.text
        did = r.json()["id"]
        got = client.get(f"/api/v1/documents/{did}")
        assert got.status_code == 200
        assert got.json()["reference_no"] == "BP-2026-14"
        assert got.json()["url"] == "https://drive.example/permit.pdf"

    def test_requires_valid_category(self, client):
        assert make_doc(client, category="invoice_xyz").status_code == 422

    def test_url_required(self, client):
        r = client.post("/api/v1/documents", json={"title": "X", "category": "drawing"})
        assert r.status_code == 422

    def test_filter_by_category(self, client):
        make_doc(client, category="permit")
        make_doc(client, category="drawing", title="Floor plan")
        r = client.get("/api/v1/documents", params={"category": "drawing"})
        assert r.json()["total"] == 1

    def test_update_and_delete(self, client):
        did = make_doc(client).json()["id"]
        upd = client.patch(f"/api/v1/documents/{did}", json={"title": "Renewed permit"})
        assert upd.json()["title"] == "Renewed permit"
        assert client.delete(f"/api/v1/documents/{did}").status_code == 204
        assert client.get(f"/api/v1/documents/{did}").status_code == 404


class TestSummary:
    def test_expiry_buckets(self, client):
        today = date.today()
        make_doc(client, category="license", title="Valid", expiry_date=str(today + timedelta(days=200)))
        make_doc(client, category="license", title="Expiring", expiry_date=str(today + timedelta(days=10)))
        make_doc(client, category="permit", title="Expired", expiry_date=str(today - timedelta(days=5)))
        make_doc(client, category="drawing", title="No expiry")

        s = client.get("/api/v1/documents/summary").json()
        assert s["total"] == 4
        assert s["by_category"] == {"license": 2, "permit": 1, "drawing": 1}
        assert s["expiring_soon"] == 1
        assert s["expired"] == 1


class TestOrgIsolation:
    def test_documents_not_visible_across_orgs(self, db, org_id, user_id):
        def use_db():
            yield db

        app.dependency_overrides[get_db] = use_db
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(
            id=str(user_id), org_id=str(org_id), permissions=ALL_PERMISSIONS
        )
        a = TestClient(app)
        did = make_doc(a).json()["id"]

        other = uuid.uuid4()
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(
            id=str(uuid.uuid4()), org_id=str(other), permissions=ALL_PERMISSIONS
        )
        b = TestClient(app)
        assert b.get(f"/api/v1/documents/{did}").status_code == 404
        assert b.get("/api/v1/documents").json()["total"] == 0
        app.dependency_overrides.clear()
