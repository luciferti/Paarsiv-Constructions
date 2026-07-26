import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, status

from app.core.deps import CurrentUser
from app.modules.document.dependencies import (
    get_document_service,
    require_document_create,
    require_document_delete,
    require_document_edit,
    require_document_view,
)
from app.modules.document.models.document_model import DocumentCategory
from app.modules.document.schemas.document_schema import (
    DocumentCreate,
    DocumentOut,
    DocumentSummary,
    DocumentUpdate,
    PaginatedDocuments,
)
from app.modules.document.services.document_service import DocumentService

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
def create_document(
    payload: DocumentCreate,
    user: CurrentUser = Depends(require_document_create),
    service: DocumentService = Depends(get_document_service),
) -> DocumentOut:
    doc = service.create_document(
        org_id=uuid.UUID(user.org_id), created_by=uuid.UUID(user.id), payload=payload
    )
    return DocumentOut.model_validate(doc)


@router.get("/summary", response_model=DocumentSummary)
def document_summary(
    user: CurrentUser = Depends(require_document_view),
    service: DocumentService = Depends(get_document_service),
) -> DocumentSummary:
    return service.summary(org_id=uuid.UUID(user.org_id))


@router.get("", response_model=PaginatedDocuments)
def list_documents(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    site_id: Optional[uuid.UUID] = Query(None),
    category: Optional[DocumentCategory] = Query(None),
    user: CurrentUser = Depends(require_document_view),
    service: DocumentService = Depends(get_document_service),
) -> PaginatedDocuments:
    return service.list_documents(
        org_id=uuid.UUID(user.org_id), page=page, page_size=page_size, site_id=site_id, category=category
    )


@router.get("/{document_id}", response_model=DocumentOut)
def get_document(
    document_id: uuid.UUID,
    user: CurrentUser = Depends(require_document_view),
    service: DocumentService = Depends(get_document_service),
) -> DocumentOut:
    return DocumentOut.model_validate(
        service.get_document(org_id=uuid.UUID(user.org_id), document_id=document_id)
    )


@router.patch("/{document_id}", response_model=DocumentOut)
def update_document(
    document_id: uuid.UUID,
    payload: DocumentUpdate,
    user: CurrentUser = Depends(require_document_edit),
    service: DocumentService = Depends(get_document_service),
) -> DocumentOut:
    return DocumentOut.model_validate(
        service.update_document(org_id=uuid.UUID(user.org_id), document_id=document_id, payload=payload)
    )


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: uuid.UUID,
    user: CurrentUser = Depends(require_document_delete),
    service: DocumentService = Depends(get_document_service),
) -> None:
    service.delete_document(org_id=uuid.UUID(user.org_id), document_id=document_id)
