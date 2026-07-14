"""Backfill guideline_documents.academic_year / semester (correction plan 1d).

Reads every stored guideline blob, extracts the first 3 pages of text with
PyMuPDF, classifies the admission cycle with the shared detector
(`uni_db.parse.cycle_detect.detect_cycle` — the same rules the identity gate
and the verify lane use), and fills the two new columns added by migration
20260714000000. Rows that already carry an academic_year are skipped unless
--force; blobs that aren't readable PDFs (HWP/PNG/broken) are left NULL and
reported.

Usage (from services/uni_db, with SUPABASE_DB_URL + storage env set):

    python scripts/backfill_document_cycle.py            # dry-run (default)
    python scripts/backfill_document_cycle.py --apply    # write the columns
    python scripts/backfill_document_cycle.py --apply --force

Dry-run prints the classification per document and writes NOTHING.
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

import asyncpg  # noqa: E402

from uni_db.parse.cycle_detect import detect_cycle  # noqa: E402
from uni_db.storage.supabase_storage import fetch_blob  # noqa: E402


def _first_pages_text(data: bytes, *, max_pages: int = 3, max_chars: int = 20000) -> str:
    try:
        import pymupdf
    except ImportError:
        import fitz as pymupdf  # older package name
    try:
        doc = pymupdf.open(stream=data, filetype="pdf")
    except Exception:
        return ""
    try:
        parts: list[str] = []
        for i, page in enumerate(doc):
            if i >= max_pages:
                break
            parts.append(page.get_text())
        return "\n".join(parts)[:max_chars]
    finally:
        doc.close()


async def run(*, apply: bool, force: bool) -> int:
    dsn = os.environ.get("SUPABASE_DB_URL")
    if not dsn:
        print("SUPABASE_DB_URL is not set", file=sys.stderr)
        return 2

    conn = await asyncpg.connect(dsn)
    try:
        where = "" if force else "where academic_year is null"
        rows = await conn.fetch(
            f"select id, storage_path, parse_status from public.guideline_documents {where} "
            "order by fetched_at"
        )
        print(f"# {len(rows)} document(s) to classify (apply={apply}, force={force})")
        updated = unreadable = 0
        for row in rows:
            try:
                blob = fetch_blob(row["storage_path"])
            except Exception as exc:
                print(f"{row['id']}  DOWNLOAD-ERROR  {type(exc).__name__}: {exc}")
                unreadable += 1
                continue
            text = _first_pages_text(blob)
            if not text.strip():
                print(f"{row['id']}  UNREADABLE  (no first-pages text; format?)")
                unreadable += 1
                continue
            cycle = detect_cycle(text)
            term = cycle.semester or ("both" if cycle.covers_both_terms else "-")
            print(f"{row['id']}  year={cycle.academic_year or '-'}  term={term}")
            if apply and cycle.academic_year is not None:
                await conn.execute(
                    """
                    update public.guideline_documents
                       set academic_year = $2,
                           semester = $3
                     where id = $1
                    """,
                    row["id"],
                    cycle.academic_year,
                    cycle.semester,  # NULL for full-year / unknown-term docs
                )
                updated += 1
        print(f"# done: updated={updated if apply else 0} "
              f"(classified {updated}) unreadable={unreadable}")
        return 0
    finally:
        await conn.close()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--apply", action="store_true",
                    help="write the columns (default: dry-run, print only)")
    ap.add_argument("--force", action="store_true",
                    help="re-classify rows that already have academic_year")
    args = ap.parse_args()
    return asyncio.run(run(apply=args.apply, force=args.force))


if __name__ == "__main__":
    raise SystemExit(main())
