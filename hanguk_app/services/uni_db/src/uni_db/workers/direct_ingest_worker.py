"""Direct-ingest worker — pull guides from auto-discovered sources.

The crawler (`discovery_worker`) only handles sources that have a hand-written
board adapter. Sources promoted from auto-discovery are plain guide pages / PDF
links with no adapter and no institution, so the crawler skips them entirely.

This worker ingests them directly. For each live promoted source that has no
`guideline_document` yet it:
  1. resolves the source URL to a PDF — a direct file, or the download link
     found on the HTML page (generic resolver),
  2. ensures the source's institution exists (creates a hidden placeholder if
     not — auto-created institutions are kept off the map until a reviewer
     corrects the name/type),
  3. stores the blob, inserts a `guideline_documents` row, and runs the parse
     pipeline.

Idempotent: a source whose `url_ko` already backs a `guideline_documents` row
(via `source_url_ko`) is skipped, so each new weekly approval is picked up
automatically without reprocessing everything else.

Heavy steps (storage, parse, the generic resolver) are injected with
lazy-importing defaults so the module imports and unit-tests without
httpx/PyMuPDF/boto3.
"""

from __future__ import annotations

import hashlib
import logging
import re
from collections.abc import Awaitable, Callable
from typing import Any
from uuid import UUID

import asyncpg
import httpx

from ..config import settings
from .fetch_worker import (
    MAX_PDF_BYTES,
    RunParse,
    _default_run_parse,
    _default_store_blob,
    _StoreBlob,
    decide_mime,
    insert_guideline_document,
)
from .propose_worker import registrable_domain

log = logging.getLogger(__name__)

_KOREAN_UNIV_NAME = re.compile(r"[가-힣]{2,}(?:대학교|대학|대)")
# Auto-created institutions are placeholders: kept off the public map and typed
# 'private' (the modal type, a valid institution_type) until a reviewer fixes
# the real name/type. institution_type has a CHECK constraint, so this must be
# one of the allowed values.
_PLACEHOLDER_INSTITUTION_TYPE = "private"

# A page→PDF resolver: (url, http_client, referer) -> ResolvedPdf | None.
GenericResolve = Callable[[str, httpx.AsyncClient, str | None], Awaitable[Any]]


def korean_name_from_title(title: str | None) -> str | None:
    """Pull a Korean university name (…대학교/…대학/…대) out of a search-hit title."""
    if not title:
        return None
    m = _KOREAN_UNIV_NAME.search(title)
    return m.group(0) if m else None


async def get_or_create_institution(
    conn: asyncpg.Connection, *, domain: str, title: str | None
) -> UUID:
    """Return the institution id for `domain`, creating a hidden placeholder
    (name from the title if we can find one, else the domain) if none exists."""
    row = await conn.fetchrow(
        "select id from public.institutions where primary_domain = $1", domain
    )
    if row is not None:
        return row["id"]
    name_ko = korean_name_from_title(title) or domain
    return await conn.fetchval(
        """
        insert into public.institutions
          (name_ko, institution_type, primary_domain, is_visible_on_map)
        values ($1, $2, $3, false)
        returning id
        """,
        name_ko,
        _PLACEHOLDER_INSTITUTION_TYPE,
        domain,
    )


async def fetch_uningested_sources(
    conn: asyncpg.Connection, *, limit: int
) -> list[asyncpg.Record]:
    """Live auto-discovered sources that don't yet back a guideline_document."""
    return await conn.fetch(
        """
        select s.id, s.url_ko, ps.candidate_title
          from public.announcement_sources s
          left join public.proposed_sources ps on ps.url_ko = s.url_ko
         where s.status = 'live'
           and s.notes like 'Promoted from proposed_sources%'
           and not exists (
             select 1 from public.guideline_documents g
              where g.source_url_ko = s.url_ko
           )
         order by s.created_at desc
         limit $1
        """,
        limit,
    )


