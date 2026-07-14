"""Non-PDF guideline payloads: sniff the real format and convert (Phase 4).

The forensic audit found 12 of 83 stored guideline blobs were not PDFs at
all — HWP 5.x (OLE compound) files and board-page screenshots served with a
PDF-ish URL. PyMuPDF's ``open(filetype="pdf")`` then throws and the document
dies with ``parse_status='failed'`` even though the content is perfectly
extractable. This module:

  * ``sniff_format`` — identify the payload from magic bytes (never trust the
    upstream content-type; Korean CMSes routinely lie).
  * ``extract_hwp`` — convert HWP/HWPX to text via the ``hwp5txt`` CLI
    (pyhwp), falling back to LibreOffice headless (``soffice --headless
    --convert-to pdf``) + PyMuPDF when pyhwp is absent or fails.

Image payloads are routed by the orchestrator to the EasyOCR lane
(`ocr_easyocr.ocr_image_bytes`), not here.

Conversion shells out; when neither converter binary exists the error says
exactly what to install. The subprocess runner is module-level so tests can
monkeypatch it.
"""

from __future__ import annotations

import logging
import subprocess
import tempfile
from pathlib import Path

from .pdf_text import ExtractedPdf, extract_text_pymupdf

log = logging.getLogger(__name__)

# Injection seam for tests.
_run = subprocess.run

_CONVERT_TIMEOUT_SEC = 120

# OLE compound-file magic — HWP 5.x containers (audit: every OLE blob in the
# corpus was an HWP; we don't crawl .doc/.xls).
_OLE_MAGIC = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"

IMAGE_FORMATS: frozenset[str] = frozenset({"png", "jpeg", "gif", "bmp", "tiff"})


def sniff_format(data: bytes) -> str:
    """Identify a payload from magic bytes.

    Returns one of ``pdf | hwp | hwpx | png | jpeg | gif | bmp | tiff |
    zip | unknown``. A ``%PDF-`` marker anywhere in the first 1 KiB counts as
    PDF (some CMSes prepend junk bytes).
    """
    head = data[:1024]
    if b"%PDF-" in head:
        return "pdf"
    if head.startswith(_OLE_MAGIC):
        return "hwp"
    if head.startswith(b"PK\x03\x04"):
        # HWPX is a zip whose `mimetype` entry is application/hwp+zip.
        return "hwpx" if b"application/hwp" in data[:4096] else "zip"
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if head.startswith(b"\xff\xd8\xff"):
        return "jpeg"
    if head.startswith((b"GIF87a", b"GIF89a")):
        return "gif"
    if head.startswith(b"BM"):
        return "bmp"
    if head.startswith((b"II*\x00", b"MM\x00*")):
        return "tiff"
    return "unknown"


def _hwp5txt_text(hwp_path: Path) -> str:
    """Text via pyhwp's `hwp5txt` CLI (prints the document text to stdout)."""
    proc = _run(
        ["hwp5txt", str(hwp_path)],
        capture_output=True,
        timeout=_CONVERT_TIMEOUT_SEC,
    )
    if proc.returncode != 0:
        raise RuntimeError(
            f"hwp5txt exited {proc.returncode}: "
            f"{(proc.stderr or b'')[:200].decode('utf-8', 'replace')}"
        )
    return (proc.stdout or b"").decode("utf-8", "replace")


def _libreoffice_pdf(hwp_path: Path, outdir: Path) -> bytes:
    """PDF bytes via LibreOffice headless (`soffice` with `libreoffice` as an
    alias fallback)."""
    last_missing: Exception | None = None
    for binary in ("soffice", "libreoffice"):
        try:
            proc = _run(
                [binary, "--headless", "--convert-to", "pdf",
                 "--outdir", str(outdir), str(hwp_path)],
                capture_output=True,
                timeout=_CONVERT_TIMEOUT_SEC,
            )
        except FileNotFoundError as exc:
            last_missing = exc
            continue
        if proc.returncode != 0:
            raise RuntimeError(
                f"{binary} exited {proc.returncode}: "
                f"{(proc.stderr or b'')[:200].decode('utf-8', 'replace')}"
            )
        pdf_path = outdir / (hwp_path.stem + ".pdf")
        if not pdf_path.exists():
            raise RuntimeError(f"{binary} reported success but produced no PDF")
        return pdf_path.read_bytes()
    raise RuntimeError(
        "LibreOffice not installed (tried `soffice`, `libreoffice`)"
    ) from last_missing


def extract_hwp(data: bytes, *, fmt: str = "hwp") -> ExtractedPdf:
    """Extract text from an HWP/HWPX payload.

    Tries ``hwp5txt`` first (fast, text-only), then LibreOffice headless →
    PDF → PyMuPDF. Raises RuntimeError naming both failures when neither
    converter works, so the parse failure note tells ops what to install
    (``pip install pyhwp`` or ``apt install libreoffice-core``).
    """
    suffix = ".hwpx" if fmt == "hwpx" else ".hwp"
    errors: list[str] = []
    with tempfile.TemporaryDirectory(prefix="uni_db_hwp_") as tmp:
        tmpdir = Path(tmp)
        hwp_path = tmpdir / f"doc{suffix}"
        hwp_path.write_bytes(data)

        try:
            text = _hwp5txt_text(hwp_path)
            if text.strip():
                return ExtractedPdf(
                    text=text,
                    page_count=text.count("\f") + 1,
                    has_text_layer=True,
                    extractor="hwp5txt",
                )
            errors.append("hwp5txt produced no text")
        except FileNotFoundError:
            errors.append("hwp5txt not installed (pip install pyhwp)")
        except Exception as exc:
            errors.append(f"hwp5txt: {exc}")

        try:
            pdf_bytes = _libreoffice_pdf(hwp_path, tmpdir)
            converted = extract_text_pymupdf(pdf_bytes)
            return ExtractedPdf(
                text=converted.text,
                page_count=converted.page_count,
                has_text_layer=converted.has_text_layer,
                extractor="libreoffice+pymupdf",
            )
        except Exception as exc:
            errors.append(f"libreoffice: {exc}")

    raise RuntimeError("HWP conversion failed — " + "; ".join(errors))
