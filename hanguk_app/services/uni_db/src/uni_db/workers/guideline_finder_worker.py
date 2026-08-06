"""Guideline-finder worker — auto-discover each university's current 모집요강 PDF.

The manual-upload model needs a human to find and upload every university's
admission-guideline PDF. This worker restores automated discovery across the
whole institution list: for each tracked institution it web-searches (Naver)
*inside that university's own domain* for the target cycle's 모집요강, ranks the
hits, downloads the best PDF, and — only when the PDF is genuinely new (a
SHA-256 we've never stored) — inserts a `guideline_documents` row
(parse_status='pending') and runs the Claude parse pipeline. A PDF we already
hold (same hash) or a URL we already ingested is skipped, so a daily sweep costs
one search per school and re-bills the paid LLM only for newly-published guides.

It reuses the download→store→parse substrate from `direct_ingest_worker` /
`fetch_worker` and the Naver search client from the discovery adapters, so the
only genuinely new logic here is per-institution search + candidate ranking +
the new-vs-seen decision. Heavy steps (search, HTTP→PDF resolve, storage, parse)
are injected with lazy-importing defaults so the module imports and unit-tests
without live HTTP / LLM / DB.

Gated by the CLI on `UNI_DB_LIVE_CRAWL` + `UNI_DB_LIVE_APIS` (real ac.kr fetches
+ paid LLM); the Naver adapter and the parse step self-gate too.
"""

from __future__ import annotations

import hashlib
import logging
import re
from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

import asyncpg
import httpx

from ..discovery.adapters.naver_search_adapter import NaverSearchAdapter
from ..discovery.models import Announcement
from ..parse.cycle_detect import cycle_is_older
from ..verify.models import IdentityVerdict
from ..watchdog import watchdog
from .direct_ingest_worker import resolve_to_pdf
from .fetch_worker import (
    RunParse,
    _default_run_parse,
    _default_store_blob,
    _StoreBlob,
    insert_guideline_document,
)
from .propose_worker import registrable_domain

log = logging.getLogger(__name__)

# Korean anchors for an admission guideline (모집요강). We bias toward the
# foreign-applicant guides that matter for this CRM's students, then fall back
# to the general guideline so a school that only publishes one guide is covered.
BASE_KEYWORDS: tuple[str, ...] = (
    "외국인전형 모집요강",
    "외국인 모집요강",
    "모집요강",
)

# Procurement / tender titles that share the 모집요강/외국인 keywords (e.g.
# "외국인 모집요강 제작업체 선정입찰") but aren't admission guides. Ranked last.
_PROCUREMENT_NOISE_RE = re.compile(r"(입찰|용역|구매|업체|공사|납품|임차|제작|선정)")

# How far back a search hit's post date may be and still count as "current".
# Universities post the next cycle's 모집요강 months ahead, and many web-doc hits
# carry no date at all (kept regardless); this only drops clearly-stale hits.
DEFAULT_SINCE_DAYS = 400

# Best-N ranked candidates to actually attempt downloading per institution.
DEFAULT_PER_INSTITUTION = 3


# (domain, keyword) -> announcements for that site-scoped search.
SearchSiteFn = Callable[[str, str], Awaitable[list[Announcement]]]
# url -> (pdf_bytes | None, mime_or_skip_reason).
ResolveFn = Callable[[str], Awaitable[tuple[bytes | None, str]]]


@dataclass(frozen=True, slots=True)
class IdentityDecision:
    """Gate 0 outcome for one candidate PDF (correction plan, Phase 1c).

    ``decision``:
      * ``accept``      — a genuine target-cycle guideline; ingest it.
      * ``reject``      — wrong university / not a guideline; try the next
                          candidate.
      * ``stale``       — a real guideline, but for an OLDER cycle than the
                          target: the school hasn't published the target
                          cycle yet. Recorded, never ingested.
      * ``review``      — the verifier rejected the document as 재외국민-only
                          (overseas-Korean, not a foreign-national audience),
                          but the page text ALSO carries an independent
                          foreign-admission signal the single LLM pass could
                          have missed (a combined booklet, an adjacent
                          section). Never auto-ingested — recorded for a
                          human to glance at, instead of an automatic,
                          unrecoverable reject on one signal alone.
      * ``unreadable``  — the head text couldn't be extracted, so identity is
                          unverifiable. FAIL CLOSED: not ingested; recorded to
                          proposed_sources for a human look.
      * ``error``       — the verifier itself errored. FAIL CLOSED as above.
    """

    decision: str  # accept | reject | stale | review | unreadable | error
    note: str
    verdict: IdentityVerdict | None = None


