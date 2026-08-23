"""PDF text-extraction tier.

Plan §F.2:
  1. PyMuPDF — text layer detection + extraction
  2. pdfplumber — tables (lattice/stream)
  3. Naver Clova OCR — image-only PDFs (Phase 1+, paid; gated)
  4. Layout refinement — Phase 3+

Phase 0: layers 1 + 2 only. PyMuPDF and pdfplumber are pure-Python and
fixture-friendly. The OCR tier is implemented as a stub returning the
text it would have produced, so the pipeline runs end-to-end against
fixtures without a Naver Cloud key.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path

log = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class ExtractedPdf:
    text: str
    page_count: int
    has_text_layer: bool
    extractor: str       # "pymupdf" | "pdfplumber" | "naver-clova-stub"

    #: Per-page text, in page order. Defaults to empty so every existing
    #: construction site (OCR adapters, HWP converter, the remote-conversion
    #: lane) keeps working unchanged — only `extract_text_pymupdf` fills it.
    #:
    #: The orchestrator needs it because a document-wide chars/page average
    #: hides the case this exists for: 동국대's 49-page guideline averages 437
    #: chars/page — comfortably above the scanned-page threshold — while 13 of
    #: its pages carry under 80 characters each. Those are its tables, drawn as
    #: vectors, and the average of the readable heading pages buries them.
    pages: tuple[str, ...] = ()


def extract_text_pymupdf(pdf_bytes: bytes) -> ExtractedPdf:
    """Layer 1 — PyMuPDF.

    Returns the full extracted text plus a flag indicating whether the
    PDF carried a text layer. If no text layer, callers should fall
    back to OCR (layer 3).
    """
    try:
        import pymupdf  # type: ignore[import-not-found]
    except ImportError as exc:  # pragma: no cover — handled at runtime
        raise RuntimeError(
            "pymupdf is not installed; run `pip install -e .[dev]` "
            "or `make install` in services/uni_db/."
        ) from exc

    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    try:
        page_count = doc.page_count
        text_chunks: list[str] = []
        has_text_layer = False
        for page in doc:
            text = page.get_text("text") or ""
            if text.strip():
                has_text_layer = True
            text_chunks.append(text)
        full_text = "\n".join(text_chunks)
        return ExtractedPdf(
            text=full_text,
            page_count=page_count,
            has_text_layer=has_text_layer,
            extractor="pymupdf",
            pages=tuple(text_chunks),
        )
    finally:
        doc.close()


def extract_text_from_path(path: Path) -> ExtractedPdf:
    return extract_text_pymupdf(path.read_bytes())


def extract_tables_pdfplumber(pdf_bytes: bytes) -> list[list[list[str]]]:
    """Layer 2 — pdfplumber.

    Returns a list of pages; each page is a list of tables; each table is
    a list of rows (list[str]). Empty when nothing parseable.
    """
    try:
        import pdfplumber  # type: ignore[import-not-found]
    except ImportError as exc:  # pragma: no cover
        raise RuntimeError("pdfplumber is not installed") from exc

    import io

    pages: list[list[list[str]]] = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            page_tables: list[list[list[str]]] = []
            for table in page.extract_tables() or []:
                page_tables.append(
                    [[(cell or "").strip() for cell in row] for row in table]
                )
            pages.append(page_tables)
    return pages
