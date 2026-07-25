from fastapi import APIRouter, Depends

from app.core.config import get_settings
from app.core.deps import CurrentUser, require_permission
from app.modules.email.schemas.email_schema import (
    EmailSendResult,
    MessagingStatus,
    TestEmailRequest,
)
from app.modules.email.services.email_service import EmailService
from app.modules.notification.services.whatsapp_provider import get_whatsapp_provider

router = APIRouter(prefix="/messaging", tags=["messaging"])

require_messaging_admin = require_permission("messaging:admin")


@router.get("/status", response_model=MessagingStatus)
def messaging_status(
    user: CurrentUser = Depends(require_messaging_admin),
) -> MessagingStatus:
    settings = get_settings()
    return MessagingStatus(
        email_provider=type(EmailService().provider).__name__,
        whatsapp_provider=type(get_whatsapp_provider()).__name__,
        sfmc_configured=settings.sfmc_configured,
    )


@router.post("/email/test", response_model=EmailSendResult)
def send_test_email(
    payload: TestEmailRequest,
    user: CurrentUser = Depends(require_messaging_admin),
) -> EmailSendResult:
    result = EmailService().send(
        to_email=str(payload.to_email), subject=payload.subject, body=payload.body
    )
    return EmailSendResult(
        status=result.status, provider_used=result.provider_used, detail=result.detail
    )