# (pdf_bytes, institution_row) -> IdentityDecision. Legacy callables returning
# a bare bool (True=accept / False=reject) are still accepted and normalized.
IdentityCheckFn = Callable[[bytes, "asyncpg.Record"], "IdentityDecision | bool"]

# (conn, url, title, note) -> None. Records a finder finding (stale cycle /
# unverifiable candidate) without ingesting; default writes proposed_sources.
RecordNoteFn = Callable[
    [asyncpg.Connection, str, "str | None", str], Awaitable[None]
]


def _normalize_identity(result: IdentityDecision | bool) -> IdentityDecision:
    if isinstance(result, IdentityDecision):
        return result
    if result:
        return IdentityDecision(decision="accept", note="accepted")
    return IdentityDecision(
        decision="reject",
        note="identity rejected (wrong university / cycle / not a guideline)",
    )


async def record_proposed_note(
    conn: asyncpg.Connection,
    url: str,
    title: str | None,
    note: str,
    *,
    source_type: str = "university_admission_board",
    proposed_by: str = "naver_search",
) -> None:
    """Default RecordNoteFn: file the candidate + why it was NOT ingested into
    `proposed_sources` (pending_review) so fail-closed skips stay visible to a
    human instead of vanishing into logs. Idempotent on url_ko — a repeat
    occurrence refreshes `proposed_at` (so a still-happening failure stays
    near the front of the HITL queue) instead of creating a duplicate row."""
    await conn.execute(
        """
        insert into public.proposed_sources
          (url_ko, source_type, proposed_by, candidate_title, review_notes)
        values ($1, $4, $5, $2, $3)
        on conflict (url_ko) do update
          set review_notes = excluded.review_notes,
              candidate_title = coalesce(excluded.candidate_title,
                                         proposed_sources.candidate_title),
              proposed_at = now()
        """,
        url,
        title,
        note[:1000],
        source_type,
        proposed_by,
    )


def pdf_head_text(data: bytes, *, max_pages: int = 3, max_chars: int = 8000) -> str:
    """First-pages text for the Gate 0 identity check — a light pymupdf read (no
    OCR), so a wrong PDF is rejected cheaply before the full extract/parse."""
    try:
        import pymupdf
    except ImportError:  # pragma: no cover — pymupdf is a base dep in production
        return ""
    parts: list[str] = []
    try:
        doc = pymupdf.open(stream=data, filetype="pdf")
    except Exception:  # not a readable PDF → let the caller decide
        return ""
    try:
        for i, page in enumerate(doc):
            if i >= max_pages:
                break
            parts.append(page.get_text())
    finally:
        doc.close()
    return "\n".join(parts)[:max_chars]


@dataclass(frozen=True, slots=True)
class FinderRun:
    institutions_seen: int
    candidates_seen: int  # unique on-domain hits across all schools
    ingested: int         # new guideline PDFs stored + parsed
    unchanged: int        # a guideline we already hold (hash/url match)
    skipped: int          # no usable on-domain PDF found
    errors: int           # institutions whose processing raised


def build_search_keywords(year: int) -> list[str]:
    """Year-tagged variants first (so a target-cycle guide surfaces), then the
    bare anchors as a fallback. Order-preserving dedup."""
    academic_year = f"{year}학년도"
    ordered = [f"{academic_year} {kw}" for kw in BASE_KEYWORDS] + list(BASE_KEYWORDS)
    seen: set[str] = set()
    out: list[str] = []
    for kw in ordered:
        if kw not in seen:
            seen.add(kw)
            out.append(kw)
    return out


