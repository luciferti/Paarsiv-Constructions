import uuid
from typing import Optional

from sqlalchemy.orm import Session

from app.modules.invoice.exceptions import InvoiceNotFoundError
from app.modules.invoice.models.invoice_model import Invoice, InvoiceStatus
from app.modules.invoice.repositories.invoice_repository import InvoiceRepository
from app.modules.invoice.schemas.invoice_schema import InvoiceReviewUpdate, PaginatedInvoices
from app.modules.invoice.services.file_storage import FileStorage, get_file_storage
from app.modules.invoice.services.ocr_provider import OCRProvider, get_ocr_provider


class InvoiceService:
    def __init__(
        self,
        db: Session,
        storage: Optional[FileStorage] = None,
        ocr: Optional[OCRProvider] = None,
    ):
        self.db = db
        self.repo = InvoiceRepository(db)
        self.storage = storage or get_file_storage()
        self.ocr = ocr or get_ocr_provider()

    def upload_invoice(
        self,
        org_id: uuid.UUID,
        created_by: uuid.UUID,
        vendor_id: uuid.UUID,
        site_id: Optional[uuid.UUID],
        file_bytes: bytes,
        original_filename: str,
    ) -> Invoice:
        file_path = self.storage.save(file_bytes, original_filename)
        extracted = self.ocr.extract(file_bytes, original_filename)

        invoice = Invoice(
            org_id=org_id,
            created_by=created_by,
            vendor_id=vendor_id,
            site_id=site_id,
            file_path=file_path,
            original_filename=original_filename,
            invoice_number=extracted.invoice_number,
            invoice_date=extracted.invoice_date,
            amount=extracted.amount,
            raw_ocr_text=extracted.raw_text,
            status=InvoiceStatus.PENDING_REVIEW,
        )
        invoice = self.repo.create(invoice)
        self.db.commit()
        self.db.refresh(invoice)
        return invoice

    def get_invoice(self, org_id: uuid.UUID, invoice_id: uuid.UUID) -> Invoice:
        invoice = self.repo.get_by_id(org_id, invoice_id)
        if invoice is None:
            raise InvoiceNotFoundError(invoice_id)
        return invoice

    def list_invoices(
        self,
        org_id: uuid.UUID,
        page: int = 1,
        page_size: int = 20,
        vendor_id: Optional[uuid.UUID] = None,
        site_id: Optional[uuid.UUID] = None,
        status: Optional[InvoiceStatus] = None,
    ) -> PaginatedInvoices:
        items, total = self.repo.list(
            org_id, page=page, page_size=page_size, vendor_id=vendor_id, site_id=site_id, status=status
        )
        return PaginatedInvoices(items=items, total=total, page=page, page_size=page_size)

    def review_invoice(
        self, org_id: uuid.UUID, invoice_id: uuid.UUID, payload: InvoiceReviewUpdate
    ) -> Invoice:
        invoice = self.get_invoice(org_id, invoice_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(invoice, field, value)
        self.db.commit()
        self.db.refresh(invoice)
        return invoice
