import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.database import get_db
from app.core.deps import CurrentUser, get_current_user
from app.main import app

ALL_SITE_PERMISSIONS = frozenset(
    {"site:view", "site:create", "site:edit", "site:archive", "site:team:manage"}
)


@pytest.fixture()
def client(db, org_id, user_id):
    def override_get_db():
        yield db

    def override_get_current_user():
        return CurrentUser(id=str(user_id), org_id=str(org_id), permissions=ALL_SITE_PERMISSIONS)

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    yield TestClient(app)
    app.dependency_overrides.clear()


def create_site(client, code="SITE-1", **overrides):
    payload = {"name": "Riverside Complex", "code": code, **overrides}
    return client.post("/api/v1/sites", json=payload)


class TestCreateSiteEndpoint:
    def test_creates_site(self, client):
        response = create_site(client)

        assert response.status_code == 201
        body = response.json()
        assert body["code"] == "SITE-1"
        assert body["status"] == "planning"

    def test_rejects_duplicate_code(self, client):
        create_site(client)
        response = create_site(client)

        assert response.status_code == 409

    def test_forbidden_without_permission(self, client):
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(
            id=str(uuid.uuid4()), org_id=str(uuid.uuid4()), permissions=frozenset()
        )

        response = create_site(client)

        assert response.status_code == 403


class TestGetSiteEndpoint:
    def test_returns_404_for_missing_site(self, client):
        response = client.get(f"/api/v1/sites/{uuid.uuid4()}")
        assert response.status_code == 404

    def test_returns_site(self, client):
        created = create_site(client).json()

        response = client.get(f"/api/v1/sites/{created['id']}")

        assert response.status_code == 200
        assert response.json()["id"] == created["id"]


class TestListSitesEndpoint:
    def test_lists_paginated_sites(self, client):
        create_site(client, code="A1")
        create_site(client, code="A2")

        response = client.get("/api/v1/sites", params={"page": 1, "page_size": 10})

        assert response.status_code == 200
        body = response.json()
        assert body["total"] == 2
        assert len(body["items"]) == 2


class TestUpdateAndArchiveEndpoint:
    def test_updates_site_status(self, client):
        created = create_site(client).json()

        response = client.patch(f"/api/v1/sites/{created['id']}", json={"status": "active"})

        assert response.status_code == 200
        assert response.json()["status"] == "active"

    def test_archives_site(self, client):
        created = create_site(client).json()

        response = client.delete(f"/api/v1/sites/{created['id']}")
        assert response.status_code == 204

        follow_up = client.get(f"/api/v1/sites/{created['id']}")
        assert follow_up.status_code == 404


class TestTeamEndpoints:
    def test_add_list_and_remove_team_member(self, client):
        site = create_site(client).json()
        employee_id = str(uuid.uuid4())

        add_response = client.post(
            f"/api/v1/sites/{site['id']}/team",
            json={"employee_id": employee_id, "role_on_site": "Foreman"},
        )
        assert add_response.status_code == 201

        list_response = client.get(f"/api/v1/sites/{site['id']}/team")
        assert list_response.status_code == 200
        assert len(list_response.json()) == 1

        remove_response = client.delete(f"/api/v1/sites/{site['id']}/team/{employee_id}")
        assert remove_response.status_code == 204

        assert client.get(f"/api/v1/sites/{site['id']}/team").json() == []

    def test_removing_unassigned_member_returns_404(self, client):
        site = create_site(client).json()

        response = client.delete(f"/api/v1/sites/{site['id']}/team/{uuid.uuid4()}")

        assert response.status_code == 404