def _rank_key(
    url: str, title: str | None, *, year: int
) -> tuple[bool, bool, bool, bool, bool, int]:
    """Sort key (ascending = best first): drop procurement noise, then prefer a
    모집요강, the TARGET YEAR, a foreign-applicant guide, a direct PDF, then the
    shorter URL. Year is ranked ABOVE direct-PDF-ness on purpose so a current-year
    board page beats an old-year direct PDF (which the identity gate would reject
    anyway) instead of being attempted first."""
    t = title or ""
    u = url.lower()
    return (
        bool(_PROCUREMENT_NOISE_RE.search(t)),
        "모집요강" not in t and "모집요강" not in u,
        str(year) not in t and str(year) not in u,
        "외국인" not in t and "재외국민" not in t,
        not u.endswith(".pdf"),
        len(url),
    )


@dataclass(frozen=True, slots=True)
class _Candidate:
    url: str
    title: str | None


async def gather_candidates(
    search_site: SearchSiteFn, *, domain: str, keywords: Sequence[str], year: int
) -> list[_Candidate]:
    """Search every keyword inside `domain`, keep on-domain hits, dedup by URL,
    and return them ranked best-first. A keyword that errors is skipped so one
    bad call never loses the whole institution."""
    by_url: dict[str, _Candidate] = {}
    for kw in keywords:
        try:
            posts = await search_site(domain, kw)
        except Exception as exc:  # one keyword failing must not lose the school
            log.warning(
                "guideline_finder: search %s %r failed: %s: %s",
                domain, kw, type(exc).__name__, str(exc)[:160],
            )
            continue
        for ann in posts:
            if registrable_domain(ann.url_ko) != domain:
                continue  # a loose site: match landed on another school — drop
            by_url.setdefault(ann.url_ko, _Candidate(url=ann.url_ko, title=ann.title_ko))
    return sorted(
        by_url.values(), key=lambda c: _rank_key(c.url, c.title, year=year)
    )


async def _known_hash(conn: asyncpg.Connection, sha256: str) -> bool:
    """This exact PDF is already stored (and not a prior failure) — not new."""
    row = await conn.fetchrow(
        "select 1 from public.guideline_documents "
        "where file_hash_sha256 = $1 and parse_status <> 'failed' limit 1",
        sha256,
    )
    return row is not None


async def fetch_target_cycle(conn: asyncpg.Connection) -> tuple[int, str | None] | None:
    """The admission cycle to crawl for, as selected in the CRM.

    Reads `public.intakes` (the CRM's season/year table): the default intake,
    else the open one, else the most recent. Returns `(year, term)` with term in
    {'spring','fall'} — or None if the table is absent/empty so the caller can
    fall back to a date-based default.
    """
    try:
        row = await conn.fetchrow(
            """
            select season, year from public.intakes
             order by is_default desc nulls last, is_open desc nulls last,
                      year desc, updated_at desc nulls last
             limit 1
            """
        )
    except Exception as exc:  # table may not exist in a bare uni_db project
        log.info("guideline_finder: no intakes table (%s); using date default",
                 type(exc).__name__)
        return None
    if not row or row["year"] is None:
        return None
    season = row["season"] if row["season"] in ("spring", "fall") else None
    return int(row["year"]), season


async def fetch_target_institutions(
    conn: asyncpg.Connection, *, limit: int
) -> list[asyncpg.Record]:
    """Tracked institutions that have a domain to search, partners/top tiers
    first so a capped run covers the schools that matter most."""
    return await conn.fetch(
        """
        select id, name_ko, name_ko_short, name_en, primary_domain
          from public.institutions
         where primary_domain is not null and primary_domain <> ''
         order by is_partner desc nulls last, tier asc nulls last, name_ko asc
         limit $1
        """,
        limit,
    )


