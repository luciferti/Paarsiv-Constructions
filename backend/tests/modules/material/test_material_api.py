import uuid
from datetime import date

import pytest
from fastapi.testclient import TestClient

from app.core.database import get_db
from app.core.deps import CurrentUser, get_current_user
from app.main import app

ALL_PERMISSIONS = frozenset(
    {
        "material:view",
        "material:create",
        "material:edit",
        "material:archive",
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


def create_material(client, code="CEM-01", **overrides):
    payload = {"name": "Cement", "code": code, "unit": "bag", **overrides}
    return client.post("/api/v1/materials", json=payload)


class TestMaterialCatalogEndpoints:
    def test_creates_and_fetches_material(self, client):
        created = create_material(client)
        assert created.status_code == 201

        response = client.get(f"/api/v1/materials/{created.json()['id']}")
        assert response.status_code == 200
        assert response.json()["unit"] == "bag"

    def test_rejects_duplicate_code(self, client):
        create_material(client)
        response = create_material(client)
        assert response.status_code == 409

    def test_archives_material(self, client):
        created = create_material(client).json()

        response = client.delete(f"/api/v1/materials/{created['id']}")
        assert response.status_code == 204
        assert client.get(f"/api/v1/materials/{created['id']}").status_code == 404


class TestSiteMaterialEntryEndpoints:
    def test_add_entry_and_read_stock(self, client):
        material = create_material(client).json()
        site_id = str(uuid.uuid4())

        add_response = client.post(
            f"/api/v1/sites/{site_id}/materials/entries",
            json={
                "material_id": material["id"],
                "entry_type": "received",
                "quantity": 100,
                "entry_date": str(date.today()),
            },
        )
        assert add_response.status_code == 201

        stock_response = client.get(f"/api/v1/sites/{site_id}/materials/stock")
        assert stock_response.status_code == 200
        body = stock_response.json()
        assert len(body) == 1
        assert body[0]["quantity_on_hand"] == 100

    def test_rejects_entry_for_unknown_material(self, client):
        site_id = str(uuid.uuid4())

        response = client.post(
            f"/api/v1/sites/{site_id}/materials/entries",
            json={
                "material_id": str(uuid.uuid4()),
                "entry_type": "received",
                "quantity": 10,
                "entry_date": str(date.today()),
            },
        )

        assert response.status_code == 404
