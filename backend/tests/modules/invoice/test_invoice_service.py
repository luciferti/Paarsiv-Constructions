import uuid
from datetime import date

import pytest

from app.modules.invoice.exceptions import InvoiceNotFoundError
from app.modules.invoice.models.invoice_model import InvoiceStatus
from app.modules.invoice.schemas.invoice_schema import InvoiceReviewUpdate
from app.modules.invoice.services.invoice_service import InvoiceService
from app.modules.invoice.services.ocr_provider import ExtractedInvoiceData, OCRProvider


class FakeStorage:
    def save(self, file_bytes: bytes, original_filename: str) -> str:
        return f"uploads/invoices/fake-{original_filename}"


class FakeOCR(OCRProvider):
    def extract(self, file_bytes: bytes, filename: str) -> ExtractedInvoiceData:
        return ExtractedInvoiceData(
            invoice_number="INV-TEST-1", invoice_date=date.today(), amount=1234.56, raw_text="fake"
        )


class TestUploadInvoice:
    def test_uploads_and_extracts_fields(self, db, org_id, user_id):
        service = InvoiceService(db, storage=FakeStorage(), ocr=FakeOCR())
        vendor_id = uuid.uuid4()

        invoice = service.upload_invoice(
            org_id, user_id, vendor_id, None, b"fake-bytes", "invoice.pdf"
        )

        assert invoice.id is not None
        assert invoice.status == InvoiceStatus.PENDING_REVIEW
        assert invoice.invoice_number == "INV-TEST-1"
        assert float(invoice.amount) == 1234.56
        assert invoice.file_path == "uploads/invoices/fake-invoice.pdf"


class TestGetInvoice:
    def test_raises_when_not_found(self, db, org_id):
        service = InvoiceService(db, storage=FakeStorage(), ocr=FakeOCR())
        with pytest.raises(InvoiceNotFoundError):
            service.get_invoice(org_id, uuid.uuid4())


class TestReviewInvoice:
    def test_updates_fields_and_status(self, db, org_id, user_id):
        service = InvoiceService(db, storage=FakeStorage(), ocr=FakeOCR())
        invoice = service.upload_invoice(
            org_id, user_id, uuid.uuid4(), None, b"fake-bytes", "invoice.pdf"
        )

        updated = service.review_invoice(
            org_id,
            invoice.id,
            InvoiceReviewUpdate(amount=999.99, status=InvoiceStatus.APPROVED),
        )

        assert float(updated.amount) == 999.99
        assert updated.status == InvoiceStatus.APPROVED


class TestListInvoices:
    def test_filters_by_vendor(self, db, org_id, user_id):
        service = InvoiceService(db, storage=FakeStorage(), ocr=FakeOCR())
        vendor_a, vendor_b = uuid.uuid4(), uuid.uuid4()
        service.upload_invoice(org_id, user_id, vendor_a, None, b"x", "a.pdf")
        service.upload_invoice(org_id, user_id, vendor_b, None, b"x", "b.pdf")

        result = service.list_invoices(org_id, vendor_id=vendor_a)

        assert result.total == 1