async def process_one_institution(
    conn: asyncpg.Connection,
    row: asyncpg.Record,
    *,
    keywords: Sequence[str],
    year: int,
    per_institution: int,
    search_site: SearchSiteFn,
    resolve: ResolveFn,
    store_blob: _StoreBlob,
    run_parse: RunParse,
    identity_check: IdentityCheckFn | None = None,
    record_note: RecordNoteFn | None = None,
) -> tuple[str, str, int]:
    """Find + ingest one institution's current guideline.

    Returns (outcome, note, candidates_seen) where outcome is one of
    ``ingested`` | ``unchanged`` | ``skipped``.

    Identity gating FAILS CLOSED (correction plan, Phase 1c): an unreadable
    head or a verifier error means the candidate is NOT ingested — it is
    recorded via `record_note` for a human look instead. A readable guideline
    for an OLDER cycle is likewise never ingested; it is recorded as
    "target cycle not yet published" for the institution.
    """
    domain = registrable_domain(row["primary_domain"])
    candidates = await gather_candidates(
        search_site, domain=domain, keywords=keywords, year=year
    )
    if not candidates:
        return "skipped", "search returned no on-domain guideline", 0

    recorder = record_note or record_proposed_note
    name = row["name_ko"] or domain
    saw_known = False
    saw_stale = False
    last_note = "no usable PDF among candidates"
    for cand in candidates[:per_institution]:
        # One bad candidate (network error, unreadable PDF, parse failure) must
        # not abandon this institution's remaining candidates.
        try:
            data, mime = await resolve(cand.url)
            if data is None:
                last_note = mime  # `mime` carries the skip reason here
                continue
            # Freshness is keyed on CONTENT, not URL: hash first, so an in-place
            # replacement at a previously-seen URL is caught as new, and a PDF we
            # already hold (under any URL) is skipped BEFORE any paid identity or
            # parse work.
            sha256 = hashlib.sha256(data).hexdigest()
            if await _known_hash(conn, sha256):
                saw_known = True
                continue
            # Gate 0 — reject a wrong university / old-cycle / not-a-guideline
            # PDF before we store or (expensively) parse it. Fail closed.
            verdict: IdentityVerdict | None = None
            if identity_check is not None:
                gate = _normalize_identity(identity_check(data, row))
                verdict = gate.verdict
                if gate.decision == "stale":
                    saw_stale = True
                    last_note = gate.note
                    await recorder(
                        conn, cand.url, cand.title,
                        f"{name}: target-cycle {year} guideline not yet "
                        f"published — {gate.note}",
                    )
                    continue
                if gate.decision in ("unreadable", "error"):
                    last_note = gate.note
                    await recorder(
                        conn, cand.url, cand.title,
                        f"{name}: candidate NOT ingested (identity "
                        f"unverifiable, fail-closed) — {gate.note}",
                    )
                    continue
                if gate.decision == "review":
                    last_note = gate.note
                    await recorder(
                        conn, cand.url, cand.title,
                        f"{name}: candidate NOT ingested (ambiguous audience, "
                        f"needs manual review) — {gate.note}",
                    )
                    continue
                if gate.decision != "accept":
                    last_note = gate.note
                    continue
            stored = store_blob(data, sha256=sha256, mime=mime)
            gd_id = await insert_guideline_document(
                conn,
                institution_id=row["id"],
                source_url_ko=cand.url,
                storage_path=stored.storage_path,
                sha256=sha256,
                size_bytes=len(data),
                mime=mime,
                academic_year=verdict.academic_year_in_doc if verdict else None,
                semester=verdict.term_in_doc if verdict else None,
            )
            # Belt-and-suspenders (Phase 3): an ingested doc with a cycle
            # BELOW the crawl target means the identity gate was bypassed.
            watchdog.record_ingested_document(
                academic_year=verdict.academic_year_in_doc if verdict else None,
                target_year=year,
            )
            await run_parse(conn, gd_id, data)
            return "ingested", cand.url, len(candidates)
        except Exception as exc:  # isolate this candidate; try the next one
            last_note = f"{type(exc).__name__}: {exc}"
            log.warning("guideline_finder: candidate error %s — %s",
                        cand.url, str(exc)[:160])
            continue

    if saw_known:
        return "unchanged", "current guideline already ingested", len(candidates)
    if saw_stale:
        return (
            "skipped",
            f"target-cycle {year} guideline not yet published "
            f"(newest candidate is an older cycle)",
            len(candidates),
        )
    return "skipped", last_note, len(candidates)


