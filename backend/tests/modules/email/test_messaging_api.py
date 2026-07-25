import json
import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.database import get_db
from app.core.deps import CurrentUser, get_current_user
from app.main import app

_SAMPLES = json.loads(
    (Path(__file__).resolve().parents[2] / "fixtures" / "sfmc_inbound_samples.json").read_text()
)["samples"]

ALL_PERMISSIONS = frozenset({"messaging:admin"})


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


# ---- provider selection ----

class TestProviderSelection:
    def test_email_defaults_to_logging(self):
        from app.modules.email.services.email_provider import (
            LoggingEmailProvider,
            get_email_provider,
        )

        assert isinstance(get_email_provider(), LoggingEmailProvider)

    def test_logging_email_send_returns_logged(self):
        from app.modules.email.services.email_service import EmailService

        result = EmailService().send("a@b.com", "Hi", "Body")
        assert result.status == "logged"

    def test_sfmc_email_provider_when_configured(self, monkeypatch):
        import app.modules.email.services.email_provider as ep

        monkeypatch.setattr(ep.settings, "sfmc_subdomain", "mc123")
        monkeypatch.setattr(ep.settings, "sfmc_client_id", "cid")
        monkeypatch.setattr(ep.settings, "sfmc_client_secret", "secret")
        monkeypatch.setattr(ep.settings, "sfmc_email_definition_key", "welcome_email")
        monkeypatch.setattr(ep.settings, "messaging_provider", "auto")

        sent = {}

        class FakeClient:
            def post_json(self, path, body):
                sent["path"] = path
                sent["body"] = body
                return {"requestId": "abc"}

        monkeypatch.setattr(ep, "get_sfmc_client", lambda: FakeClient())

        provider = ep.get_email_provider()
        assert isinstance(provider, ep.SFMCEmailProvider)
        result = provider.send("client@x.com", "Invoice approved", "Your invoice is approved.")
        assert result.status == "sent"
        assert result.provider_used == "sfmc"
        assert sent["path"].startswith("messaging/v1/email/messages/")
        assert sent["body"]["definitionKey"] == "welcome_email"
        assert sent["body"]["recipient"]["to"] == "client@x.com"

    def test_sfmc_email_failure_degrades(self, monkeypatch):
        import app.modules.email.services.email_provider as ep
        from app.core.sfmc import SFMCError

        monkeypatch.setattr(ep.settings, "sfmc_subdomain", "mc123")
        monkeypatch.setattr(ep.settings, "sfmc_client_id", "cid")
        monkeypatch.setattr(ep.settings, "sfmc_client_secret", "secret")
        monkeypatch.setattr(ep.settings, "sfmc_email_definition_key", "k")
        monkeypatch.setattr(ep.settings, "messaging_provider", "sfmc")

        class BoomClient:
            def post_json(self, path, body):
                raise SFMCError("SFMC POST failed [400]: bad")

        monkeypatch.setattr(ep, "get_sfmc_client", lambda: BoomClient())
        result = ep.get_email_provider().send("a@b.com", "s", "b")
        assert result.status == "failed"
        assert "400" in result.detail

    def test_whatsapp_selects_sfmc_when_configured(self, monkeypatch):
        import app.modules.notification.services.whatsapp_provider as wp

        monkeypatch.setattr(wp.settings, "sfmc_subdomain", "mc123")
        monkeypatch.setattr(wp.settings, "sfmc_client_id", "cid")
        monkeypatch.setattr(wp.settings, "sfmc_client_secret", "secret")
        monkeypatch.setattr(wp.settings, "sfmc_whatsapp_definition_key", "wa_def")
        monkeypatch.setattr(wp.settings, "messaging_provider", "auto")

        assert isinstance(wp.get_whatsapp_provider(), wp.SFMCWhatsAppProvider)

    def test_whatsapp_defaults_to_logging(self, monkeypatch):
        import app.modules.notification.services.whatsapp_provider as wp

        monkeypatch.setattr(wp.settings, "sfmc_subdomain", None)
        monkeypatch.setattr(wp.settings, "twilio_account_sid", None)
        monkeypatch.setattr(wp.settings, "messaging_provider", "auto")
        assert isinstance(wp.get_whatsapp_provider(), wp.LoggingWhatsAppProvider)


