"""
OCR integration point.

Real invoice OCR (PaddleOCR per the architecture) requires model
weights that aren't available in this environment. `MockOCRProvider`
below is a demo-only stand-in — it does not read the image at all —
that exists purely so the upload -> extract -> review UI flow can be
built and exercised end-to-end before PaddleOCR is wired in.

TODO(integration): implement `PaddleOCRProvider(OCRProvider)` using
`paddleocr.PaddleOCR` to run real text detection/recognition on the
uploaded file, parse invoice_number/invoice_date/amount out of the
recognized text (regex or a small layout-aware parser), and swap the
return value of `get_ocr_provider()` below. Nothing else in the
invoice module needs to change — routes and the service layer only
depend on the `OCRProvider` interface.
"""

import uuid
from abc import ABC, abstractmethod
from datetime import date
from typing import Optional

from pydantic import BaseModel


class ExtractedInvoiceData(BaseModel):
    invoice_number: Optional[str] = None
    invoice_date: Optional[date] = None
    amount: Optional[float] = None
    raw_text: Optional[str] = None


class OCRProvider(ABC):
    @abstractmethod
    def extract(self, file_bytes: bytes, filename: str) -> ExtractedInvoiceData: ...


class MockOCRProvider(OCRProvider):
    def extract(self, file_bytes: bytes, filename: str) -> ExtractedInvoiceData:
        return ExtractedInvoiceData(
            invoice_number=f"INV-{uuid.uuid4().hex[:6].upper()}",
            invoice_date=date.today(),
            amount=None,
            raw_text=(
                "[Demo OCR] No real text was read from this file. Wire up "
                "PaddleOCRProvider in app/modules/invoice/services/ocr_provider.py "
                "to extract real invoice fields."
            ),
        )


def get_ocr_provider() -> OCRProvider:
    return MockOCRProvider()