async def ingest_one_url(
    conn: asyncpg.Connection,
    row: asyncpg.Record,
    url: str,
    *,
    resolve: ResolveFn,
    store_blob: _StoreBlob,
    run_parse: RunParse,
    identity_check: IdentityCheckFn | None = None,
    record_note: RecordNoteFn | None = None,
) -> tuple[str, str]:
    """Ingest one caller-supplied PDF URL for a single institution.

    Same download → content-hash dedup → identity gate (fail-closed) → store →
    parse path as ``process_one_institution``, but the URL is provided directly
    (e.g. by the Routine agent's own web research) instead of discovered via
    site search — so it needs no search backend (no Naver). Returns
    ``(outcome, note)`` where outcome is ``ingested`` (note =
    guideline_document id) | ``unchanged`` | ``skipped`` | ``error``.
    """
    recorder = record_note or record_proposed_note
    name = row["name_ko"] or "?"
    try:
        data, mime = await resolve(url)
        if data is None:
            # Every resolve failure (HTTP block/503, too-large, non-PDF, network
            # error) is recorded — this is the Routine agent's own manually
            # researched URL, not one of several search candidates, so losing
            # it silently means re-discovering it from scratch (and re-hitting
            # the same blocked host) on every future run.
            await recorder(
                conn, url, name,
                f"{name}: PDF fetch failed — {mime}",
                proposed_by="manual",
            )
            return "skipped", mime  # `mime` carries the skip reason
        sha256 = hashlib.sha256(data).hexdigest()
        if await _known_hash(conn, sha256):
            return "unchanged", "already ingested (same content hash)"
        verdict: IdentityVerdict | None = None
        if identity_check is not None:
            gate = _normalize_identity(identity_check(data, row))
            verdict = gate.verdict
            if gate.decision == "stale":
                await recorder(
                    conn, url, name,
                    f"{name}: target-cycle guideline not yet published — {gate.note}",
                    proposed_by="manual",
                )
                return "skipped", gate.note
            if gate.decision in ("unreadable", "error"):
                await recorder(
                    conn, url, name,
                    f"{name}: candidate NOT ingested (identity unverifiable, "
                    f"fail-closed) — {gate.note}",
                    proposed_by="manual",
                )
                return "skipped", gate.note
            if gate.decision == "review":
                await recorder(
                    conn, url, name,
                    f"{name}: candidate NOT ingested (ambiguous audience, "
                    f"needs manual review) — {gate.note}",
                    proposed_by="manual",
                )
                return "skipped", gate.note
            if gate.decision != "accept":
                await recorder(
                    conn, url, name,
                    f"{name}: candidate NOT ingested (identity rejected) — {gate.note}",
                    proposed_by="manual",
                )
                return "skipped", gate.note
        stored = store_blob(data, sha256=sha256, mime=mime)
        gd_id = await insert_guideline_document(
            conn,
            institution_id=row["id"],
            source_url_ko=url,
            storage_path=stored.storage_path,
            sha256=sha256,
            size_bytes=len(data),
            mime=mime,
            academic_year=verdict.academic_year_in_doc if verdict else None,
            semester=verdict.term_in_doc if verdict else None,
        )
        await run_parse(conn, gd_id, data)
        return "ingested", str(gd_id)
    except Exception as exc:
        log.warning("ingest_one_url: %s — %s", url, str(exc)[:160])
        try:
            await recorder(
                conn, url, name,
                f"{name}: candidate NOT ingested (unexpected error) — "
                f"{type(exc).__name__}: {exc}",
                proposed_by="manual",
            )
        except Exception:  # the DB/conn itself may be what's broken — never
            # let the recording attempt shadow the real error being reported.
            log.warning("ingest_one_url: failed to record note for %s", url)
        return "error", f"{type(exc).__name__}: {exc}"


