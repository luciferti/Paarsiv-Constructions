import uuid
from datetime import date

import pytest
from fastapi.testclient import TestClient

from app.core.database import get_db
from app.core.deps import CurrentUser, get_current_user
from app.main import app

ALL_PERMISSIONS = frozenset(
    {"material:view", "material:create", "material:entry:create", "material:transfer"}
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


def make_material(client, code="CEM-01"):
    return client.post(
        "/api/v1/materials", json={"name": "Cement", "code": code, "unit": "bag"}
    ).json()["id"]


def receive(client, site, material_id, qty):
    return client.post(
        f"/api/v1/sites/{site}/materials/entries",
        json={"material_id": material_id, "entry_type": "received", "quantity": qty, "entry_date": str(date.today())},
    )


def transfer(client, material_id, src, dst, qty=30):
    return client.post(
        "/api/v1/material-transfers",
        json={
            "material_id": material_id,
            "from_site_id": src,
            "to_site_id": dst,
            "quantity": qty,
            "transfer_date": str(date.today()),
        },
    )


def on_hand(client, site, material_id):
    rows = client.get(f"/api/v1/sites/{site}/materials/stock").json()
    return next((r for r in rows if r["material_id"] == material_id), None)


class TestTransfers:
    def test_transfer_moves_stock_between_sites(self, client):
        site_a, site_b = str(uuid.uuid4()), str(uuid.uuid4())
        mat = make_material(client)
        receive(client, site_a, mat, 100)

        r = transfer(client, mat, site_a, site_b, qty=30)
        assert r.status_code == 201, r.text

        a = on_hand(client, site_a, mat)
        assert a["quantity_received"] == 100
        assert a["quantity_transferred_out"] == 30
        assert a["quantity_on_hand"] == 70  # 100 - 30 out

        # Destination had NO prior entries — still shows via transfer-in.
        b = on_hand(client, site_b, mat)
        assert b is not None
        assert b["quantity_transferred_in"] == 30
        assert b["quantity_on_hand"] == 30

    def test_rejects_same_site(self, client):
        site = str(uuid.uuid4())
        mat = make_material(client)
        r = transfer(client, mat, site, site)
        assert r.status_code == 400

    def test_rejects_unknown_material(self, client):
        r = transfer(client, str(uuid.uuid4()), str(uuid.uuid4()), str(uuid.uuid4()))
        assert r.status_code == 404

    def test_rejects_zero_quantity(self, client):
        mat = make_material(client)
        r = transfer(client, mat, str(uuid.uuid4()), str(uuid.uuid4()), qty=0)
        assert r.status_code == 422

    def test_list_site_transfers(self, client):
        site_a, site_b = str(uuid.uuid4()), str(uuid.uuid4())
        mat = make_material(client)
        receive(client, site_a, mat, 100)
        transfer(client, mat, site_a, site_b, qty=20)
        # Appears for both source and destination.
        assert len(client.get(f"/api/v1/material-transfers/site/{site_a}").json()) == 1
        assert len(client.get(f"/api/v1/material-transfers/site/{site_b}").json()) == 1


class TestOrgIsolation:
    def test_transfers_not_visible_across_orgs(self, db, org_id, user_id):
        site_a, site_b = str(uuid.uuid4()), str(uuid.uuid4())

        def use_db():
            yield db

        app.dependency_overrides[get_db] = use_db
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(
            id=str(user_id), org_id=str(org_id), permissions=ALL_PERMISSIONS
        )
        a = TestClient(app)
        mat = make_material(a)
        receive(a, site_a, mat, 50)
        transfer(a, mat, site_a, site_b, qty=10)

        other = uuid.uuid4()
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(
            id=str(uuid.uuid4()), org_id=str(other), permissions=ALL_PERMISSIONS
        )
        b = TestClient(app)
        assert b.get(f"/api/v1/material-transfers/site/{site_a}").json() == []
        app.dependency_overrides.clear()
