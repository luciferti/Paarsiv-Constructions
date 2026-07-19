import uuid

from app.modules.notification.models.notification_model import NotificationStatus
from app.modules.notification.schemas.notification_schema import NotificationCreate
from app.modules.notification.services.notification_service import NotificationService
from app.modules.notification.services.whatsapp_provider import SendResult, WhatsAppProvider


class FakeProvider(WhatsAppProvider):
    def __init__(self, result: SendResult):
        self.result = result

    def send(self, to_phone: str, message: str) -> SendResult:
        return self.result


def make_payload(**overrides) -> NotificationCreate:
    data = {"recipient_phone": "+15551234567", "message": "Daily update"}
    data.update(overrides)
    return NotificationCreate(**data)


class TestSendNotification:
    def test_records_logged_status_from_fallback_provider(self, db, org_id, user_id):
        service = NotificationService(
            db, provider=FakeProvider(SendResult(status="logged", provider_used="logging-only"))
        )

        notification = service.send_notification(org_id, user_id, make_payload())

        assert notification.status == NotificationStatus.LOGGED
        assert notification.provider_used == "logging-only"

    def test_records_sent_status_from_real_provider(self, db, org_id, user_id):
        service = NotificationService(
            db, provider=FakeProvider(SendResult(status="sent", provider_used="twilio"))
        )

        notification = service.send_notification(org_id, user_id, make_payload())

        assert notification.status == NotificationStatus.SENT

    def test_scopes_list_to_org(self, db, org_id, user_id):
        service = NotificationService(
            db, provider=FakeProvider(SendResult(status="logged", provider_used="logging-only"))
        )
        service.send_notification(org_id, user_id, make_payload())
        service.send_notification(uuid.uuid4(), user_id, make_payload())

        result = service.list_notifications(org_id)

        assert result.total == 1
