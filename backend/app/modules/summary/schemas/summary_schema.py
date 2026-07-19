import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class SiteAISummaryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    site_id: uuid.UUID
    summary_text: str
    source_report_count: int
    model_used: str
    generated_at: datetime
