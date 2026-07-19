import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.database import get_db
from app.core.deps import CurrentUser, get_current_user
from app.main import app
from app.modules.notification.dependencies import get_notification_service
from app.modules.notification.services.notification_service import NotificationService
from app.modules.notification.services.whatsapp_provider import SendResult, WhatsAppProvider

ALL_PERMISSIONS = frozenset({"notification:view", "notification:send"})


class FakeProvider(WhatsAppProvider):
    def send(self, to_phone: str, message: str) -> SendResult:
        return SendResult(status="logged", provider_used="logging-only")


@pytest.fixture()
def client(db, org_id, user_id):
    def override_get_db():
        yield db

    def override_get_current_user():
        return CurrentUser(id=str(user_id), org_id=str(org_id), permissions=ALL_PERMISSIONS)

    def override_get_notification_service():
        return NotificationService(db, provider=FakeProvider())

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[get_notification_service] = override_get_notification_service
    yield TestClient(app)
    app.dependency_overrides.clear()


class TestNotificationEndpoints:
    def test_sends_and_lists_notification(self, client):
        response = client.post(
            "/api/v1/notifications",
            json={"recipient_phone": "+15551234567", "message": "Daily update"},
        )
        assert response.status_code == 201
        assert response.json()["status"] == "logged"

        list_response = client.get("/api/v1/notifications")
        assert list_response.status_code == 200
        assert list_response.json()["total"] == 1

    def test_forbidden_without_permission(self, client):
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(
            id=str(uuid.uuid4()), org_id=str(uuid.uuid4()), permissions=frozenset()
        )

        response = client.post(
            "/api/v1/notifications",
            json={"recipient_phone": "+15551234567", "message": "Daily update"},
        )

        assert response.status_code == 403
