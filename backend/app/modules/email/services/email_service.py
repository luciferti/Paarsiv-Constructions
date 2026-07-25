"""Thin service other modules call to send email, provider-agnostic."""
from __future__ import annotations

from app.modules.email.services.email_provider import EmailResult, get_email_provider


class EmailService:
    def __init__(self, provider=None):
        self.provider = provider or get_email_provider()

    def send(self, to_email: str, subject: str, body: str) -> EmailResult:
        return self.provider.send(to_email=to_email, subject=subject, body=body)

    def provider_name(self) -> str:
        return type(self.provider).__name__
