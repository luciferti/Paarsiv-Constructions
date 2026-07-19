import uuid
from datetime import date
from typing import Dict, List, Optional

from pydantic import BaseModel

from app.modules.notification.schemas.notification_schema import NotificationOut


class RecentReportItem(BaseModel):
    site_id: uuid.UUID
    site_name: str
    report_date: date
    work_summary: str


class DashboardSummary(BaseModel):
    total_sites: int
    sites_by_status: Dict[str, int]
    total_vendors: int
    total_materials: int
    pending_invoices: int
    recent_reports: List[RecentReportItem]
    recent_notifications: List[NotificationOut]
