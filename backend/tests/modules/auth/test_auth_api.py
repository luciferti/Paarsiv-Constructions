import pytest
from fastapi.testclient import TestClient

import app.core.deps as deps_module
from app.core.database import get_db
from app.main import app

SIGNUP = {
    "company_name": "Rajputana Builders",
    "name": "Ramesh Sharma",
    "email": "ramesh@example.com",
    "password": "supersecret1",
}


@pytest.fixture()
def client(db, monkeypatch):
    """Real-auth client: no get_current_user override — requests go
    through actual JWT verification against the test database."""
    monkeypatch.setattr(deps_module.settings, "demo_mode", False)

    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


class TestSignup:
    def test_creates_org_and_admin_and_returns_token(self, client):
        response = client.post("/api/v1/auth/signup", json=SIGNUP)

        assert response.status_code == 201
        body = response.json()
        assert body["access_token"]
        assert body["org_name"] == "Rajputana Builders"
        assert body["user"]["email"] == "ramesh@example.com"
        assert body["user"]["role"] == "admin"

    def test_rejects_duplicate_email(self, client):
        client.post("/api/v1/auth/signup", json=SIGNUP)

        response = client.post("/api/v1/auth/signup", json=SIGNUP)

        assert response.status_code == 409

    def test_rejects_short_password(self, client):
        response = client.post("/api/v1/auth/signup", json={**SIGNUP, "password": "short"})
        assert response.status_code == 422


class TestLogin:
    def test_valid_credentials_return_token(self, client):
        client.post("/api/v1/auth/signup", json=SIGNUP)

        response = client.post(
            "/api/v1/auth/login",
            json={"email": "Ramesh@Example.com", "password": "supersecret1"},
        )

        assert response.status_code == 200
        assert response.json()["access_token"]

    def test_wrong_password_returns_401(self, client):
        client.post("/api/v1/auth/signup", json=SIGNUP)

        response = client.post(
            "/api/v1/auth/login", json={"email": SIGNUP["email"], "password": "wrong-password"}
        )

        assert response.status_code == 401

    def test_unknown_email_returns_401(self, client):
        response = client.post(
            "/api/v1/auth/login", json={"email": "nobody@example.com", "password": "whatever"}
        )
        assert response.status_code == 401


class TestProtectedRoutes:
    def test_request_without_token_is_401(self, client):
        response = client.get("/api/v1/sites")
        assert response.status_code == 401

    def test_request_with_garbage_token_is_401(self, client):
        response = client.get(
            "/api/v1/sites", headers={"Authorization": "Bearer not-a-real-token"}
        )
        assert response.status_code == 401

    def test_token_grants_access_scoped_to_own_org(self, client):
        token_a = client.post("/api/v1/auth/signup", json=SIGNUP).json()["access_token"]
        token_b = client.post(
            "/api/v1/auth/signup",
            json={**SIGNUP, "email": "other@example.com", "company_name": "Other Co"},
        ).json()["access_token"]

        created = client.post(
            "/api/v1/sites",
            json={"name": "Riverside Tower", "code": "SITE-001"},
            headers={"Authorization": f"Bearer {token_a}"},
        )
        assert created.status_code == 201

        own = client.get("/api/v1/sites", headers={"Authorization": f"Bearer {token_a}"})
        other = client.get("/api/v1/sites", headers={"Authorization": f"Bearer {token_b}"})

        assert own.json()["total"] == 1
        assert other.json()["total"] == 0

    def test_me_returns_current_user(self, client):
        token = client.post("/api/v1/auth/signup", json=SIGNUP).json()["access_token"]

        response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})

        assert response.status_code == 200
        assert response.json()["email"] == "ramesh@example.com"
