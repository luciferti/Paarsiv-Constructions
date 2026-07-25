"""
Email delivery, pluggable like the WhatsApp provider.

`LoggingEmailProvider` is the default — it records the send without leaving
the server, so email-triggered features work and are testable with no
credentials. When SFMC is configured, `SFMCEmailProvider` sends via the SFMC
Transactional Messaging API (a transactional send definition + email asset,
created once in SFMC, keyed by `sfmc_email_definition_key`).

The email asset in SFMC should reference the substitution attributes
`subject` and `body` (e.g. %%subject%% / %%body%%) so arbitrary app messages
render; adjust the attribute names in `_send_via_sfmc` if your asset differs.
"""
from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass

from app.core.config import get_settings
from app.core.sfmc import SFMCError, get_sfmc_client

settings = get_settings()


@dataclass(frozen=True)
class EmailResult:
    status: str          # "sent" | "logged" | "failed"
    provider_used: str
    detail: str = ""


class EmailProvider(ABC):
    @abstractmethod
    def send(self, to_email: str, subject: str, body: str) -> EmailResult: ...


class LoggingEmailProvider(EmailProvider):
    def send(self, to_email: str, subject: str, body: str) -> EmailResult:
        return EmailResult(status="logged", provider_used="logging-only")


class SFMCEmailProvider(EmailProvider):
    def send(self, to_email: str, subject: str, body: str) -> EmailResult:
        definition_key = settings.sfmc_email_definition_key
        if not definition_key:
            return EmailResult(
                status="failed",
                provider_used="sfmc",
                detail="sfmc_email_definition_key is not set",
            )
        # Transactional send: POST /messaging/v1/email/messages/{messageKey}
        message_key = str(uuid.uuid4())  # per-send idempotency key
        payload = {
            "definitionKey": definition_key,
            "recipient": {
                "contactKey": to_email,
                "to": to_email,
                "attributes": {"subject": subject, "body": body},
            },
        }
        try:
            get_sfmc_client().post_json(
                f"messaging/v1/email/messages/{message_key}", payload
            )
            return EmailResult(status="sent", provider_used="sfmc")
        except SFMCError as exc:
            return EmailResult(status="failed", provider_used="sfmc", detail=str(exc))
        except Exception as exc:  # network/parse — degrade gracefully
            return EmailResult(status="failed", provider_used="sfmc", detail=str(exc))


def get_email_provider() -> EmailProvider:
    provider = settings.messaging_provider.lower()
    if provider == "logging":
        return LoggingEmailProvider()
    if provider in ("sfmc", "auto") and settings.sfmc_configured:
        return SFMCEmailProvider()
    return LoggingEmailProvider()
