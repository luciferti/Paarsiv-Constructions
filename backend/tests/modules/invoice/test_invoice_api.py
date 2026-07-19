import uuid
from datetime import date

import pytest
from fastapi.testclient import TestClient

from app.core.database import get_db
from app.core.deps import CurrentUser, get_current_user
from app.main import app
from app.modules.invoice.dependencies import get_invoice_service
from app.modules.invoice.services.invoice_service import InvoiceService
from app.modules.invoice.services.ocr_provider import ExtractedInvoiceData, OCRProvider

ALL_PERMISSIONS = frozenset({"invoice:view", "invoice:upload", "invoice:review"})


class FakeStorage:
    def save(self, file_bytes: bytes, original_filename: str) -> str:
        return f"uploads/invoices/fake-{original_filename}"


class FakeOCR(OCRProvider):
    def extract(self, file_bytes: bytes, filename: str) -> ExtractedInvoiceData:
        return ExtractedInvoiceData(
            invoice_number="INV-TEST-1", invoice_date=date.today(), amount=500.0, raw_text="fake"
        )


@pytest.fixture()
def client(db, org_id, user_id):
    def override_get_db():
        yield db

    def override_get_current_user():
        return CurrentUser(id=str(user_id), org_id=str(org_id), permissions=ALL_PERMISSIONS)

    def override_get_invoice_service():
        return InvoiceService(db, storage=FakeStorage(), ocr=FakeOCR())

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[get_invoice_service] = override_get_invoice_service
    yield TestClient(app)
    app.dependency_overrides.clear()


def upload_invoice(client, vendor_id):
    return client.post(
        "/api/v1/invoices",
        data={"vendor_id": vendor_id},
        files={"file": ("invoice.pdf", b"%PDF-1.4 fake", "application/pdf")},
    )


class TestUploadInvoiceEndpoint:
    def test_uploads_invoice_and_returns_extracted_fields(self, client):
        response = upload_invoice(client, str(uuid.uuid4()))

        assert response.status_code == 201
        body = response.json()
        assert body["invoice_number"] == "INV-TEST-1"
        assert body["status"] == "pending_review"

    def test_forbidden_without_permission(self, client):
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(
            id=str(uuid.uuid4()), org_id=str(uuid.uuid4()), permissions=frozenset()
        )

        response = upload_invoice(client, str(uuid.uuid4()))

        assert response.status_code == 403


class TestInvoiceReviewEndpoints:
    def test_get_and_review_invoice(self, client):
        created = upload_invoice(client, str(uuid.uuid4())).json()

        get_response = client.get(f"/api/v1/invoices/{created['id']}")
        assert get_response.status_code == 200

        review_response = client.patch(
            f"/api/v1/invoices/{created['id']}", json={"status": "approved", "amount": 750.25}
        )
        assert review_response.status_code == 200
        assert review_response.json()["status"] == "approved"
        assert review_response.json()["amount"] == 750.25

    def test_returns_404_for_missing_invoice(self, client):
        response = client.get(f"/api/v1/invoices/{uuid.uuid4()}")
        assert response.status_code == 404


class TestListInvoicesEndpoint:
    def test_lists_invoices(self, client):
        upload_invoice(client, str(uuid.uuid4()))
        upload_invoice(client, str(uuid.uuid4()))

        response = client.get("/api/v1/invoices")

        assert response.status_code == 200
        assert response.json()["total"] == 2
