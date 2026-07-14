"""Phase 4 format handling: magic-byte sniffing, HWP conversion fallbacks,
and the orchestrator's HWP / image routing."""

from __future__ import annotations

import subprocess
from typing import Any

import pytest

from uni_db.parse import format_convert
from uni_db.parse.extract_orchestrator import extract
from uni_db.parse.format_convert import extract_hwp, sniff_format

_OLE = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"


# ASCII body text: PyMuPDF's built-in base-14 fonts don't cover Hangul, so a
# Korean insert_text would render (and extract) as garbage in this fixture.
def _pdf_bytes(text: str = "Admissions Guide 2027 " * 40) -> bytes:
    import pymupdf

    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_text((72, 72), text)
    data = doc.tobytes()
    doc.close()
    return data


class TestSniffFormat:
    def test_pdf_magic(self) -> None:
        assert sniff_format(b"%PDF-1.7 rest") == "pdf"

    def test_pdf_magic_after_junk_preamble(self) -> None:
        assert sniff_format(b"\r\n junk \r\n%PDF-1.4" + b"x" * 100) == "pdf"

    def test_ole_is_hwp(self) -> None:
        assert sniff_format(_OLE + b"\x00" * 100) == "hwp"

    def test_hwpx_zip(self) -> None:
        assert sniff_format(b"PK\x03\x04" + b"mimetypeapplication/hwp+zip") == "hwpx"

    def test_plain_zip(self) -> None:
        assert sniff_format(b"PK\x03\x04" + b"\x00" * 64) == "zip"

    def test_images(self) -> None:
        assert sniff_format(b"\x89PNG\r\n\x1a\n" + b"x") == "png"
        assert sniff_format(b"\xff\xd8\xff\xe0" + b"x") == "jpeg"
        assert sniff_format(b"GIF89a" + b"x") == "gif"

    def test_unknown(self) -> None:
        assert sniff_format(b"<html><body>alert!</body></html>") == "unknown"


class TestExtractHwp:
    def test_hwp5txt_success(self, monkeypatch: pytest.MonkeyPatch) -> None:
        def fake_run(cmd: list[str], **kw: Any) -> subprocess.CompletedProcess:
            assert cmd[0] == "hwp5txt"
            return subprocess.CompletedProcess(
                cmd, 0, stdout="2027학년도 외국인 특별전형 모집요강\f등록금 안내".encode(),
                stderr=b"",
            )

        monkeypatch.setattr(format_convert, "_run", fake_run)
        out = extract_hwp(_OLE + b"\x00" * 32)
        assert out.extractor == "hwp5txt"
        assert "모집요강" in out.text
        assert out.page_count == 2
        assert out.has_text_layer

    def test_falls_back_to_libreoffice_when_hwp5txt_missing(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        pdf = _pdf_bytes()

        def fake_run(cmd: list[str], **kw: Any) -> subprocess.CompletedProcess:
            if cmd[0] == "hwp5txt":
                raise FileNotFoundError("hwp5txt")
            assert cmd[0] in ("soffice", "libreoffice")
            outdir = cmd[cmd.index("--outdir") + 1]
            src = cmd[-1]
            from pathlib import Path

            stem = Path(src).stem
            (Path(outdir) / f"{stem}.pdf").write_bytes(pdf)
            return subprocess.CompletedProcess(cmd, 0, stdout=b"", stderr=b"")

        monkeypatch.setattr(format_convert, "_run", fake_run)
        out = extract_hwp(_OLE + b"\x00" * 32)
        assert out.extractor == "libreoffice+pymupdf"
        assert "Admissions Guide" in out.text

    def test_raises_naming_both_failures(self, monkeypatch: pytest.MonkeyPatch) -> None:
        def fake_run(cmd: list[str], **kw: Any) -> subprocess.CompletedProcess:
            raise FileNotFoundError(cmd[0])

        monkeypatch.setattr(format_convert, "_run", fake_run)
        with pytest.raises(RuntimeError) as excinfo:
            extract_hwp(_OLE)
        assert "hwp5txt" in str(excinfo.value)
        assert "LibreOffice" in str(excinfo.value)


class TestOrchestratorRouting:
    def test_hwp_payload_routes_to_converter(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        def fake_run(cmd: list[str], **kw: Any) -> subprocess.CompletedProcess:
            return subprocess.CompletedProcess(
                cmd, 0, stdout="변환된 한글 본문".encode(), stderr=b"")

        monkeypatch.setattr(format_convert, "_run", fake_run)
        extracted, decision = extract(_OLE + b"\x00" * 32)
        assert decision.tier == "hwp_convert"
        assert extracted.extractor == "hwp5txt"
        assert "변환된" in extracted.text

    def test_image_payload_routes_to_easyocr_lane(self) -> None:
        # live_apis is off in tests → the EasyOCR stub answers; the routing
        # (image → OCR lane, no PDF parse attempt) is what's under test.
        extracted, decision = extract(b"\x89PNG\r\n\x1a\n" + b"\x00" * 64)
        assert decision.tier == "image_ocr"
        assert extracted.extractor == "easyocr-image"
        assert extracted.page_count == 1

    def test_pdf_payload_keeps_the_pymupdf_path(self) -> None:
        extracted, decision = extract(_pdf_bytes())
        assert decision.tier == "pymupdf"
        assert extracted.extractor == "pymupdf"
        assert "Admissions Guide" in extracted.text
