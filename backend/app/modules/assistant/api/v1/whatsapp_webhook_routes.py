"""
Inbound WhatsApp webhook (Twilio format).

Point the Twilio WhatsApp sandbox/number's "when a message comes in"
webhook at POST /api/v1/whatsapp/webhook. Twilio sends the message as
form fields (`From`, `Body`) and accepts a TwiML XML reply — so the
two-way bot needs no Twilio credentials on this path at all; replies
ride back on the webhook response.

In production, set WHATSAPP_DEFAULT_ORG_ID to the organization the
bot should answer for (your org id from the organizations table).
Without it, inbound messages get a polite "not configured" reply
instead of leaking anything.

TODO(integration): validate the X-Twilio-Signature header
(twilio.request_validator) so only Twilio can call this endpoint,
and resolve the org per-sender via employee phone lookup instead of
one default org.
"""

import uuid
from typing import Optional
from xml.sax.saxutils import escape

from fastapi import APIRouter, Depends, Form, Response
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.deps import _DEMO_ORG_ID
from app.modules.assistant.models.assistant_model import MessageChannel
from app.modules.assistant.services.assistant_service import AssistantService

router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])

settings = get_settings()


def _resolve_org_id() -> Optional[uuid.UUID]:
    if settings.whatsapp_default_org_id:
        return uuid.UUID(settings.whatsapp_default_org_id)
    if settings.demo_mode:
        return uuid.UUID(_DEMO_ORG_ID)
    return None


@router.post("/webhook")
def whatsapp_inbound(
    Body: str = Form(""),
    From: str = Form(""),
    db: Session = Depends(get_db),
) -> Response:
    org_id = _resolve_org_id()
    sender = From.replace("whatsapp:", "") or None

    if org_id is None:
        twiml = (
            "<?xml version='1.0' encoding='UTF-8'?><Response><Message>"
            "The assistant isn't linked to an organization yet — the administrator "
            "needs to set WHATSAPP_DEFAULT_ORG_ID on the server."
            "</Message></Response>"
        )
        return Response(content=twiml, media_type="application/xml")

    question = Body.strip()
    if question:
        _, assistant_message = AssistantService(db).ask(
            org_id=org_id,
            question=question,
            channel=MessageChannel.WHATSAPP,
            sender_phone=sender,
        )
        reply = assistant_message.content
    else:
        reply = "Send a question like: stock at your site, issues this week, or pending invoices."

    twiml = f"<?xml version='1.0' encoding='UTF-8'?><Response><Message>{escape(reply)}</Message></Response>"
    return Response(content=twiml, media_type="application/xml")
