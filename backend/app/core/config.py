from functools import lru_cache
from typing import Optional

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    database_url: str = "postgresql+psycopg://user:password@localhost:5432/hrms"
    jwt_secret_key: str = "changeme"
    jwt_algorithm: str = "HS256"
    jwt_expiry_minutes: int = 60 * 24 * 7  # 7 days
    environment: str = "development"

    # Comma-separated list of allowed browser origins in production,
    # e.g. "https://your-app.vercel.app". localhost:3000 is always
    # allowed in demo mode for local development.
    frontend_origin: Optional[str] = None

    # Bypasses real auth with a fixed full-permission user. Must never be
    # true outside of local preview — never set this in a deployed .env.
    demo_mode: bool = False

    # When unset, AI features (daily summaries, assistant) fall back to
    # deterministic rule-based generators instead of calling OpenAI.
    openai_api_key: Optional[str] = None

    # When any of these are unset, WhatsApp notifications fall back to
    # an in-app log instead of actually sending via Twilio.
    twilio_account_sid: Optional[str] = None
    twilio_auth_token: Optional[str] = None
    twilio_whatsapp_from: Optional[str] = None

    # Org that inbound WhatsApp messages belong to, until per-phone
    # employee lookup is wired to the HRMS. Find your org id in the
    # organizations table after signup.
    whatsapp_default_org_id: Optional[str] = None

    # ---- Salesforce Marketing Cloud (SFMC) ----
    # Shared OAuth2 (client-credentials) app. When set, SFMC becomes the
    # preferred provider for email and (if the WhatsApp bits are set too)
    # WhatsApp. Leave unset to fall back to logging / Twilio.
    sfmc_subdomain: Optional[str] = None          # tenant subdomain, e.g. "mcxxxxxxxxxxxxx"
    sfmc_client_id: Optional[str] = None
    sfmc_client_secret: Optional[str] = None
    sfmc_account_id: Optional[str] = None         # MID (optional; for a specific business unit)

    # Transactional email send definition (created in SFMC) + sender identity.
    sfmc_email_definition_key: Optional[str] = None
    sfmc_from_email: Optional[str] = None
    sfmc_from_name: Optional[str] = None

    # WhatsApp send: MobileConnect/GroupConnect message definition + channel.
    # sfmc_whatsapp_definition_key drives the outbound send; keeping it separate
    # from email lets one SFMC app power both.
    sfmc_whatsapp_definition_key: Optional[str] = None

    # Explicit provider override: "auto" (default), "sfmc", "twilio", "logging".
    messaging_provider: str = "auto"

    @property
    def sfmc_configured(self) -> bool:
        return bool(self.sfmc_subdomain and self.sfmc_client_id and self.sfmc_client_secret)

    @field_validator("database_url")
    @classmethod
    def _normalize_database_url(cls, value: str) -> str:
        # Managed Postgres providers (Render, Heroku) hand out
        # postgres:// URLs; SQLAlchemy 2 + psycopg3 needs the explicit
        # driver scheme.
        if value.startswith("postgres://"):
            return value.replace("postgres://", "postgresql+psycopg://", 1)
        if value.startswith("postgresql://"):
            return value.replace("postgresql://", "postgresql+psycopg://", 1)
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
