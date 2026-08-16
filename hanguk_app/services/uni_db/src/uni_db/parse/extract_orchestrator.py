"""Top-level PDF text extraction orchestrator.

Plan §F.2 + ADR-002. The orchestrator is the parse worker's single
entry point — it picks the right tier (PyMuPDF / pdfplumber / OCR)
based on signals in the PDF itself, then returns a unified
`ExtractedPdf` to the archetype dispatcher.

Tier 1 — PyMuPDF text-layer extraction (fast, lossless).
Tier 2 — Add pdfplumber tables to the picture for layout-aware joins.
Tier 3 — OCR fallback (EasyOCR per ADR-002) when the page has no text
         layer OR character density is implausibly low (signal of a
         scanned page that PyMuPDF returned partial text from).

The OCR character-density threshold defaults to 80 chars/page —
empirically below that, the page is almost always a scan even if
PyMuPDF returned a few stray glyphs (page numbers, copyright headers).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from . import convert_remote as remote_convert
from .format_convert import IMAGE_FORMATS, extract_hwp, sniff_format
from .pdf_text import ExtractedPdf, extract_text_pymupdf

log = logging.getLogger(__name__)


# Empirical threshold from audit §5.1 (PDF text-density analysis).
# Real Korean admissions PDFs run 600–1200 chars/page on text-layer
# pages; <80 chars/page indicates the text layer is essentially empty
# and the page is a scan that needs OCR.
SCANNED_PAGE_CHAR_THRESHOLD: int = 80


@dataclass(frozen=True, slots=True)
class OrchestratorDecision:
    """Records why a particular tier was chosen — useful for HITL ops
    to debug why a PDF landed in the OCR queue."""

    tier: str                  # 'pymupdf' | 'ocr_fallback' | 'hwp_convert'
    #                            | 'image_ocr' | 'remote_convert'
    reason: str
    pages_with_text_layer: int
    pages_below_threshold: int
    chars_per_page_avg: float


def extract(pdf_bytes: bytes) -> tuple[ExtractedPdf, OrchestratorDecision]:
    """Run the tiered extraction. Returns the best ExtractedPdf the
    pipeline could produce plus a decision record explaining the path.

    Phase 4: the payload's REAL format is sniffed first (the upstream
    content-type routinely lies). HWP/HWPX converts via hwp5txt or
    LibreOffice headless; a raw image payload routes straight to the
    EasyOCR lane. Everything else goes down the PDF tiers.
    """
    fmt = sniff_format(pdf_bytes)

    if fmt in ("hwp", "hwpx"):
        converted = extract_hwp(pdf_bytes, fmt=fmt)
        return converted, OrchestratorDecision(
            tier="hwp_convert",
            reason=f"payload is {fmt.upper()}; converted via {converted.extractor}",
            pages_with_text_layer=converted.page_count,
            pages_below_threshold=0,
            chars_per_page_avg=len(converted.text) / max(converted.page_count, 1),
        )

    if fmt in IMAGE_FORMATS:
        # Board-page screenshot stored as the "guideline" — OCR the image
        # directly (no PDF rasterisation step). Lazy import: easyocr is heavy.
        from .ocr_easyocr import ocr_image_bytes

        ocr_result = ocr_image_bytes(pdf_bytes)
        return (
            ExtractedPdf(
                text=ocr_result.text,
                page_count=max(ocr_result.pages, 1),
                has_text_layer=False,
                extractor=ocr_result.extractor,
            ),
            OrchestratorDecision(
                tier="image_ocr",
                reason=f"payload is a {fmt} image; routed to the EasyOCR lane",
                pages_with_text_layer=0,
                pages_below_threshold=max(ocr_result.pages, 1),
                chars_per_page_avg=float(len(ocr_result.text)),
            ),
        )

    # `zip` belongs here as much as `unknown` does. Korean CMSes routinely
    # serve an attachment as a zip container, and `sniff_format` reports that
    # honestly — but the first cut of this branch matched only `unknown`, so
    # every zipped payload fell straight through to PyMuPDF and threw on byte
    # one, in about a second. Fast, and indistinguishable in the run summary
    # from a conversion that was never attempted.
    if fmt in ("unknown", "zip") and remote_convert.is_configured():
        # Nine of the twelve dead blobs are here: stored under a lying
        # content-type (`application/download`, `application/x-msdownload`)
        # and unidentifiable by magic bytes at our end either. Handing the
        # bytes to a service that detects the format itself is the only way
        # left short of a human opening each one — and it is strictly better
        # than the current outcome, which is PyMuPDF throwing on byte one.
        try:
            remote = remote_convert.convert_to_pdf(pdf_bytes, input_format=None)
        except remote_convert.RemoteConversionError as exc:
            # Fall through to the PDF tiers: the sniffer can be wrong in the
            # other direction too (a PDF with junk prepended past the 1 KiB
            # window), and PyMuPDF's own error is the more useful one then.
            log.info("extract: remote conversion of unknown payload failed: %s", exc)
        else:
            converted = extract_text_pymupdf(remote.pdf_bytes)
            return converted, OrchestratorDecision(
                tier="remote_convert",
                reason=(
                    f"payload format unrecognised locally; {remote.provider} "
                    "detected it and returned a PDF"
                ),
                pages_with_text_layer=converted.page_count,
                pages_below_threshold=0,
                chars_per_page_avg=len(converted.text)
                / max(converted.page_count, 1),
            )

    primary = extract_text_pymupdf(pdf_bytes)
    decision = _decide(primary)

    if decision.tier == "pymupdf":
        return primary, decision

    # OCR fallback. Imported lazily so the heavy easyocr stack only
    # loads when actually needed.
    from .ocr_easyocr import run_ocr

    ocr_result = run_ocr(pdf_bytes)

    # If PyMuPDF returned partial text for *some* pages, prefer its
    # text for those and use OCR only for the missing ones. For Phase
    # 2 we keep the simpler "OCR replaces everything when triggered"
    # path — the fancier per-page merge is Phase 3.
    return (
        ExtractedPdf(
            text=ocr_result.text,
            page_count=ocr_result.pages or primary.page_count,
            has_text_layer=False,
            extractor=ocr_result.extractor,
        ),
        decision,
    )


def _decide(primary: ExtractedPdf) -> OrchestratorDecision:
    page_count = max(primary.page_count, 1)
    chars_total = len(primary.text or "")
    chars_per_page = chars_total / page_count

    if not primary.has_text_layer:
        return OrchestratorDecision(
            tier="ocr_fallback",
            reason="pymupdf reported no text layer on any page",
            pages_with_text_layer=0,
            pages_below_threshold=page_count,
            chars_per_page_avg=chars_per_page,
        )

    if chars_per_page < SCANNED_PAGE_CHAR_THRESHOLD:
        return OrchestratorDecision(
            tier="ocr_fallback",
            reason=(
                f"chars/page={chars_per_page:.0f} below threshold "
                f"{SCANNED_PAGE_CHAR_THRESHOLD}; treating as scanned"
            ),
            pages_with_text_layer=0,
            pages_below_threshold=page_count,
            chars_per_page_avg=chars_per_page,
        )

    return OrchestratorDecision(
        tier="pymupdf",
        reason="text layer present at adequate density",
        pages_with_text_layer=page_count,
        pages_below_threshold=0,
        chars_per_page_avg=chars_per_page,
    )