def _cap(data: bytes, mime: str) -> tuple[bytes | None, str]:
    if len(data) > MAX_PDF_BYTES:
        return None, f"pdf too large ({len(data)} bytes)"
    return data, mime


async def _get(
    http: httpx.AsyncClient, url: str, headers: dict[str, str]
) -> tuple[bytes, str]:
    resp = await http.get(
        url,
        headers=headers,
        follow_redirects=True,
        timeout=settings.http_request_timeout_sec,
    )
    resp.raise_for_status()
    return resp.content, (resp.headers.get("content-type") or "").split(";", 1)[0].strip()


async def resolve_to_pdf(
    http: httpx.AsyncClient, url: str, *, generic_resolve: GenericResolve
) -> tuple[bytes | None, str]:
    """Return (data, mime) for a usable PDF, or (None, reason).

    Tries the URL as a direct file first; if it's an HTML page, runs the generic
    resolver to find the download link on it.
    """
    base = {"User-Agent": settings.http_user_agent}
    data, raw_mime = await _get(http, url, base)
    mime, _reason = decide_mime(data, raw_mime)
    if mime is not None:
        return _cap(data, mime)

    resolved = await generic_resolve(url, http, url)
    if resolved is None:
        return None, "URL is not a direct PDF and no download link found on the page"
    data, raw_mime = await _get(http, resolved.url, {**base, "Referer": url, **dict(resolved.headers)})
    mime, reason = decide_mime(data, raw_mime)
    if mime is None:
        return None, reason or "resolved link was not a PDF"
    return _cap(data, mime)


async def process_one_source(
    conn: asyncpg.Connection,
    http: httpx.AsyncClient,
    row: asyncpg.Record,
    *,
    store_blob: _StoreBlob | None = None,
    run_parse: RunParse | None = None,
    generic_resolve: GenericResolve | None = None,
) -> tuple[bool, str]:
    store_blob = store_blob or _default_store_blob
    run_parse = run_parse or _default_run_parse
    if generic_resolve is None:
        from ..parse.pdf_resolvers.generic_attachment import resolve as generic_resolve

    url = row["url_ko"]
    data, mime = await resolve_to_pdf(http, url, generic_resolve=generic_resolve)
    if data is None:
        return False, mime  # `mime` carries the skip reason here

    institution_id = await get_or_create_institution(
        conn, domain=registrable_domain(url), title=row["candidate_title"]
    )
    sha256 = hashlib.sha256(data).hexdigest()
    stored = store_blob(data, sha256=sha256, mime=mime)
    gd_id = await insert_guideline_document(
        conn,
        institution_id=institution_id,
        source_url_ko=url,
        storage_path=stored.storage_path,
        sha256=sha256,
        size_bytes=len(data),
        mime=mime,
    )
    await run_parse(conn, gd_id, data)
    return True, "ingested + parsed"


async def ingest_pending(
    conn: asyncpg.Connection,
    http: httpx.AsyncClient,
    *,
    limit: int,
    store_blob: _StoreBlob | None = None,
    run_parse: RunParse | None = None,
    generic_resolve: GenericResolve | None = None,
) -> tuple[int, int]:
    """Ingest up to `limit` auto-discovered sources. Returns (ok, fail)."""
    sources = await fetch_uningested_sources(conn, limit=limit)
    log.info("direct_ingest: %d source(s) to ingest", len(sources))
    ok = fail = 0
    for row in sources:
        try:
            success, note = await process_one_source(
                conn, http, row,
                store_blob=store_blob, run_parse=run_parse,
                generic_resolve=generic_resolve,
            )
        except Exception as exc:  # one bad source must not abort the batch
            success, note = False, f"{type(exc).__name__}: {exc}"
            log.warning("direct_ingest: error on %s: %s", str(row["id"])[:8], note)
        if success:
            ok += 1
            log.info("direct_ingest: %s — %s", str(row["id"])[:8], note)
        else:
            fail += 1
            log.info("direct_ingest: skip %s — %s", str(row["id"])[:8], note)
    return ok, fail
