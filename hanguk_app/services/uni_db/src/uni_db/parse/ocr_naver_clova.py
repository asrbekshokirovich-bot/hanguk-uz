"""Naver Clova OCR adapter — STUB in Phase 0.

Plan §F.2 layer 3 / §J cost line. Real implementation in Phase 2+.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from ..config import settings

log = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class OcrResult:
    text: str
    pages: int
    cost_usd_estimate: float


def ocr_pdf_bytes(pdf_bytes: bytes) -> OcrResult:
    """Phase 0 stub.

    When `settings.live_apis` is False (the default), returns a stub result
    so callers can run the pipeline end-to-end without paying for OCR.
    Phase 2 replaces the body with actual Clova SDK calls.
    """
    if not settings.live_apis:
        log.info("Naver Clova OCR is stubbed (UNI_DB_LIVE_APIS=false).")
        return OcrResult(
            text="<naver-clova-ocr stubbed in Phase 0 — no text extracted>",
            pages=0,
            cost_usd_estimate=0.0,
        )

    if not (settings.naver_clova_ocr_invoke_url and settings.naver_clova_ocr_secret_key):
        raise RuntimeError(
            "Naver Clova OCR credentials missing; set NAVER_CLOVA_OCR_* in .env."
        )

    # Real implementation — invoke Naver Clova OCR. Intentionally not
    # written in Phase 0 because we have no fixture to validate against
    # and no key to test with.
    raise NotImplementedError(
        "Naver Clova OCR live call site not implemented in Phase 0; see plan §F.2."
    )
