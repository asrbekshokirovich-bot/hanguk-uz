"""Orchestrator decision-tree tests — no real PDFs, no real OCR.

Each test stubs `extract_text_pymupdf` and (where relevant) the OCR
runner so the decision logic can be inspected in isolation.
"""

from __future__ import annotations

import pytest

from uni_db.parse import extract_orchestrator
from uni_db.parse.pdf_text import ExtractedPdf


def _stub_pymupdf(text: str, page_count: int, has_text_layer: bool):
    return ExtractedPdf(
        text=text,
        page_count=page_count,
        has_text_layer=has_text_layer,
        extractor="pymupdf",
    )


class TestDecideTextLayerOnly:
    def test_dense_text_layer_picks_pymupdf(self) -> None:
        pdf = _stub_pymupdf("a" * 5000, page_count=5, has_text_layer=True)
        decision = extract_orchestrator._decide(pdf)
        assert decision.tier == "pymupdf"
        assert decision.pages_with_text_layer == 5
        assert decision.chars_per_page_avg == 1000

    def test_no_text_layer_routes_to_ocr(self) -> None:
        pdf = _stub_pymupdf("", page_count=10, has_text_layer=False)
        decision = extract_orchestrator._decide(pdf)
        assert decision.tier == "ocr_fallback"
        assert decision.pages_below_threshold == 10
        assert "no text layer" in decision.reason

    def test_low_density_routes_to_ocr(self) -> None:
        # 50 pages × 30 chars = 1500 chars total, well below threshold
        pdf = _stub_pymupdf("a" * 1500, page_count=50, has_text_layer=True)
        decision = extract_orchestrator._decide(pdf)
        assert decision.tier == "ocr_fallback"
        assert "below threshold" in decision.reason

    def test_threshold_boundary_passes_when_at_or_above(self) -> None:
        # exactly 80 chars/page = at threshold (>= keeps pymupdf)
        pdf = _stub_pymupdf("a" * 800, page_count=10, has_text_layer=True)
        decision = extract_orchestrator._decide(pdf)
        assert decision.tier == "pymupdf"


class TestExtractOrchestratorEnd2End:
    def test_pymupdf_path_returns_primary_unchanged(self, monkeypatch) -> None:
        primary = _stub_pymupdf("Hanguk uni_db sample text " * 100,
                                page_count=2, has_text_layer=True)
        monkeypatch.setattr(
            extract_orchestrator,
            "extract_text_pymupdf",
            lambda _bytes: primary,
        )
        result, decision = extract_orchestrator.extract(b"%PDF-fake")
        assert result is primary
        assert decision.tier == "pymupdf"

    def test_ocr_path_swaps_in_ocr_result(self, monkeypatch) -> None:
        primary = _stub_pymupdf("", page_count=8, has_text_layer=False)
        monkeypatch.setattr(
            extract_orchestrator,
            "extract_text_pymupdf",
            lambda _bytes: primary,
        )

        # Stub the OCR runner without importing the heavy stack.
        from uni_db.parse import ocr_easyocr

        def fake_run_ocr(pdf_bytes: bytes):
            return ocr_easyocr.OcrResult(
                text="<from-easyocr>",
                pages=8,
                cost_usd_estimate=0.0,
                extractor="easyocr",
            )

        monkeypatch.setattr(ocr_easyocr, "run_ocr", fake_run_ocr)

        result, decision = extract_orchestrator.extract(b"%PDF-fake")
        assert decision.tier == "ocr_fallback"
        assert result.extractor == "easyocr"
        assert result.text == "<from-easyocr>"
        assert result.has_text_layer is False
        assert result.page_count == 8


class TestOrchestratorDecisionImmutability:
    def test_decision_is_frozen_dataclass(self) -> None:
        primary = _stub_pymupdf("x" * 1000, page_count=1, has_text_layer=True)
        decision = extract_orchestrator._decide(primary)
        # Frozen dataclass — direct attribute assignment must raise.
        with pytest.raises((AttributeError, Exception)):
            decision.tier = "should_not_assign"  # type: ignore[misc]


class TestPerPageOcrFill:
    """A document-wide average hides a document whose TABLES are unreadable.

    동국대's 49-page guideline averages 440 chars/page — five times the
    scanned-page threshold, so the whole-document OCR lane never fires. Yet 13
    of its pages hold under 80 characters: its 전형일정 and 제출서류 tables,
    drawn as vectors. The headings extract, the table bodies do not, and three
    dates survive in the entire file. Running the real fix over that PDF took
    the text from 21 555 to 29 720 chars and the dates from 3 to 12.
    """

    def _doc(self, pages: tuple[str, ...]):
        return ExtractedPdf(
            text="\n".join(pages),
            page_count=len(pages),
            has_text_layer=True,
            extractor="pymupdf",
            pages=pages,
        )

    def test_sparse_pages_are_ocred_and_spliced(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        pages = ("full page " * 40, "", "full page " * 40)
        calls: dict[str, object] = {}

        def fake_ocr(pdf_bytes, page_numbers):
            calls["pages"] = list(page_numbers)
            return {1: "전형일정 2027. 1. 21."}

        monkeypatch.setattr(
            "uni_db.parse.ocr_easyocr.ocr_pdf_pages", fake_ocr, raising=False
        )
        result, decision = extract_orchestrator._fill_sparse_pages(
            b"%PDF-", self._doc(pages),
            extract_orchestrator._decide(self._doc(pages)),
        )
        assert calls["pages"] == [1], "only the empty page should be OCRed"
        assert "전형일정 2027. 1. 21." in result.text
        assert result.pages[0] == pages[0], "good pages must be left untouched"
        assert decision.tier == "pymupdf+page_ocr"
        assert result.extractor == "pymupdf+easyocr-pages"

    def test_document_with_no_sparse_page_is_untouched(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        # The common case. It must not pay the OCR cost, and must not even
        # import the heavy stack.
        def explode(*_a, **_k):
            raise AssertionError("OCR must not run when every page has text")

        monkeypatch.setattr(
            "uni_db.parse.ocr_easyocr.ocr_pdf_pages", explode, raising=False
        )
        pages = ("text " * 40, "text " * 40)
        doc = self._doc(pages)
        result, decision = extract_orchestrator._fill_sparse_pages(
            b"%PDF-", doc, extract_orchestrator._decide(doc)
        )
        assert result is doc
        assert decision.tier == "pymupdf"

    def test_ocr_failure_keeps_the_text_layer(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        # A partially-read document is worth more than none, so an OCR error
        # must degrade to what PyMuPDF managed rather than losing the parse.
        def boom(*_a, **_k):
            raise RuntimeError("easyocr is not installed")

        monkeypatch.setattr(
            "uni_db.parse.ocr_easyocr.ocr_pdf_pages", boom, raising=False
        )
        doc = self._doc(("text " * 40, ""))
        result, decision = extract_orchestrator._fill_sparse_pages(
            b"%PDF-", doc, extract_orchestrator._decide(doc)
        )
        assert result is doc
        assert decision.tier == "pymupdf"

    def test_older_extractors_without_per_page_text_are_skipped(self) -> None:
        # HWP conversion, the remote-convert lane and the OCR adapters all
        # build an ExtractedPdf without `pages`. They must pass straight
        # through rather than being treated as one giant sparse page.
        doc = ExtractedPdf(text="x" * 900, page_count=1, has_text_layer=True,
                           extractor="hwp5txt")
        result, decision = extract_orchestrator._fill_sparse_pages(
            b"%PDF-", doc, extract_orchestrator._decide(doc)
        )
        assert result is doc
