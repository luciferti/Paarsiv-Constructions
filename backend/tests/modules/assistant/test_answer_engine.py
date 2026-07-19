import uuid
from datetime import date

from app.modules.assistant.services.answer_engine import (
    AssistantContext,
    RuleBasedAnswerProvider,
)
from app.modules.material.schemas.material_schema import MaterialCreate, MaterialEntryCreate
from app.modules.material.services.material_service import MaterialEntryService, MaterialService
from app.modules.report.schemas.report_schema import DailyReportCreate
from app.modules.report.services.report_service import ReportService
from app.modules.site.schemas.site_schema import SiteCreate
from app.modules.site.services.site_service import SiteService


def seed_site_with_data(db, org_id, user_id):
    site = SiteService(db).create_site(
        org_id, user_id, SiteCreate(name="Riverside Tower", code="SITE-001")
    )
    material = MaterialService(db).create_material(
        org_id, user_id, MaterialCreate(name="Cement", code="MAT-001", unit="bag")
    )
    MaterialEntryService(db).add_entry(
        org_id,
        site.id,
        user_id,
        MaterialEntryCreate(
            material_id=material.id,
            entry_type="received",
            quantity=200,
            entry_date=date.today(),
        ),
    )
    ReportService(db).create_report(
        org_id,
        site.id,
        user_id,
        DailyReportCreate(
            report_date=date.today(),
            work_summary="Poured slab",
            issues="Cement delivery delayed",
        ),
    )
    return site


class TestRuleBasedAnswers:
    def test_answers_stock_question_for_named_site(self, db, org_id, user_id):
        seed_site_with_data(db, org_id, user_id)
        provider = RuleBasedAnswerProvider()

        answer = provider.answer(
            "What's the stock at Riverside Tower?", AssistantContext(db, org_id)
        )

        assert "Riverside Tower" in answer
        assert "Cement" in answer
        assert "200" in answer

    def test_answers_issues_question(self, db, org_id, user_id):
        seed_site_with_data(db, org_id, user_id)
        provider = RuleBasedAnswerProvider()

        answer = provider.answer("Any issues this week?", AssistantContext(db, org_id))

        assert "Cement delivery delayed" in answer

    def test_lists_sites(self, db, org_id, user_id):
        seed_site_with_data(db, org_id, user_id)
        provider = RuleBasedAnswerProvider()

        answer = provider.answer("list my sites", AssistantContext(db, org_id))

        assert "SITE-001" in answer

    def test_falls_back_to_help_text(self, db, org_id):
        provider = RuleBasedAnswerProvider()

        answer = provider.answer("what is the meaning of life", AssistantContext(db, org_id))

        assert "your organization's live data" in answer

    def test_does_not_leak_other_org_data(self, db, org_id, user_id):
        other_org = uuid.uuid4()
        SiteService(db).create_site(
            other_org, user_id, SiteCreate(name="Secret Site", code="X-1")
        )
        provider = RuleBasedAnswerProvider()

        answer = provider.answer("list my sites", AssistantContext(db, org_id))

        assert "Secret Site" not in answer


class TestHinglishAndMultiIntent:
    """The exact phrasings that previously produced wrong answers."""

    def test_invoice_count_in_hinglish(self, db, org_id, user_id):
        provider = RuleBasedAnswerProvider()

        answer = provider.answer("invoices kitne gye hai", AssistantContext(db, org_id))

        assert "invoice" in answer.lower()
        assert "stock" not in answer.lower()

    def test_create_invoice_request_gets_guidance_not_data(self, db, org_id, user_id):
        provider = RuleBasedAnswerProvider()

        answer = provider.answer("kya ek invoice bana skte ho", AssistantContext(db, org_id))

        assert "can't create" in answer
        assert "Invoices page" in answer

    def test_combined_summary_covers_all_domains(self, db, org_id, user_id):
        seed_site_with_data(db, org_id, user_id)
        provider = RuleBasedAnswerProvider()

        answer = provider.answer(
            "mujhe sab sites venoders and meterials ki price sab summary chaiye",
            AssistantContext(db, org_id),
        )

        assert "SITES" in answer
        assert "VENDORS" in answer
        assert "MATERIALS" in answer
        assert "Riverside Tower" in answer

    def test_spend_question_in_hinglish(self, db, org_id, user_id):
        seed_site_with_data(db, org_id, user_id)
        provider = RuleBasedAnswerProvider()

        answer = provider.answer("material ka kharcha kitna hua", AssistantContext(db, org_id))

        assert "spend" in answer.lower() or "cost" in answer.lower()
