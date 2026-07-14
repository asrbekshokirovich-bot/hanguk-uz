"""EasyOCR adapter — Phase 2 layer-3 OCR.

Per ADR-002, this replaces the Phase 0 Naver Clova stub for image-only
Korean PDFs. EasyOCR is open-source (Apache 2.0), runs Korean+English
recognition on CPU or GPU, and downloads its model weights (~80 MB
combined for `ko` + `en`) to a local cache on first use.

Why EasyOCR over Clova:
  * ~85% Korean tabular accuracy vs Clova's ~97% — gap absorbed by the
    in-office HITL reviewer (ADR-005).
  * Free vs $80/mo at scale.
  * No data leaves the host machine — better PIPA story (ADR-010).

Trade-offs that callers should know:
  * First call is slow (5–15 s on CPU while loading models). Subsequent
    calls reuse the in-process Reader.
  * CPU-only inference: ~2–4 s per scanned page. GPU available if the
    host has CUDA + torch with CUDA support.
  * Tabular layout reconstruction is brittle compared to Clova; for
    tuition/scholarship tables EasyOCR returns line text and the
    downstream archetype dispatcher must reassemble structure.

Phase 2 status:
  * Module callable in fixture mode (no model load) when the live OCR
    flag is off — returns the same stub shape as the Naver Clova
    counterpart so the orchestrator can swap providers transparently.
  * Live model load is gated behind `settings.live_apis` to keep
    `pip install -e .[dev]` lightweight (the model download happens on
    first real call, not at import time).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from functools import lru_cache
from typing import Any

from ..config import settings

log = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class OcrResult:
    """Mirror of `parse.ocr_naver_clova.OcrResult` so swap is invisible."""

    text: str
    pages: int
    cost_usd_estimate: float
    extractor: str = "easyocr"


# Languages: Korean + English. Audit §5.1 notes most Korean admissions
# guidelines mix these. `ja` / `zh-cn` could be added later for some
# bilingual archetypes but cost little until then.
DEFAULT_LANGUAGES: tuple[str, ...] = ("ko", "en")


@lru_cache(maxsize=1)
def _get_reader(languages: tuple[str, ...] = DEFAULT_LANGUAGES) -> Any:
    """Lazy-load and cache the EasyOCR Reader.

    Cached so subsequent calls in the same process reuse the loaded
    weights (~80 MB resident). The cache key includes the languages
    tuple so multilingual variants don't share state.
    """
    try:
        import easyocr  # type: ignore[import-not-found]
    except ImportError as exc:  # pragma: no cover — handled at call site
        raise RuntimeError(
            "easyocr is not installed. Add `easyocr` to the heavy extras "
            "in services/uni_db/pyproject.toml and re-install."
        ) from exc

    log.info("loading EasyOCR reader for languages=%s (one-time)", languages)
    # gpu=False for CPU portability; flip via env if/when we have a GPU host.
    return easyocr.Reader(list(languages), gpu=False, verbose=False)


def ocr_pdf_bytes(pdf_bytes: bytes) -> OcrResult:
    """Run EasyOCR over every page of `pdf_bytes`.

    Phase 2 contract — same shape as the Naver Clova adapter so the
    parse worker doesn't care which provider answered:

      * `settings.live_apis=false` (default in tests / Phase 0+1) →
        deterministic stub, model is not loaded.
      * `settings.live_apis=true` → render PDF pages to images via
        PyMuPDF, run EasyOCR on each image, concatenate text.
    """
    if not settings.live_apis:
        log.info("EasyOCR is stubbed (UNI_DB_LIVE_APIS=false).")
        return OcrResult(
            text="<easyocr stubbed in mock mode — no text extracted>",
            pages=0,
            cost_usd_estimate=0.0,
        )

    return _ocr_pdf_bytes_live(pdf_bytes)


def ocr_image_bytes(image_bytes: bytes) -> OcrResult:
    """Run EasyOCR over ONE raw image payload (PNG/JPEG/… — Phase 4).

    Some boards serve the guideline as a page screenshot; the fetch stage
    stores those bytes as-is and the orchestrator routes them here — no PDF
    rasterisation step, the image goes straight to the reader. Same
    live/stub gating as `ocr_pdf_bytes`.
    """
    if not settings.live_apis:
        log.info("EasyOCR is stubbed (UNI_DB_LIVE_APIS=false).")
        return OcrResult(
            text="<easyocr stubbed in mock mode — no text extracted>",
            pages=1,
            cost_usd_estimate=0.0,
            extractor="easyocr-image",
        )
    return _ocr_image_bytes_live(image_bytes)


def _ocr_image_bytes_live(image_bytes: bytes) -> OcrResult:
    reader = _get_reader()
    results = reader.readtext(
        image_bytes,
        detail=0,            # text strings only, no bounding boxes
        paragraph=True,      # group text by paragraph
    )
    return OcrResult(
        text="\n".join(results),
        pages=1,
        cost_usd_estimate=0.0,
        extractor="easyocr-image",
    )


def _ocr_pdf_bytes_live(pdf_bytes: bytes) -> OcrResult:
    """Real OCR path. Kept separate so unit tests can monkey-patch it
    without flipping the live flag."""
    try:
        import pymupdf  # type: ignore[import-not-found]
    except ImportError as exc:  # pragma: no cover
        raise RuntimeError("pymupdf required for OCR rasterisation") from exc

    reader = _get_reader()

    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    text_chunks: list[str] = []
    page_count = 0
    try:
        for page in doc:
            page_count += 1
            # 200 DPI is plenty for OCR; balances quality vs time.
            pix = page.get_pixmap(dpi=200)
            png_bytes = pix.tobytes("png")
            results = reader.readtext(
                png_bytes,
                detail=0,           # text strings only, no bounding boxes
                paragraph=True,     # group text by paragraph
            )
            text_chunks.append("\n".join(results))
    finally:
        doc.close()

    full_text = "\n\f\n".join(text_chunks)  # form-feed marks page breaks
    return OcrResult(
        text=full_text,
        pages=page_count,
        cost_usd_estimate=0.0,    # EasyOCR is free; only electricity
    )


# ---------------------------------------------------------------------------
# Provider-swap shim: parse worker calls `run_ocr(pdf_bytes)` and we
# pick the configured provider. ADR-002 default is EasyOCR; flipping
# `settings.ocr_provider = 'naver_clova'` (Phase 3+ if reversal trigger
# fires) restores the Phase 0 stub.
# ---------------------------------------------------------------------------


def run_ocr(pdf_bytes: bytes) -> OcrResult:
    """Provider-aware OCR entry point used by the parse worker."""
    provider = getattr(settings, "ocr_provider", "easyocr")
    if provider == "naver_clova":
        from .ocr_naver_clova import ocr_pdf_bytes as clova_ocr

        clova_result = clova_ocr(pdf_bytes)
        return OcrResult(
            text=clova_result.text,
            pages=clova_result.pages,
            cost_usd_estimate=clova_result.cost_usd_estimate,
            extractor="naver_clova",
        )
    return ocr_pdf_bytes(pdf_bytes)