def _default_search_site(http: httpx.AsyncClient, since: datetime) -> SearchSiteFn:
    async def search(domain: str, keyword: str) -> list[Announcement]:
        adapter = NaverSearchAdapter(
            source_id=uuid4(), keyword=keyword, site=domain, http_client=http
        )
        return await adapter.list_recent_posts(since=since)

    return search


def _make_default_resolve(http: httpx.AsyncClient) -> ResolveFn:
    from ..parse.pdf_resolvers.generic_attachment import resolve as generic_resolve

    async def resolve(url: str) -> tuple[bytes | None, str]:
        return await resolve_to_pdf(http, url, generic_resolve=generic_resolve)

    return resolve


# A document whose LLM verdict is 재외국민-only (overseas_korean) still gets a
# second, independent look before it's rejected outright: these keywords mark
# a foreign-national (외국인) admission track the single LLM pass could have
# missed (a combined 재외국민+외국인 booklet, an adjacent section it didn't
# read far enough to see). None of this ever auto-accepts the document — it
# only decides whether a reject is final or gets a human's eyes first.
_FOREIGN_ADMISSION_SIGNAL_RE = re.compile(
    r"외국인\s*(?:전형|입학|모집|유학생)|국제입학|international\s+admission"
    r"|foreign\s+(?:student|applicant|national)|spring\s+intake|유학생\s*(?:전형|입학)",
    re.IGNORECASE,
)


def _has_foreign_admission_signal(text: str) -> bool:
    return bool(_FOREIGN_ADMISSION_SIGNAL_RE.search(text))


def make_identity_check(target_year: int, target_term: str | None = None) -> IdentityCheckFn:
    """Gate 0 as an IdentityCheckFn: read the PDF's first pages and ask the
    verifier whether it's this university's target-cycle foreign-applicant
    guideline.

    FAILS CLOSED (correction plan, Phase 1c): an unreadable head or a verifier
    error means the candidate is NOT ingested (previously both fell open, which
    is how unverifiable HWP/board blobs and old-cycle PDFs got stored). A
    genuine guideline whose cycle is OLDER than the target is classified
    ``stale`` so the caller records "not yet published" instead of ingesting.

    A rejection is still fail-closed (never auto-ingested), but a document
    rejected SPECIFICALLY for being 재외국민-only audience gets one more,
    independent check — a keyword scan of the same head text — before the
    reject is treated as final. A hit downgrades it to ``review`` instead of
    ``reject`` (see `_has_foreign_admission_signal`): don't block on a single
    signal (the LLM's own audience call) when a second, cheap signal
    disagrees.
    """
    from ..verify.agents import check_identity

    def check(data: bytes, row: asyncpg.Record) -> IdentityDecision:
        head = pdf_head_text(data)
        if not head.strip():
            return IdentityDecision(
                decision="unreadable",
                note="no readable text in the first pages (scan/HWP/non-PDF?)",
            )
        try:
            verdict = check_identity(
                university_name_ko=row["name_ko"],
                university_name_en=row["name_en"],
                target_year=target_year,
                target_term=target_term,
                head_text=head,
            )
        except Exception as exc:
            log.warning(
                "guideline_finder: identity check errored (%s); failing closed",
                type(exc).__name__,
            )
            return IdentityDecision(
                decision="error",
                note=f"identity verifier errored: {type(exc).__name__}",
            )
        if verdict.accepted:
            return IdentityDecision(decision="accept", note="accepted", verdict=verdict)
        if (
            verdict.document_kind == "guideline"
            and verdict.matches_target_university
            and cycle_is_older(
                verdict.academic_year_in_doc,
                verdict.term_in_doc,
                target_year=target_year,
                target_term=target_term,
            )
        ):
            note = (
                f"newest guideline is {verdict.academic_year_in_doc}"
                f"{f' {verdict.term_in_doc}' if verdict.term_in_doc else ''} "
                f"(target {target_year}{f' {target_term}' if target_term else ''})"
            )
            log.info("guideline_finder: STALE cycle for %s — %s", row["name_ko"], note)
            return IdentityDecision(decision="stale", note=note, verdict=verdict)
        if (
            verdict.document_kind == "guideline"
            and verdict.matches_target_university
            and verdict.matches_target_cycle
            and not verdict.serves_foreign_applicants
            and verdict.audience == "overseas_korean"
            and _has_foreign_admission_signal(head)
        ):
            note = (
                "verifier says 재외국민-only, but the page text also carries a "
                "foreign-national admission signal — needs a human look, not "
                "an automatic reject"
            )
            log.info(
                "guideline_finder: REVIEW (ambiguous audience) for %s — %s",
                row["name_ko"], note,
            )
            return IdentityDecision(decision="review", note=note, verdict=verdict)
        note = verdict.reject_reason or verdict.document_kind
        log.info("guideline_finder: identity REJECT for %s — %s", row["name_ko"], note)
        return IdentityDecision(
            decision="reject",
            note=f"identity rejected — {note}",
            verdict=verdict,
        )

    return check


