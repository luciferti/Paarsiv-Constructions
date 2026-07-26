from app.core.errors import NotFoundError


class DocumentError(Exception):
    """Base exception for the document module."""


class DocumentNotFoundError(DocumentError, NotFoundError):
    def __init__(self, document_id: object):
        super().__init__(f"Document {document_id} not found")
