"""Fetch worker — promote discovered announcements into guideline_documents.

The discovery worker writes `announcements`; this stage turns the ones that
carry a real admission PDF into `guideline_documents` the parse worker can
extract. For each unlinked candidate it:

  1. picks the PDF (attachment, or — when the host has a per-source resolver
     — follows the announcement URL to the real download),
  2. downloads + magic-byte/mime-checks it (size-capped),
  3. SHA256s + stores it,
  4. inserts a `guideline_documents` row (parse_status='pending') and links
     the announcement,
  5. runs parse → extract → enqueue via the parse worker.

Extracted from `scripts/run_parse_once.py` so it can be scheduled and unit
tested. Heavy dependencies (PyMuPDF text extraction, Supabase Storage, the
parse worker) are injected (with lazy-importing defaults) so importing this
module — and unit-testing the fetch logic — needs neither PyMuPDF nor boto3.
"""

from __future__ import annotations

import hashlib
import json
import logging
from collections.abc import Awaitable, Callable
from datetime import datetime, timezone
from typing import Any, Protocol
from uuid import UUID, uuid4

import asyncpg
import httpx

from ..config import settings
from ..parse.pdf_resolvers import (
    ResolvedPdf,
    get_resolver_for_url,
    registered_hosts,
    resolve_pdf,
)

log = logging.getLogger(__name__)


# --- pure helpers ----------------------------------------------------------

def pick_pdf_attachment(attachments: list[dict]) -> dict | None:
    """Prefer an attachment whose url/filename ends in .pdf, else the first."""
    for a in attachments:
        url = (a.get("url") or "").lower()
        name = (a.get("filename") or "").lower()
        if url.endswith(".pdf") or name.endswith(".pdf"):
            return a
    return attachments[0] if attachments else None


def decide_mime(data: bytes, raw_mime: str) -> tuple[str | None, str | None]:
    """Return (mime, None) for a usable PDF, or (None, reason) to skip.

    Korean CMS endpoints often serve PDFs as application/download,
    octet-stream, or even text/html; trust the %PDF magic bytes over the
    declared content-type, and reject anything that is neither.
    """
    if data[:4] == b"%PDF":
        return "application/pdf", None
    mime = raw_mime or "application/octet-stream"
    if "html" in mime.lower() or not raw_mime:
        return None, f"attachment served non-PDF (mime={raw_mime!r}, first4={data[:4]!r})"
    return mime, None


def candidate_host_regex() -> str:
    """Postgres regex matching announcement URLs on resolver-backed hosts."""
    hosts = registered_hosts()
    host_pattern = "|".join(h.replace(".", r"\.") for h in hosts)
    return rf"^https?://(?:[^/]+\.)?(?:{host_pattern})/"


# --- injectable heavy steps (defaults lazy-import the real impls) -----------

class _StoreBlob(Protocol):
    def __call__(self, data: bytes, *, sha256: str, mime: str) -> Any: ...


RunParse = Callable[[asyncpg.Connection, UUID, bytes], Awaitable[None]]


def _default_store_blob(data: bytes, *, sha256: str, mime: str) -> Any:
    from ..storage import supabase_storage
    return supabase_storage.store_blob(data, sha256=sha256, mime=mime)


async def _default_run_parse(
    conn: asyncpg.Connection,
    gd_id: UUID,
    data: bytes,
    *,
    only_groups: tuple[str, ...] | None = None,
) -> None:
    """Extract text → parse field groups → persist extraction_jobs/review_queue.

    `only_groups` narrows the extraction to a subset of FIELD_GROUPS. Callers
    reach it through a partial, so the (conn, gd_id, data) shape the worker
    protocols expect is unchanged. Every group is one serialized model call of
    a couple of minutes, so a group nothing renders is not a rounding error —
    `scholarships` alone is a fifth of the wall-clock of a full re-parse.
    """
    from ..parse.extract_orchestrator import extract as extract_pdf
    from .parse_worker import parse_one_document, persist_outcome

    extracted, decision = extract_pdf(data)
    log.info("   pdf: %d pages, tier=%s", extracted.page_count, decision.tier)
    if not extracted.text.strip():
        await conn.execute(
            "update public.guideline_documents set parse_status='failed' where id=$1",
            gd_id,
        )
        raise ValueError("no text extracted from PDF")
    pages = extracted.text.split("\n")
    head = "\n".join(pages[: min(len(pages), 600)])
    outcome = parse_one_document(
        guideline_document_id=gd_id,
        pdf_text_first_pages=head,
        pdf_text_full=extracted.text,
        only_groups=only_groups,
    )
    await persist_outcome(conn, outcome)


# --- DB ops ----------------------------------------------------------------

async def fetch_candidates(conn: asyncpg.Connection, *, limit: int) -> list[asyncpg.Record]:
    """Unlinked announcements with a usable PDF chain (attachment or resolver host)."""
    return await conn.fetch(
        """
        select a.id            as announcement_id,
               a.title_ko,
               a.url_ko,
               a.attachments::text as attachments_json,
               a.classifier_label,
               s.id            as source_id,
               s.institution_id,
               s.url_ko        as source_url_ko
          from public.announcements a
          join public.announcement_sources s on s.id = a.source_id
         where a.guideline_document_id is null
           and (
                 (a.attachments is not null and jsonb_array_length(a.attachments) > 0)
                 or a.url_ko ~* $2
               )
         order by a.posted_at desc
         limit $1
        """,
        limit,
        candidate_host_regex(),
    )


