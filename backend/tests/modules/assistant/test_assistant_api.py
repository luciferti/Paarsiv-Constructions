import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.database import get_db
from app.core.deps import CurrentUser, get_current_user
from app.main import app

ALL_PERMISSIONS = frozenset({"assistant:use"})


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


class TestAssistantChat:
    def test_ask_and_history_roundtrip(self, client):
        response = client.post("/api/v1/assistant/messages", json={"message": "list my sites"})

        assert response.status_code == 200
        body = response.json()
        assert body["user_message"]["content"] == "list my sites"
        assert len(body["assistant_message"]["content"]) > 0

        history = client.get("/api/v1/assistant/messages")
        assert history.status_code == 200
        items = history.json()["items"]
        assert len(items) == 2
        assert items[0]["role"] == "user"
        assert items[1]["role"] == "assistant"

    def test_rejects_empty_message(self, client):
        response = client.post("/api/v1/assistant/messages", json={"message": ""})
        assert response.status_code == 422

    def test_forbidden_without_permission(self, client):
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(
            id=str(uuid.uuid4()), org_id=str(uuid.uuid4()), permissions=frozenset()
        )

        response = client.post("/api/v1/assistant/messages", json={"message": "hello"})

        assert response.status_code == 403


class TestWhatsAppWebhook:
    @pytest.fixture(autouse=True)
    def _link_org(self, org_id, monkeypatch):
        import app.modules.assistant.api.v1.whatsapp_webhook_routes as webhook_module

        monkeypatch.setattr(webhook_module.settings, "whatsapp_default_org_id", str(org_id))

    def test_replies_with_twiml(self, client):
        response = client.post(
            "/api/v1/whatsapp/webhook",
            data={"From": "whatsapp:+15551234567", "Body": "list my sites"},
        )

        assert response.status_code == 200
        assert "application/xml" in response.headers["content-type"]
        assert "<Message>" in response.text

    def test_empty_body_gets_usage_hint(self, client):
        response = client.post("/api/v1/whatsapp/webhook", data={"From": "whatsapp:+15551234567"})

        assert response.status_code == 200
        assert "Send a question" in response.text

    def test_unconfigured_org_gets_safe_reply(self, client, monkeypatch):
        import app.modules.assistant.api.v1.whatsapp_webhook_routes as webhook_module

        monkeypatch.setattr(webhook_module.settings, "whatsapp_default_org_id", None)
        monkeypatch.setattr(webhook_module.settings, "demo_mode", False)

        response = client.post(
            "/api/v1/whatsapp/webhook",
            data={"From": "whatsapp:+15551234567", "Body": "list my sites"},
        )

        assert response.status_code == 200
        assert "isn't linked to an organization" in response.text
