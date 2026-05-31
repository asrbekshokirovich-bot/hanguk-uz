"""Robust table extraction.

Plan §F.2 layer 2:
  primary   = pdfplumber.extract_tables (handles lattice + ruled tables)
  fallback  = PyMuPDF page.find_tables() (when pdfplumber returns nothing)

Phase 1 also adds:
  * merged-cell flattening (cell value carries to the right when adjacent
    cell is empty AND the previous row had a value at that column),
  * rotated-table normalisation (transpose when the *header* lives in
    column 0 instead of row 0),
  * multi-page span stitching (when consecutive pages have a table whose
    column count matches and the second page's first row is missing
    a header signature, append it to the prior table).

The OCR fallback (Naver Clova) stays gated behind settings.live_apis and
returns the existing stub when off.
"""

from __future__ import annotations

import io
import logging
from dataclasses import dataclass
from typing import Sequence

log = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class TableExtraction:
    rows: list[list[str]]
    page_index: int                 # 0-based source page
    extractor: str                  # 'pdfplumber' | 'pymupdf' | 'stitched'


# ---------------------------------------------------------------------------
# Pure functions — operate on already-extracted rows (kept separate from the
# PDF-IO layer so unit tests don't need PyMuPDF).
# ---------------------------------------------------------------------------


def flatten_merged_cells(rows: Sequence[Sequence[str]]) -> list[list[str]]:
    """Carry merged-cell values to the right.

    Korean tuition tables often render '인문계열' once and leave the next
    columns blank for that band of rows. pdfplumber emits empty strings for
    those cells. We forward-fill from the previous row at the same column
    only when the current row's leading cells are all-empty.
    """
    if not rows:
        return []
    out: list[list[str]] = []
    prev_row: list[str] | None = None
    for raw in rows:
        row = [(c or "").strip() for c in raw]
        if prev_row is not None:
            # Forward-fill ONLY when the leading cell is empty and there's
            # a non-empty cell later in the row (otherwise it's a true
            # blank row).
            if not row[0] and any(row):
                for i in range(len(row)):
                    if not row[i] and i < len(prev_row) and prev_row[i]:
                        row[i] = prev_row[i]
                    else:
                        # Stop forward-filling at the first real value.
                        if row[i]:
                            break
        out.append(row)
        prev_row = row
    return out


def transpose_if_rotated(rows: Sequence[Sequence[str]]) -> list[list[str]]:
    """Detect a rotated layout and transpose.

    Heuristic: a typical Korean admissions table has its header in row 0
    (e.g. ['단과대학', '학과', '모집인원']). When column 0 carries MORE
    header tokens than row 0, the table is rotated and we transpose.

    `_HEADER_TOKENS` is a small list of common header strings — adding
    more is cheap and improves recall.
    """
    if not rows or not rows[0]:
        return [list(r) for r in rows]
    width = max(len(r) for r in rows)
    norm = [list(r) + [""] * (width - len(r)) for r in rows]

    row0_score = _header_score(norm[0])
    col0_score = _header_score([r[0] for r in norm])

    if col0_score > row0_score:
        return [list(c) for c in zip(*norm, strict=False)]
    return norm


_HEADER_TOKENS: frozenset[str] = frozenset(
    {
        "단과대학", "학부", "학과", "전공", "모집단위", "모집인원",
        "전형", "모집정원", "정원내", "정원외", "지원자격", "TOPIK",
        "등록금", "입학금", "장학금", "구분", "1학기", "2학기",
        "applicant", "category", "field", "tuition", "amount",
    }
)


def _looks_like_header(values: Sequence[str]) -> bool:
    return _header_score(values) >= 1


def _header_score(values: Sequence[str]) -> int:
    return sum(1 for v in values if (v or "").strip() in _HEADER_TOKENS)


def looks_continuable(table_a: Sequence[Sequence[str]], table_b: Sequence[Sequence[str]]) -> bool:
    """Decide whether `table_b` (next page) extends `table_a` (prior page).

    Returns True when:
      * column counts match,
      * `table_b`'s first row does NOT look like a header.
    """
    if not table_a or not table_b:
        return False
    if len(table_a[0]) != len(table_b[0]):
        return False
    return not _looks_like_header(list(table_b[0]))


def stitch_spans(per_page_tables: Sequence[Sequence[Sequence[Sequence[str]]]]) -> list[list[list[str]]]:
    """Walk pages and merge tables that span page breaks.

    `per_page_tables[page_index][table_index][row_index][col_index]` →
    flat list of stitched tables.
    """
    out: list[list[list[str]]] = []
    pending: list[list[str]] | None = None
    for page in per_page_tables:
        for table in page:
            normalised = [list(r) for r in table]
            if pending is not None and looks_continuable(pending, normalised):
                pending.extend(normalised)
                continue
            if pending is not None:
                out.append(pending)
            pending = normalised
    if pending is not None:
        out.append(pending)
    return out


# ---------------------------------------------------------------------------
# IO layer — pdfplumber + PyMuPDF wrappers. Lazy imports so unit tests can
# load this module without those packages.
# ---------------------------------------------------------------------------


def extract_tables(pdf_bytes: bytes) -> list[TableExtraction]:
    """Top-level entry point used by the parse worker.

    Order of attempts:
      1. pdfplumber.extract_tables (lattice + stream by default)
      2. PyMuPDF page.find_tables() if (1) returned 0 tables
    """
    try:
        from_plumber = _extract_with_pdfplumber(pdf_bytes)
        if from_plumber:
            return from_plumber
    except Exception as exc:  # pragma: no cover — guarded for ops
        log.warning("pdfplumber extraction failed: %s", exc)

    try:
        return _extract_with_pymupdf(pdf_bytes)
    except Exception as exc:  # pragma: no cover
        log.warning("pymupdf table extraction failed: %s", exc)
        return []


def _extract_with_pdfplumber(pdf_bytes: bytes) -> list[TableExtraction]:
    import pdfplumber

    out: list[TableExtraction] = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page_index, page in enumerate(pdf.pages):
            for table in page.extract_tables() or []:
                rows = [[(cell or "").strip() for cell in row] for row in table]
                normalized = flatten_merged_cells(transpose_if_rotated(rows))
                out.append(
                    TableExtraction(
                        rows=normalized,
                        page_index=page_index,
                        extractor="pdfplumber",
                    )
                )
    return out


def _extract_with_pymupdf(pdf_bytes: bytes) -> list[TableExtraction]:
    import pymupdf

    out: list[TableExtraction] = []
    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    try:
        for page_index, page in enumerate(doc):
            try:
                tables = page.find_tables()
            except Exception:  # pragma: no cover — older PyMuPDF
                continue
            for table in tables:
                rows = [
                    [(cell or "").strip() if isinstance(cell, str) else "" for cell in row]
                    for row in table.extract()
                ]
                normalized = flatten_merged_cells(transpose_if_rotated(rows))
                out.append(
                    TableExtraction(
                        rows=normalized,
                        page_index=page_index,
                        extractor="pymupdf",
                    )
                )
    finally:
        doc.close()
    return out
