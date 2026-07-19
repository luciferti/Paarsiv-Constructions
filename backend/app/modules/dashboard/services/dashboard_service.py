"""
Read-only cross-module aggregation for the dashboard.

This service queries other modules' ORM models directly (never their
services) purely to compose counts and recent-activity lists — it
owns no data of its own. That keeps it consistent with the rest of
the app's convention: modules communicate via IDs/foreign keys, and
a read-only reporting layer is allowed to read across tables the way
a BI query would, without coupling to other modules' business logic.
"""

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.dashboard.schemas.dashboard_schema import DashboardSummary, RecentReportItem
from app.modules.invoice.models.invoice_model import Invoice, InvoiceStatus
from app.modules.material.models.material_model import Material
from app.modules.notification.models.notification_model import Notification
from app.modules.notification.schemas.notification_schema import NotificationOut
from app.modules.report.models.report_model import DailyReport
from app.modules.site.models.site_model import Site
from app.modules.vendor.models.vendor_model import Vendor


class DashboardService:
    def __init__(self, db: Session):
        self.db = db

    def get_summary(self, org_id: uuid.UUID) -> DashboardSummary:
        sites_by_status = dict(
            self.db.execute(
                select(Site.status, func.count())
                .where(Site.org_id == org_id, Site.is_deleted.is_(False))
                .group_by(Site.status)
            ).all()
        )
        sites_by_status = {status.value: count for status, count in sites_by_status.items()}
        total_sites = sum(sites_by_status.values())

        total_vendors = self.db.execute(
            select(func.count())
            .select_from(Vendor)
            .where(Vendor.org_id == org_id, Vendor.is_deleted.is_(False))
        ).scalar_one()

        total_materials = self.db.execute(
            select(func.count())
            .select_from(Material)
            .where(Material.org_id == org_id, Material.is_deleted.is_(False))
        ).scalar_one()

        pending_invoices = self.db.execute(
            select(func.count())
            .select_from(Invoice)
            .where(Invoice.org_id == org_id, Invoice.status == InvoiceStatus.PENDING_REVIEW)
        ).scalar_one()

        recent_reports_stmt = (
            select(DailyReport, Site.name)
            .join(Site, Site.id == DailyReport.site_id)
            .where(DailyReport.org_id == org_id)
            .order_by(DailyReport.report_date.desc(), DailyReport.created_at.desc())
            .limit(5)
        )
        recent_reports = [
            RecentReportItem(
                site_id=report.site_id,
                site_name=site_name,
                report_date=report.report_date,
                work_summary=report.work_summary,
            )
            for report, site_name in self.db.execute(recent_reports_stmt).all()
        ]

        recent_notifications_stmt = (
            select(Notification)
            .where(Notification.org_id == org_id)
            .order_by(Notification.created_at.desc())
            .limit(5)
        )
        recent_notifications = [
            NotificationOut.model_validate(n)
            for n in self.db.execute(recent_notifications_stmt).scalars().all()
        ]

        return DashboardSummary(
            total_sites=total_sites,
            sites_by_status=sites_by_status,
            total_vendors=total_vendors,
            total_materials=total_materials,
            pending_invoices=pending_invoices,
            recent_reports=recent_reports,
            recent_notifications=recent_notifications,
        )
