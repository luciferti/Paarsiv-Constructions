import uuid
from typing import List, Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.invoice.models.invoice_model import Invoice, InvoiceStatus


class InvoiceRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, invoice: Invoice) -> Invoice:
        self.db.add(invoice)
        self.db.flush()
        return invoice

    def get_by_id(self, org_id: uuid.UUID, invoice_id: uuid.UUID) -> Optional[Invoice]:
        stmt = select(Invoice).where(Invoice.id == invoice_id, Invoice.org_id == org_id)
        return self.db.execute(stmt).scalar_one_or_none()

    def list(
        self,
        org_id: uuid.UUID,
        page: int,
        page_size: int,
        vendor_id: Optional[uuid.UUID] = None,
        site_id: Optional[uuid.UUID] = None,
        status: Optional[InvoiceStatus] = None,
    ) -> Tuple[List[Invoice], int]:
        conditions = [Invoice.org_id == org_id]
        if vendor_id is not None:
            conditions.append(Invoice.vendor_id == vendor_id)
        if site_id is not None:
            conditions.append(Invoice.site_id == site_id)
        if status is not None:
            conditions.append(Invoice.status == status)

        base_stmt = select(Invoice).where(*conditions)
        count_stmt = select(func.count()).select_from(Invoice).where(*conditions)
        total = self.db.execute(count_stmt).scalar_one()

        stmt = (
            base_stmt.order_by(Invoice.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        items = list(self.db.execute(stmt).scalars().all())
        return items, total