async def insert_guideline_document(
    conn: asyncpg.Connection,
    *,
    institution_id: UUID | None,
    source_url_ko: str,
    storage_path: str,
    sha256: str,
    size_bytes: int,
    mime: str,
    academic_year: int | None = None,
    semester: str | None = None,
) -> UUID:
    """Insert (or refresh) one stored guideline blob.

    `academic_year` / `semester` carry the document's classified admission
    cycle (from the identity gate) when known; existing values are never
    clobbered with NULL on a re-fetch (coalesce in the conflict update).
    """
    if semester not in (None, "spring", "fall"):
        semester = None  # anything else would violate the CHECK constraint
    await conn.execute(
        """
        insert into public.guideline_documents (
          id, institution_id, source_url_ko,
          storage_path, file_hash_sha256, file_size_bytes, mime_type,
          fetched_at, parse_status, parsed_version, language,
          academic_year, semester
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,'pending',0,'ko',$9,$10)
        on conflict (file_hash_sha256) do update
          set fetched_at = excluded.fetched_at,
              academic_year = coalesce(excluded.academic_year,
                                       guideline_documents.academic_year),
              semester = coalesce(excluded.semester, guideline_documents.semester)
        """,
        uuid4(), institution_id, source_url_ko, storage_path,
        sha256, size_bytes, mime, datetime.now(tz=timezone.utc),
        academic_year, semester,
    )
    row = await conn.fetchrow(
        "select id from public.guideline_documents where file_hash_sha256 = $1",
        sha256,
    )
    return row["id"]


async def link_announcement(conn: asyncpg.Connection, announcement_id: UUID, gd_id: UUID) -> None:
    await conn.execute(
        "update public.announcements set guideline_document_id = $2 where id = $1",
        announcement_id, gd_id,
    )


# --- orchestration ---------------------------------------------------------

def _download_url_and_headers(row: asyncpg.Record, resolved: ResolvedPdf | None, fallback: str) -> tuple[str, dict[str, str]]:
    base_headers = {
        "User-Agent": settings.http_user_agent,
        "Referer": row["source_url_ko"],
    }
    if resolved is not None:
        return resolved.url, {**base_headers, **dict(resolved.headers)}
    return fallback, base_headers


async def process_one(
    conn: asyncpg.Connection,
    http: httpx.AsyncClient,
    row: asyncpg.Record,
    *,
    store_blob: _StoreBlob | None = None,
    run_parse: RunParse | None = None,
) -> tuple[bool, str]:
    """Fetch one announcement's PDF → guideline_documents → parse.

    `store_blob` / `run_parse` are injected in tests; production uses the
    lazy-importing defaults.
    """
    store_blob = store_blob or _default_store_blob
    run_parse = run_parse or _default_run_parse

    attachments = json.loads(row["attachments_json"] or "[]")
    pick = pick_pdf_attachment(attachments)
    url = pick.get("url") if pick else None

    # No attachment but the host has a resolver → follow the announcement URL.
    if not url and get_resolver_for_url(row["url_ko"] or "") is not None:
        url = row["url_ko"]
    if not url:
        return False, "no usable attachment"

    resolved = await resolve_pdf(url, http_client=http, referer=row["source_url_ko"])
    download_url, headers = _download_url_and_headers(row, resolved, url)

    resp = await http.get(
        download_url,
        timeout=settings.http_request_timeout_sec,
        headers=headers,
        follow_redirects=True,
    )
    resp.raise_for_status()
    data = resp.content

    raw_mime = (resp.headers.get("content-type") or "").split(";", 1)[0].strip()
    mime, err = decide_mime(data, raw_mime)
    if mime is None:
        return False, err or "non-PDF attachment"

    sha256 = hashlib.sha256(data).hexdigest()
    stored = store_blob(data, sha256=sha256, mime=mime)
    gd_id = await insert_guideline_document(
        conn,
        institution_id=row["institution_id"],
        source_url_ko=row["source_url_ko"],
        storage_path=stored.storage_path,
        sha256=sha256,
        size_bytes=len(data),
        mime=mime,
    )
    await link_announcement(conn, row["announcement_id"], gd_id)
    await run_parse(conn, gd_id, data)
    return True, "fetched + parsed"


async def fetch_pending(
    conn: asyncpg.Connection,
    http: httpx.AsyncClient,
    *,
    limit: int,
    store_blob: _StoreBlob | None = None,
    run_parse: RunParse | None = None,
) -> tuple[int, int]:
    """Process up to `limit` candidate announcements. Returns (ok, fail)."""
    candidates = await fetch_candidates(conn, limit=limit)
    log.info("fetch_worker: %d candidate(s)", len(candidates))
    ok = fail = 0
    for row in candidates:
        try:
            success, note = await process_one(
                conn, http, row, store_blob=store_blob, run_parse=run_parse,
            )
        except Exception as exc:  # one bad PDF must not abort the batch
            success, note = False, f"{type(exc).__name__}: {exc}"
            log.warning("fetch_worker: error on %s: %s", str(row["announcement_id"])[:8], note)
        if success:
            ok += 1
        else:
            fail += 1
            log.info("fetch_worker: skip %s — %s", str(row["announcement_id"])[:8], note)
    return ok, fail
