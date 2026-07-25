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


_TEXT_KEYS = ("messageText", "message", "body", "text", "content")
_SENDER_KEYS = ("mobileNumber", "from", "sender", "msisdn", "phoneNumber", "contactKey")


def _extract_message(node: dict) -> Tuple[str, str]:
    """(sender, text) from one message-like dict. `text` may be a string or a
    WhatsApp/GroupConnect object like {"body": "..."}."""
    sender = _first(node, *_SENDER_KEYS)
    text = _first(node, *_TEXT_KEYS)
    if not text and isinstance(node.get("text"), dict):
        text = _first(node["text"], "body", "message", "content")
    return sender, text


def _parse_sfmc_payload(payload: dict) -> Tuple[str, str]:
    """Pull (sender_phone, message_text) from an SFMC inbound JSON body.

    Handles the shapes SFMC WhatsApp emits depending on channel/config:
      1. Flat MobileConnect:  {"mobileNumber": "...", "messageText": "..."}
      2. Nested messages[]:   {"messages": [{"from": "...", "text": "..."}]}
      3. GroupConnect/Meta:   {"entry": [{"changes": [{"value":
                                {"messages": [{"from": "...",
                                 "text": {"body": "..."}}]}}]}]}
    Returns ("","") if nothing matches (caller then sends the prompt hint).
    A canonical sample lives in tests/fixtures/sfmc_inbound_samples.json."""
    sender, body = _extract_message(payload)
    if sender and body:
        return sender, body

    # 2. top-level messages[]
    messages = payload.get("messages")
    if isinstance(messages, list) and messages and isinstance(messages[0], dict):
        s, b = _extract_message(messages[0])
        sender, body = sender or s, body or b
        if sender and body:
            return sender, body

    # 3. GroupConnect/Meta envelope: entry[].changes[].value.messages[]
    for entry in payload.get("entry", []) or []:
        if not isinstance(entry, dict):
            continue
        for change in entry.get("changes", []) or []:
            value = change.get("value", {}) if isinstance(change, dict) else {}
            msgs = value.get("messages") if isinstance(value, dict) else None
            if isinstance(msgs, list) and msgs and isinstance(msgs[0], dict):
                s, b = _extract_message(msgs[0])
                sender, body = sender or s, body or b
                if sender and body:
                    return sender, body

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
