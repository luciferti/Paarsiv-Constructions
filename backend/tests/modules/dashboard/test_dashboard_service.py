import uuid
from datetime import date

from app.modules.dashboard.services.dashboard_service import DashboardService
from app.modules.material.schemas.material_schema import MaterialCreate
from app.modules.material.services.material_service import MaterialService
from app.modules.notification.schemas.notification_schema import NotificationCreate
from app.modules.notification.services.notification_service import NotificationService
from app.modules.notification.services.whatsapp_provider import SendResult, WhatsAppProvider
from app.modules.report.schemas.report_schema import DailyReportCreate
from app.modules.report.services.report_service import ReportService
from app.modules.site.models.site_model import SiteStatus
from app.modules.site.schemas.site_schema import SiteCreate
from app.modules.site.services.site_service import SiteService
from app.modules.vendor.schemas.vendor_schema import VendorCreate
from app.modules.vendor.services.vendor_service import VendorService


class FakeProvider(WhatsAppProvider):
    def send(self, to_phone: str, message: str) -> SendResult:
        return SendResult(status="logged", provider_used="logging-only")


class TestDashboardSummary:
    def test_aggregates_counts_and_recent_activity(self, db, org_id, user_id):
        site_service = SiteService(db)
        site_a = site_service.create_site(org_id, user_id, SiteCreate(name="Site A", code="A1"))
        site_service.create_site(
            org_id, user_id, SiteCreate(name="Site B", code="B1", status=SiteStatus.ACTIVE)
        )

        VendorService(db).create_vendor(org_id, user_id, VendorCreate(name="Vendor 1", code="V1"))
        MaterialService(db).create_material(
            org_id, user_id, MaterialCreate(name="Cement", code="CEM-01", unit="bag")
        )
        ReportService(db).create_report(
            org_id, site_a.id, user_id, DailyReportCreate(report_date=date.today(), work_summary="Poured slab")
        )
        NotificationService(db, provider=FakeProvider()).send_notification(
            org_id, user_id, NotificationCreate(recipient_phone="+15551234567", message="Update")
        )

        summary = DashboardService(db).get_summary(org_id)

        assert summary.total_sites == 2
        assert summary.sites_by_status["planning"] == 1
        assert summary.sites_by_status["active"] == 1
        assert summary.total_vendors == 1
        assert summary.total_materials == 1
        assert len(summary.recent_reports) == 1
        assert summary.recent_reports[0].site_name == "Site A"
        assert len(summary.recent_notifications) == 1

    def test_scopes_everything_to_org(self, db, org_id, user_id):
        SiteService(db).create_site(uuid.uuid4(), user_id, SiteCreate(name="Other Org Site", code="X1"))

        summary = DashboardService(db).get_summary(org_id)

        assert summary.total_sites == 0
