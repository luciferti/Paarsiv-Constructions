import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status

from app.core.deps import CurrentUser
from app.modules.invoice.dependencies import (
    get_invoice_service,
    require_invoice_review,
    require_invoice_upload,
    require_invoice_view,
)
from app.modules.invoice.models.invoice_model import InvoiceStatus
from app.modules.invoice.schemas.invoice_schema import (
    InvoiceOut,
    InvoiceReviewUpdate,
    PaginatedInvoices,
)
from app.modules.invoice.services.invoice_service import InvoiceService

router = APIRouter(prefix="/invoices", tags=["invoices"])


@router.post("", response_model=InvoiceOut, status_code=status.HTTP_201_CREATED)
async def upload_invoice(
    vendor_id: uuid.UUID = Form(...),
    site_id: Optional[uuid.UUID] = Form(None),
    file: UploadFile = File(...),
    user: CurrentUser = Depends(require_invoice_upload),
    service: InvoiceService = Depends(get_invoice_service),
) -> InvoiceOut:
    file_bytes = await file.read()
    invoice = service.upload_invoice(
        org_id=uuid.UUID(user.org_id),
        created_by=uuid.UUID(user.id),
        vendor_id=vendor_id,
        site_id=site_id,
        file_bytes=file_bytes,
        original_filename=file.filename or "invoice",
    )
    return InvoiceOut.model_validate(invoice)


@router.get("", response_model=PaginatedInvoices)
def list_invoices(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    vendor_id: Optional[uuid.UUID] = Query(None),
    site_id: Optional[uuid.UUID] = Query(None),
    status_filter: Optional[InvoiceStatus] = Query(None, alias="status"),
    user: CurrentUser = Depends(require_invoice_view),
    service: InvoiceService = Depends(get_invoice_service),
) -> PaginatedInvoices:
    return service.list_invoices(
        org_id=uuid.UUID(user.org_id),
        page=page,
        page_size=page_size,
        vendor_id=vendor_id,
        site_id=site_id,
        status=status_filter,
    )


@router.get("/{invoice_id}", response_model=InvoiceOut)
def get_invoice(
    invoice_id: uuid.UUID,
    user: CurrentUser = Depends(require_invoice_view),
    service: InvoiceService = Depends(get_invoice_service),
) -> InvoiceOut:
    invoice = service.get_invoice(org_id=uuid.UUID(user.org_id), invoice_id=invoice_id)
    return InvoiceOut.model_validate(invoice)


@router.patch("/{invoice_id}", response_model=InvoiceOut)
def review_invoice(
    invoice_id: uuid.UUID,
    payload: InvoiceReviewUpdate,
    user: CurrentUser = Depends(require_invoice_review),
    service: InvoiceService = Depends(get_invoice_service),
) -> InvoiceOut:
    invoice = service.review_invoice(
        org_id=uuid.UUID(user.org_id), invoice_id=invoice_id, payload=payload
    )
    return InvoiceOut.model_validate(invoice)
