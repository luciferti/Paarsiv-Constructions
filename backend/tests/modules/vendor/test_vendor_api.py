import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.database import get_db
from app.core.deps import CurrentUser, get_current_user
from app.main import app

ALL_PERMISSIONS = frozenset(
    {"vendor:view", "vendor:create", "vendor:edit", "vendor:archive"}
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


def create_vendor(client, code="VND-1", **overrides):
    payload = {"name": "Ace Steel Supply", "code": code, **overrides}
    return client.post("/api/v1/vendors", json=payload)


class TestCreateVendorEndpoint:
    def test_creates_vendor(self, client):
        response = create_vendor(client)

        assert response.status_code == 201
        body = response.json()
        assert body["code"] == "VND-1"
        assert body["status"] == "active"

    def test_rejects_duplicate_code(self, client):
        create_vendor(client)
        response = create_vendor(client)

        assert response.status_code == 409

    def test_forbidden_without_permission(self, client):
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(
            id=str(uuid.uuid4()), org_id=str(uuid.uuid4()), permissions=frozenset()
        )

        response = create_vendor(client)

        assert response.status_code == 403


class TestGetVendorEndpoint:
    def test_returns_404_for_missing_vendor(self, client):
        response = client.get(f"/api/v1/vendors/{uuid.uuid4()}")
        assert response.status_code == 404

    def test_returns_vendor(self, client):
        created = create_vendor(client).json()

        response = client.get(f"/api/v1/vendors/{created['id']}")

        assert response.status_code == 200
        assert response.json()["id"] == created["id"]


class TestListVendorsEndpoint:
    def test_lists_paginated_vendors(self, client):
        create_vendor(client, code="V1")
        create_vendor(client, code="V2")

        response = client.get("/api/v1/vendors", params={"page": 1, "page_size": 10})

        assert response.status_code == 200
        body = response.json()
        assert body["total"] == 2


class TestUpdateAndArchiveEndpoint:
    def test_updates_vendor(self, client):
        created = create_vendor(client).json()

        response = client.patch(f"/api/v1/vendors/{created['id']}", json={"category": "steel"})

        assert response.status_code == 200
        assert response.json()["category"] == "steel"

    def test_archives_vendor(self, client):
        created = create_vendor(client).json()

        response = client.delete(f"/api/v1/vendors/{created['id']}")
        assert response.status_code == 204

        follow_up = client.get(f"/api/v1/vendors/{created['id']}")
        assert follow_up.status_code == 404