def make_run_parse(target_year: int, target_term: str | None = None) -> RunParse:
    """A run_parse that threads the target cycle into the parse gauntlet so its
    sanity/scope checks know which year/term to hold the data to. Verification
    level + require-approval come from settings inside parse_one_document."""

    async def run_parse(conn: asyncpg.Connection, gd_id: UUID, data: bytes) -> None:
        from ..parse.extract_orchestrator import extract as extract_pdf
        from .parse_worker import parse_one_document, persist_outcome

        extracted, _decision = extract_pdf(data)
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
            target_year=target_year,
            target_term=target_term,
        )
        await persist_outcome(conn, outcome)

    return run_parse


async def find_new_guidelines(
    conn: asyncpg.Connection,
    http: httpx.AsyncClient,
    *,
    year: int,
    limit: int,
    per_institution: int = DEFAULT_PER_INSTITUTION,
    since_days: int = DEFAULT_SINCE_DAYS,
    search_site: SearchSiteFn | None = None,
    resolve: ResolveFn | None = None,
    store_blob: _StoreBlob | None = None,
    run_parse: RunParse | None = None,
    identity_check: IdentityCheckFn | None = None,
    record_note: RecordNoteFn | None = None,
) -> FinderRun:
    """Sweep up to `limit` institutions for the `year` cycle's guideline PDF.

    Every heavy step is injectable; production uses the lazy-importing defaults
    (Naver search, generic PDF resolver, Supabase storage, the parse worker).
    A single institution failing is logged and counted, never fatal.
    """
    since = datetime.now(tz=timezone.utc) - timedelta(days=since_days)
    search_site = search_site or _default_search_site(http, since)
    resolve = resolve or _make_default_resolve(http)
    store_blob = store_blob or _default_store_blob
    run_parse = run_parse or _default_run_parse

    keywords = build_search_keywords(year)
    institutions = await fetch_target_institutions(conn, limit=limit)
    log.info(
        "guideline_finder: %d institution(s), year=%d, keywords=%d",
        len(institutions), year, len(keywords),
    )

    ingested = unchanged = skipped = errors = candidates_seen = 0
    for row in institutions:
        name = row["name_ko"] or row["primary_domain"]
        try:
            outcome, note, seen = await process_one_institution(
                conn, row,
                keywords=keywords, year=year, per_institution=per_institution,
                search_site=search_site, resolve=resolve,
                store_blob=store_blob, run_parse=run_parse,
                identity_check=identity_check, record_note=record_note,
            )
        except Exception as exc:  # one bad school must not abort the sweep
            errors += 1
            log.warning(
                "guideline_finder: error on %s: %s: %s",
                name, type(exc).__name__, str(exc)[:200],
            )
            continue
        candidates_seen += seen
        if outcome == "ingested":
            ingested += 1
            log.info("guideline_finder: NEW %s — %s", name, note)
        elif outcome == "unchanged":
            unchanged += 1
            log.info("guideline_finder: unchanged %s — %s", name, note)
        else:
            skipped += 1
            log.info("guideline_finder: skip %s — %s", name, note)

    return FinderRun(
        institutions_seen=len(institutions),
        candidates_seen=candidates_seen,
        ingested=ingested,
        unchanged=unchanged,
        skipped=skipped,
        errors=errors,
    )
