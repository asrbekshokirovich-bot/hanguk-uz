#!/usr/bin/env python3
"""Convert the non-PDF guideline blobs (HWP, DOC, images…) to PDF for Hanguk AI.

2026-11-04, Asrbek: "HWP'ni PDF qilib o'zgartir". guideline-index reads PDFs
only, so 12 stored guidelines (HWP / unknown CMS downloads / one PNG) were never
indexed. For each document id this script:

  1. downloads the blob from Storage (guideline-blobs, service key),
  2. sniffs the real format from magic bytes (uni_db.parse.format_convert),
  3. converts: PDF as is · image → PDF (Pillow) · everything else →
     CloudConvert (uni_db.parse.convert_remote, format detected by the
     service), falling back to LibreOffice headless,
  4. uploads guideline-blobs/converted/<id>.pdf and upserts
     public.guideline_converted — guideline_documents is left untouched
     (uni_db owns it); the index queues pick the converted PDF up from there.

DRY_RUN=1 only downloads and prints the sniffed format of each blob.
Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CLOUDCONVERT_API_KEY (optional),
IDS (comma-separated guideline_documents ids), DRY_RUN.
"""
from __future__ import annotations

import hashlib
import io
import os
import subprocess
import sys
import tempfile
from pathlib import Path

import httpx

from uni_db.parse import convert_remote
from uni_db.parse.format_convert import IMAGE_FORMATS, sniff_format

URL = os.environ["SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
IDS = [i.strip() for i in os.environ.get("IDS", "").split(",") if i.strip()]
DRY = os.environ.get("DRY_RUN", "") in ("1", "true", "yes")
BUCKET = "guideline-blobs"
H = {"Authorization": f"Bearer {KEY}", "apikey": KEY}


def image_to_pdf(data: bytes) -> bytes:
    from PIL import Image
    img = Image.open(io.BytesIO(data)).convert("RGB")
    out = io.BytesIO()
    img.save(out, "PDF", resolution=150.0)
    return out.getvalue()


def libreoffice_to_pdf(data: bytes, ext: str) -> bytes:
    with tempfile.TemporaryDirectory() as d:
        src = Path(d) / f"in.{ext}"
        src.write_bytes(data)
        subprocess.run(["soffice", "--headless", "--convert-to", "pdf", "--outdir", d, str(src)],
                       check=True, capture_output=True, timeout=180)
        pdf = Path(d) / "in.pdf"
        if not pdf.exists() or pdf.stat().st_size < 200:
            raise RuntimeError("libreoffice produced no pdf")
        return pdf.read_bytes()


def convert(data: bytes, fmt: str) -> tuple[bytes, str]:
    if fmt == "pdf":
        return data, "as-is"
    if fmt in IMAGE_FORMATS:
        return image_to_pdf(data), "pillow"
    errors = []
    if convert_remote.is_configured() and fmt != "hwpx":
        try:
            r = convert_remote.convert_to_pdf(data, input_format="hwp" if fmt == "hwp" else None,
                                              filename=f"document.{ 'hwp' if fmt == 'hwp' else 'bin'}")
            return r.pdf_bytes, f"cloudconvert ({r.detected_format or fmt})"
        except convert_remote.RemoteConversionError as e:
            errors.append(str(e)[:200])
    try:
        return libreoffice_to_pdf(data, {"hwp": "hwp", "hwpx": "hwpx", "zip": "docx"}.get(fmt, "doc")), "libreoffice"
    except Exception as e:  # noqa: BLE001
        errors.append(f"libreoffice: {e}"[:200])
    raise RuntimeError("; ".join(errors))


def main() -> int:
    if not IDS:
        print("IDS is empty")
        return 2
    with httpx.Client(timeout=120, headers=H) as c:
        r = c.get(f"{URL}/rest/v1/guideline_documents",
                  params={"select": "id,storage_path,mime_type", "id": f"in.({','.join(IDS)})"})
        r.raise_for_status()
        docs = r.json()
        ok = failed = 0
        for doc in docs:
            did, path = doc["id"], doc["storage_path"]
            blob = c.get(f"{URL}/storage/v1/object/{BUCKET}/{path}")
            if blob.status_code != 200:
                print(f"FAIL {did} download {blob.status_code}")
                failed += 1
                continue
            data = blob.content
            fmt = sniff_format(data)
            head = data[:8].hex()
            if DRY:
                print(f"DRY  {did} {len(data):>9} B  sniffed={fmt:<8} head={head} mime={doc['mime_type']}")
                continue
            try:
                pdf, how = convert(data, fmt)
            except Exception as e:  # noqa: BLE001
                print(f"FAIL {did} {fmt}: {e}")
                failed += 1
                continue
            if b"%PDF-" not in pdf[:1024]:
                print(f"FAIL {did} {fmt}: converter output is not a PDF")
                failed += 1
                continue
            sha = hashlib.sha256(pdf).hexdigest()
            dest = f"converted/{did}.pdf"
            up = c.post(f"{URL}/storage/v1/object/{BUCKET}/{dest}", content=pdf,
                        headers={**H, "Content-Type": "application/pdf", "x-upsert": "true"})
            if up.status_code >= 300:
                print(f"FAIL {did} upload {up.status_code} {up.text[:200]}")
                failed += 1
                continue
            row = {"document_id": did, "pdf_path": dest, "pdf_sha256": sha, "source_format": fmt, "converter": how}
            ins = c.post(f"{URL}/rest/v1/guideline_converted", json=row,
                         headers={**H, "Prefer": "resolution=merge-duplicates,return=minimal"})
            if ins.status_code >= 300:
                print(f"FAIL {did} register {ins.status_code} {ins.text[:200]}")
                failed += 1
                continue
            print(f"OK   {did} {fmt} → {dest} ({len(pdf)} B, {how})")
            ok += 1
        print(f"\n{len(docs)} documents, converted {ok}, failed {failed}{' (dry run)' if DRY else ''}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
