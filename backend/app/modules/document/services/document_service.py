import uuid
from datetime import date, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from app.modules.document.exceptions import DocumentNotFoundError
from app.modules.document.models.document_model import Document
from app.modules.document.repositories.document_repository import DocumentRepository
from app.modules.document.schemas.document_schema import (
    DocumentCreate,
    DocumentSummary,
    DocumentUpdate,
    PaginatedDocuments,
)

_EXPIRING_WINDOW_DAYS = 30


class DocumentService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = DocumentRepository(db)

    def create_document(
        self, org_id: uuid.UUID, created_by: uuid.UUID, payload: DocumentCreate
    ) -> Document:
        document = Document(org_id=org_id, created_by=created_by, **payload.model_dump())
        document = self.repo.create(document)
        self.db.commit()
        self.db.refresh(document)
        return document

    def get_document(self, org_id: uuid.UUID, document_id: uuid.UUID) -> Document:
        document = self.repo.get_by_id(org_id, document_id)
        if document is None:
            raise DocumentNotFoundError(document_id)
        return document

    def list_documents(
        self, org_id: uuid.UUID, page: int = 1, page_size: int = 20, site_id=None, category=None
    ) -> PaginatedDocuments:
        items, total = self.repo.list(
            org_id, page=page, page_size=page_size, site_id=site_id, category=category
        )
        return PaginatedDocuments(items=items, total=total, page=page, page_size=page_size)

    def update_document(
        self, org_id: uuid.UUID, document_id: uuid.UUID, payload: DocumentUpdate
    ) -> Document:
        document = self.get_document(org_id, document_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(document, field, value)
        self.db.commit()
        self.db.refresh(document)
        return document

    def delete_document(self, org_id: uuid.UUID, document_id: uuid.UUID) -> None:
        document = self.get_document(org_id, document_id)
        self.repo.soft_delete(document)
        self.db.commit()

    def summary(self, org_id: uuid.UUID) -> DocumentSummary:
        docs = self.repo.all_for_summary(org_id)
        today = date.today()
        soon = today + timedelta(days=_EXPIRING_WINDOW_DAYS)

        by_category: dict = {}
        expiring_soon = 0
        expired = 0
        for doc in docs:
            by_category[doc.category.value] = by_category.get(doc.category.value, 0) + 1
            if doc.expiry_date is not None:
                if doc.expiry_date < today:
                    expired += 1
                elif doc.expiry_date <= soon:
                    expiring_soon += 1

        return DocumentSummary(
            total=len(docs),
            by_category=by_category,
            expiring_soon=expiring_soon,
            expired=expired,
        )
