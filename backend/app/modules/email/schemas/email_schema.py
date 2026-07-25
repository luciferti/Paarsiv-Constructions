from pydantic import BaseModel, EmailStr, Field


class TestEmailRequest(BaseModel):
    to_email: EmailStr
    subject: str = Field("HRMS test email", min_length=1, max_length=255)
    body: str = Field("This is a test email from your HRMS.", min_length=1)


class EmailSendResult(BaseModel):
    status: str
    provider_used: str
    detail: str = ""


class MessagingStatus(BaseModel):
    email_provider: str
    whatsapp_provider: str
    sfmc_configured: bool
