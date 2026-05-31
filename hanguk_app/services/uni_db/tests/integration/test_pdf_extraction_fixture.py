"""PyMuPDF wrapper smoke test — uses a tiny ASCII PDF generated at test
runtime so we don't ship binary fixtures."""

from pathlib import Path

import pytest


def test_pymupdf_extracts_ascii_text(sample_pdf_path: Path) -> None:
    pytest.importorskip("pymupdf")
    from uni_db.parse.pdf_text import extract_text_from_path

    out = extract_text_from_path(sample_pdf_path)
    assert out.has_text_layer is True
    assert out.page_count >= 1
    assert "HANGUK UNI DB" in out.text
