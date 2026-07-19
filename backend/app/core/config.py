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
