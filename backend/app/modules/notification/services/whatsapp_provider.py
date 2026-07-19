"""
WhatsApp integration point.

Real delivery is meant to go through the WhatsApp Business API (per
the architecture, via Twilio). No Twilio credentials are configured
in this environment, so `LoggingWhatsAppProvider` records the message
as "logged" instead of sending it — the notification still shows up
in the in-app inbox, so the feature is real and demoable, it just
doesn't leave this server.

TODO(integration): set TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN /
TWILIO_WHATSAPP_FROM and `TwilioWhatsAppProvider` takes over
automatically via `get_whatsapp_provider()`.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass

from app.core.config import get_settings

settings = get_settings()


@dataclass(frozen=True)
class SendResult:
    status: str  # "sent" | "logged" | "failed"
    provider_used: str


class WhatsAppProvider(ABC):
    @abstractmethod
    def send(self, to_phone: str, message: str) -> SendResult: ...


class LoggingWhatsAppProvider(WhatsAppProvider):
    def send(self, to_phone: str, message: str) -> SendResult:
        return SendResult(status="logged", provider_used="logging-only")


class TwilioWhatsAppProvider(WhatsAppProvider):
    def send(self, to_phone: str, message: str) -> SendResult:
        from twilio.rest import Client

        client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
        try:
            client.messages.create(
                from_=f"whatsapp:{settings.twilio_whatsapp_from}",
                to=f"whatsapp:{to_phone}",
                body=message,
            )
            return SendResult(status="sent", provider_used="twilio")
        except Exception:
            return SendResult(status="failed", provider_used="twilio")


def get_whatsapp_provider() -> WhatsAppProvider:
    if settings.twilio_account_sid and settings.twilio_auth_token and settings.twilio_whatsapp_from:
        return TwilioWhatsAppProvider()
    return LoggingWhatsAppProvider()