# ---- endpoints ----

class TestMessagingEndpoints:
    def test_status_reports_providers(self, client):
        r = client.get("/api/v1/messaging/status")
        assert r.status_code == 200
        body = r.json()
        assert "email_provider" in body
        assert "whatsapp_provider" in body
        assert body["sfmc_configured"] in (True, False)

    def test_test_email_logged_by_default(self, client):
        r = client.post(
            "/api/v1/messaging/email/test",
            json={"to_email": "someone@example.com", "subject": "Hi", "body": "Test"},
        )
        assert r.status_code == 200
        assert r.json()["status"] in ("logged", "sent")

    def test_test_email_validates_address(self, client):
        r = client.post("/api/v1/messaging/email/test", json={"to_email": "not-an-email"})
        assert r.status_code == 422

    def test_status_requires_auth(self, monkeypatch):
        # Disable demo-mode auth bypass so real auth applies, then call anon.
        import app.core.deps as deps

        monkeypatch.setattr(deps.settings, "demo_mode", False)
        anon = TestClient(app)
        assert anon.get("/api/v1/messaging/status").status_code == 401


# ---- inbound webhook: SFMC JSON path ----

class TestInboundJson:
    def test_sfmc_json_inbound_returns_reply(self, db, org_id, monkeypatch):
        import app.modules.assistant.api.v1.whatsapp_webhook_routes as webhook_module

        monkeypatch.setattr(webhook_module.settings, "whatsapp_default_org_id", str(org_id))

        def override_get_db():
            yield db

        app.dependency_overrides[get_db] = override_get_db
        c = TestClient(app)
        r = c.post(
            "/api/v1/whatsapp/webhook",
            json={"mobileNumber": "+919999999999", "messageText": "how many sites"},
        )
        assert r.status_code == 200
        body = r.json()
        assert "reply" in body
        assert body["to"] == "+919999999999"
        app.dependency_overrides.clear()

    def test_sfmc_nested_messages_envelope(self, db, org_id, monkeypatch):
        import app.modules.assistant.api.v1.whatsapp_webhook_routes as webhook_module

        monkeypatch.setattr(webhook_module.settings, "whatsapp_default_org_id", str(org_id))

        def override_get_db():
            yield db

        app.dependency_overrides[get_db] = override_get_db
        c = TestClient(app)
        r = c.post(
            "/api/v1/whatsapp/webhook",
            json={"messages": [{"from": "+918888888888", "text": "list my sites"}]},
        )
        assert r.status_code == 200
        assert r.json()["to"] == "+918888888888"
        app.dependency_overrides.clear()


class TestSfmcSampleFixtures:
    """The canonical SFMC inbound samples parse and drive the webhook."""

    @pytest.mark.parametrize("sample", _SAMPLES, ids=[s["name"] for s in _SAMPLES])
    def test_parser_extracts_sender_and_text(self, sample):
        from app.modules.assistant.api.v1.whatsapp_webhook_routes import _parse_sfmc_payload

        sender, text = _parse_sfmc_payload(sample["payload"])
        assert sender == sample["expected_sender"]
        assert text == sample["expected_text"]

    @pytest.mark.parametrize("sample", _SAMPLES, ids=[s["name"] for s in _SAMPLES])
    def test_webhook_answers_each_sample(self, db, org_id, monkeypatch, sample):
        import app.modules.assistant.api.v1.whatsapp_webhook_routes as webhook_module

        monkeypatch.setattr(webhook_module.settings, "whatsapp_default_org_id", str(org_id))

        def override_get_db():
            yield db

        app.dependency_overrides[get_db] = override_get_db
        c = TestClient(app)
        r = c.post("/api/v1/whatsapp/webhook", json=sample["payload"])
        assert r.status_code == 200
        body = r.json()
        assert body["to"] == sample["expected_sender"]
        assert body["reply"]  # a real answer, not the empty-prompt path
        app.dependency_overrides.clear()
