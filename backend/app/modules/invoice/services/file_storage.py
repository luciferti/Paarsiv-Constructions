"""
File storage integration point.

The architecture calls for AWS S3. This environment has no AWS
credentials, so `LocalFileStorage` writes to a local `uploads/`
directory instead — good enough to prove the upload/review flow, not
meant to survive a real deployment (ephemeral disk, no CDN, no
access control beyond the API).

TODO(integration): implement `S3FileStorage(FileStorage)` using
boto3, point `get_file_storage()` at it, and set a real bucket name
via settings. Nothing else in the invoice module depends on how
storage is implemented — only on the `FileStorage` interface.
"""

import uuid
from abc import ABC, abstractmethod
from pathlib import Path

UPLOADS_ROOT = Path(__file__).resolve().parents[4] / "uploads" / "invoices"


class FileStorage(ABC):
    @abstractmethod
    def save(self, file_bytes: bytes, original_filename: str) -> str:
        """Persists the file and returns a path/key that `open_file` can read back."""
        ...


class LocalFileStorage(FileStorage):
    def save(self, file_bytes: bytes, original_filename: str) -> str:
        UPLOADS_ROOT.mkdir(parents=True, exist_ok=True)
        suffix = Path(original_filename).suffix
        stored_name = f"{uuid.uuid4()}{suffix}"
        destination = UPLOADS_ROOT / stored_name
        destination.write_bytes(file_bytes)
        return str(destination.relative_to(UPLOADS_ROOT.parents[1]))


def get_file_storage() -> FileStorage:
    return LocalFileStorage()
