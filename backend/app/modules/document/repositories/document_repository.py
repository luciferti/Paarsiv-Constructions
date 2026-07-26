import uuid
from typing import List, Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.document.models.document_model import Document, DocumentCategory


class DocumentRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, document: Document) -> Document:
        self.db.add(document)
        self.db.flush()
        return document

    def get_by_id(self, org_id: uuid.UUID, document_id: uuid.UUID) -> Optional[Document]:
        stmt = select(Document).where(
            Document.id == document_id,
            Document.org_id == org_id,
            Document.is_deleted.is_(False),
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def list(
        self,
        org_id: uuid.UUID,
        page: int,
        page_size: int,
        site_id: Optional[uuid.UUID] = None,
        category: Optional[DocumentCategory] = None,
    ) -> Tuple[List[Document], int]:
        conditions = [Document.org_id == org_id, Document.is_deleted.is_(False)]
        if site_id is not None:
            conditions.append(Document.site_id == site_id)
        if category is not None:
            conditions.append(Document.category == category)

        total = self.db.execute(
            select(func.count()).select_from(Document).where(*conditions)
        ).scalar_one()
        stmt = (
            select(Document)
            .where(*conditions)
            .order_by(Document.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        return list(self.db.execute(stmt).scalars().all()), total

    def all_for_summary(self, org_id: uuid.UUID) -> List[Document]:
        return list(
            self.db.execute(
                select(Document).where(Document.org_id == org_id, Document.is_deleted.is_(False))
            ).scalars().all()
        )

    def soft_delete(self, document: Document) -> None:
        document.is_deleted = True
        self.db.flush()
