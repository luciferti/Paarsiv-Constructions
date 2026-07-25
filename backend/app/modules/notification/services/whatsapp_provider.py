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
from app.core.sfmc import SFMCError, get_sfmc_client

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


class SFMCWhatsAppProvider(WhatsAppProvider):
    """Sends WhatsApp via SFMC's messaging API using a message definition.

    Uses the MobileConnect/GroupConnect message-send endpoint keyed by
    `sfmc_whatsapp_definition_key`. If your SFMC WhatsApp channel uses a
    different path, only this method needs to change.
    """

    def send(self, to_phone: str, message: str) -> SendResult:
        definition_key = settings.sfmc_whatsapp_definition_key
        if not definition_key:
            return SendResult(status="failed", provider_used="sfmc")
        payload = {
            "definitionKey": definition_key,
            "recipients": [
                {
                    "contactKey": to_phone,
                    "to": to_phone,
                    "attributes": {"body": message},
                }
            ],
        }
        try:
            get_sfmc_client().post_json(
                f"messaging/v1/messageDefinitionSends/key:{definition_key}/send", payload
            )
            return SendResult(status="sent", provider_used="sfmc")
        except (SFMCError, Exception):
            return SendResult(status="failed", provider_used="sfmc")


def get_whatsapp_provider() -> WhatsAppProvider:
    provider = settings.messaging_provider.lower()
    if provider == "logging":
        return LoggingWhatsAppProvider()
    # SFMC wins when explicitly selected, or in auto mode when its WhatsApp
    # send definition is configured.
    if provider == "sfmc" or (
        provider == "auto" and settings.sfmc_configured and settings.sfmc_whatsapp_definition_key
    ):
        return SFMCWhatsAppProvider()
    if provider in ("twilio", "auto") and (
        settings.twilio_account_sid and settings.twilio_auth_token and settings.twilio_whatsapp_from
    ):
        return TwilioWhatsAppProvider()
    return LoggingWhatsAppProvider()
