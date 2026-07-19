import uuid
from datetime import date

import pytest
from fastapi.testclient import TestClient

from app.core.database import get_db
from app.core.deps import CurrentUser, get_current_user
from app.main import app

ALL_PERMISSIONS = frozenset({"report:view", "report:create", "report:edit"})


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


def create_report(client, site_id, **overrides):
    payload = {"report_date": str(date.today()), "work_summary": "Poured slab", **overrides}
    return client.post(f"/api/v1/sites/{site_id}/reports", json=payload)


class TestReportEndpoints:
    def test_creates_and_lists_report(self, client):
        site_id = str(uuid.uuid4())
        created = create_report(client, site_id)
        assert created.status_code == 201

        response = client.get(f"/api/v1/sites/{site_id}/reports")
        assert response.status_code == 200
        assert len(response.json()) == 1

    def test_rejects_duplicate_report_same_day(self, client):
        site_id = str(uuid.uuid4())
        create_report(client, site_id)

        response = create_report(client, site_id)
        assert response.status_code == 409

    def test_updates_report(self, client):
        site_id = str(uuid.uuid4())
        created = create_report(client, site_id).json()

        response = client.patch(
            f"/api/v1/sites/{site_id}/reports/{created['id']}", json={"manpower_count": 20}
        )

        assert response.status_code == 200
        assert response.json()["manpower_count"] == 20

    def test_returns_404_for_missing_report(self, client):
        site_id = str(uuid.uuid4())
        response = client.get(f"/api/v1/sites/{site_id}/reports/{uuid.uuid4()}")
        assert response.status_code == 404
