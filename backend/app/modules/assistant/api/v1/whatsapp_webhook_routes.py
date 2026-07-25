"""
Inbound WhatsApp webhook — accepts both Twilio (form) and SFMC (JSON).

Point your provider's "when a message comes in" webhook at
POST /api/v1/whatsapp/webhook.

- Twilio sends form fields (`From`, `Body`) and consumes a TwiML XML reply,
  so the reply rides back on the webhook response.
- SFMC (GroupConnect/MessageContact inbound) POSTs JSON. We parse the sender
  and message text from common field shapes and return JSON with the reply.
  Adjust `_parse_sfmc_payload` field names if your SFMC inbound event differs.

In production, set WHATSAPP_DEFAULT_ORG_ID to the organization the bot should
answer for. Without it, inbound messages get a polite "not configured" reply
instead of leaking anything.

TODO(integration): validate the provider signature (X-Twilio-Signature /
SFMC verification) so only the provider can call this endpoint, and resolve
the org per-sender via employee phone lookup instead of one default org.
"""

import uuid
from typing import Optional, Tuple
from xml.sax.saxutils import escape

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.deps import _DEMO_ORG_ID
from app.modules.assistant.models.assistant_model import MessageChannel
from app.modules.assistant.services.assistant_service import AssistantService

router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])

settings = get_settings()

_NOT_CONFIGURED = (
    "The assistant isn't linked to an organization yet — the administrator "
    "needs to set WHATSAPP_DEFAULT_ORG_ID on the server."
)
_EMPTY_PROMPT = (
    "Send a question like: stock at your site, issues this week, or pending invoices."
)


def _resolve_org_id() -> Optional[uuid.UUID]:
    if settings.whatsapp_default_org_id:
        return uuid.UUID(settings.whatsapp_default_org_id)
    if settings.demo_mode:
        return uuid.UUID(_DEMO_ORG_ID)
    return None


def _first(d: dict, *keys: str) -> str:
    """Return the first present, non-empty value among keys (case-insensitive)."""
    lowered = {k.lower(): v for k, v in d.items()}
    for key in keys:
        val = lowered.get(key.lower())
        if isinstance(val, str) and val.strip():
            return val.strip()
    return ""


def _parse_sfmc_payload(payload: dict) -> Tuple[str, str]:
    """Pull (sender_phone, message_text) from an SFMC inbound JSON body.

    SFMC inbound shapes vary by channel/config; we check the common field
    names and a nested `messages`/`entry` envelope. Returns ("","") if we
    can't find them (caller then sends the empty-prompt hint)."""
    body = _first(payload, "messageText", "message", "body", "text", "content")
    sender = _first(payload, "mobileNumber", "from", "sender", "msisdn", "phoneNumber", "contactKey")

    if (not body or not sender) and isinstance(payload.get("messages"), list) and payload["messages"]:
        msg = payload["messages"][0]
        if isinstance(msg, dict):
            body = body or _first(msg, "messageText", "message", "body", "text", "content")
            sender = sender or _first(msg, "mobileNumber", "from", "sender", "msisdn", "phoneNumber")
    return sender, body


def _twiml(reply: str) -> Response:
    xml = f"<?xml version='1.0' encoding='UTF-8'?><Response><Message>{escape(reply)}</Message></Response>"
    return Response(content=xml, media_type="application/xml")


@router.post("/webhook")
async def whatsapp_inbound(request: Request, db: Session = Depends(get_db)) -> Response:
    content_type = request.headers.get("content-type", "")
    is_json = "application/json" in content_type

    if is_json:
        payload = await request.json()
        sender_raw, question = _parse_sfmc_payload(payload if isinstance(payload, dict) else {})
    else:
        form = await request.form()
        sender_raw = str(form.get("From", ""))
        question = str(form.get("Body", "")).strip()

    sender = sender_raw.replace("whatsapp:", "").strip() or None
    org_id = _resolve_org_id()

    if org_id is None:
        return {"reply": _NOT_CONFIGURED} if is_json else _twiml(_NOT_CONFIGURED)

    if question:
        _, assistant_message = AssistantService(db).ask(
            org_id=org_id,
            question=question,
            channel=MessageChannel.WHATSAPP,
            sender_phone=sender,
        )
        reply = assistant_message.content
    else:
        reply = _EMPTY_PROMPT

    return {"reply": reply, "to": sender} if is_json else _twiml(reply)
