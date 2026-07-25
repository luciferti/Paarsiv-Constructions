"""
Shared Salesforce Marketing Cloud (SFMC) REST client.

Handles the OAuth2 client-credentials handshake against the tenant auth
endpoint, caches the access token until shortly before it expires, and
exposes a small `post_json` helper for the REST instance. Both the email
provider and the WhatsApp provider use this so there is a single place that
knows how to talk to SFMC.

Nothing here calls SFMC unless `settings.sfmc_configured` is true — the
providers fall back to logging otherwise, so the app runs (and tests pass)
with no SFMC credentials present.
"""
from __future__ import annotations

import threading
import time
from typing import Any, Dict, Optional

import httpx

from app.core.config import get_settings


class SFMCConfigError(RuntimeError):
    """Raised when an SFMC call is attempted without full configuration."""


class SFMCError(RuntimeError):
    """Raised when SFMC returns a non-2xx response."""


class SFMCClient:
    """Thin, thread-safe SFMC REST client with a cached OAuth token."""

    def __init__(self, timeout: float = 15.0):
        self._settings = get_settings()
        self._timeout = timeout
        self._token: Optional[str] = None
        self._rest_base: Optional[str] = None
        self._expires_at: float = 0.0
        self._lock = threading.Lock()

    # -- auth ---------------------------------------------------------------

    def _auth_url(self) -> str:
        return f"https://{self._settings.sfmc_subdomain}.auth.marketingcloudapis.com/v2/token"

    def _fetch_token(self) -> None:
        if not self._settings.sfmc_configured:
            raise SFMCConfigError("SFMC is not configured (subdomain/client id/secret missing)")

        payload: Dict[str, Any] = {
            "grant_type": "client_credentials",
            "client_id": self._settings.sfmc_client_id,
            "client_secret": self._settings.sfmc_client_secret,
        }
        if self._settings.sfmc_account_id:
            payload["account_id"] = self._settings.sfmc_account_id

        resp = httpx.post(self._auth_url(), json=payload, timeout=self._timeout)
        if resp.status_code >= 400:
            raise SFMCError(f"SFMC auth failed [{resp.status_code}]: {resp.text[:300]}")
        data = resp.json()
        self._token = data["access_token"]
        # rest_instance_url is the authoritative base for REST calls.
        self._rest_base = data.get("rest_instance_url") or (
            f"https://{self._settings.sfmc_subdomain}.rest.marketingcloudapis.com/"
        )
        # Refresh a minute before the real expiry to avoid edge-of-expiry 401s.
        self._expires_at = time.time() + int(data.get("expires_in", 1080)) - 60

    def _ensure_token(self) -> None:
        with self._lock:
            if self._token is None or time.time() >= self._expires_at:
                self._fetch_token()

    # -- requests -----------------------------------------------------------

    def post_json(self, path: str, body: Dict[str, Any]) -> Dict[str, Any]:
        """POST to a REST path (relative to the rest instance url) and return JSON."""
        self._ensure_token()
        url = f"{self._rest_base}{path.lstrip('/')}"
        resp = httpx.post(
            url,
            json=body,
            headers={"Authorization": f"Bearer {self._token}"},
            timeout=self._timeout,
        )
        # One retry on 401 in case the token was revoked early.
        if resp.status_code == 401:
            with self._lock:
                self._fetch_token()
            resp = httpx.post(
                url,
                json=body,
                headers={"Authorization": f"Bearer {self._token}"},
                timeout=self._timeout,
            )
        if resp.status_code >= 400:
            raise SFMCError(f"SFMC POST {path} failed [{resp.status_code}]: {resp.text[:300]}")
        return resp.json() if resp.content else {}


_client: Optional[SFMCClient] = None
_client_lock = threading.Lock()


def get_sfmc_client() -> SFMCClient:
    """Process-wide singleton so the OAuth token cache is shared."""
    global _client
    if _client is None:
        with _client_lock:
            if _client is None:
                _client = SFMCClient()
    return _client
