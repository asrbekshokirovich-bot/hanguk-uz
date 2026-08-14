"""Propose-sources worker — auto-discover unknown ac.kr admission boards.

`run-pipeline` and `reparse` only ever touch sources we already track. To grow
coverage to universities we've never crawled, this runs the Naver web-search
adapter over the Korean keyword vocabulary, maps each surviving hit to a
`propose_source.Candidate`, and writes it to `proposed_sources` for the HITL
reviewer to approve (ADR-005). Approved rows are promoted into
`announcement_sources` by the `trg_proposed_source_promote` trigger — nothing
goes live without a human, so this worker is safe to schedule.

The Naver HTTP call lives in `NaverSearchAdapter`, which self-gates on
`settings.live_apis`; this module only orchestrates the keyword loop, the
cross-keyword url dedup, and the gate-and-insert via `propose_batch`. Both the
per-keyword search and the propose sink are injectable so the loop unit-tests
without live HTTP or a database.
"""

from __future__ import annotations

import logging
import re
from collections.abc import Awaitable, Callable, Iterable, Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import TYPE_CHECKING
from uuid import uuid4

import asyncpg

from ..discovery.adapters.naver_search_adapter import (
    DEFAULT_DISCOVERY_KEYWORDS,
    NaverSearchAdapter,
)
from ..discovery.keywords_ko import audience_rank
from ..discovery.models import Announcement
from ..discovery.propose_source import Candidate, ProposeOutcome, propose_batch

if TYPE_CHECKING:
    import httpx

log = logging.getLogger(__name__)

# Yields the announcements for one keyword. NaverSearchAdapter satisfies the
# default; tests pass a fake to avoid live HTTP.
SearchFn = Callable[[str], Awaitable[list[Announcement]]]
# Yields announcements for one (domain, keyword) pair — used by the targeted
# per-university foreign-page search.
SearchSiteFn = Callable[[str, str], Awaitable[list[Announcement]]]
ProposeFn = Callable[
    [asyncpg.Connection, Iterable[Candidate]], Awaitable[list[ProposeOutcome]]
]

# Foreign / overseas-Korean admission anchors used to find each university's
# international-applicant page when we search inside its own domain. Kept tight
# so the per-university search returns the admission page, not student-life or
# news pages that merely mention 외국인.
TARGETED_FOREIGN_KEYWORDS: tuple[str, ...] = (
    "외국인전형",
    "외국인특별전형",
    "재외국민",
)

# Procurement / tender titles that share the 외국인 keyword (e.g. "외국인 모집요강
# 제작업체 선정입찰") but aren't admission pages. Ranked last so a real guide wins.
_PROCUREMENT_NOISE_RE = re.compile(r"(입찰|용역|구매|업체|공사|납품|임차|제작|선정)")

# How many foreign pages to keep per university. A university publishes the same
# 모집요강 across many years / sub-pages / file links; without a cap one weekly
# run floods the review queue with hundreds of near-duplicates.
DEFAULT_MAX_PER_UNIVERSITY = 3


@dataclass(frozen=True, slots=True)
class ProposeRun:
    keywords_searched: int
    candidates_seen: int  # unique url_ko across every keyword
    proposed: int         # rows inserted/refreshed in proposed_sources
    skipped: int          # gated out, or url already live
    search_errors: int    # keywords whose search call raised


async def discover_sources(
    conn: asyncpg.Connection,
    *,
    since: datetime,
    keywords: Sequence[str] = DEFAULT_DISCOVERY_KEYWORDS,
    http_client: httpx.AsyncClient | None = None,
    search: SearchFn | None = None,
    propose: ProposeFn = propose_batch,
) -> ProposeRun:
    """Run Naver discovery across `keywords` and propose unseen ac.kr boards.

    `search(keyword)` returns the announcements for one keyword; the default
    builds a fresh NaverSearchAdapter per keyword over the shared http_client.
    A keyword that errors (rate limit, transient 5xx) is logged and skipped so
    one bad call never aborts the whole sweep.
    """
    search_fn = search or _default_search(http_client, since)

    seen: dict[str, Candidate] = {}
    search_errors = 0
    for kw in keywords:
        try:
            posts = await search_fn(kw)
        except Exception as exc:  # one keyword failing must not kill the sweep
            search_errors += 1
            log.warning(
                "propose_worker: search %r failed: %s: %s",
                kw, type(exc).__name__, str(exc)[:160],
            )
            continue
        for ann in posts:
            # The same notice surfaces under several keywords; keep the first.
            if ann.url_ko in seen:
                continue
            seen[ann.url_ko] = Candidate(
                url_ko=ann.url_ko,
                proposed_by="naver_search",
                candidate_title=ann.title_ko,
            )

    outcomes = await propose(conn, list(seen.values()))
    proposed = sum(1 for o in outcomes if o.inserted)
    skipped = len(outcomes) - proposed
    log.info(
        "propose_worker: keywords=%d unique_candidates=%d proposed=%d "
        "skipped=%d search_errors=%d",
        len(keywords), len(seen), proposed, skipped, search_errors,
    )
    return ProposeRun(
        keywords_searched=len(keywords),
        candidates_seen=len(seen),
        proposed=proposed,
        skipped=skipped,
        search_errors=search_errors,
    )


def _default_search(
    http_client: httpx.AsyncClient | None, since: datetime
) -> SearchFn:
    if http_client is None:
        raise RuntimeError(
            "discover_sources needs an http_client (or an injected search fn)"
        )

    async def search(keyword: str) -> list[Announcement]:
        adapter = NaverSearchAdapter(
            source_id=uuid4(), keyword=keyword, http_client=http_client
        )
        return await adapter.list_recent_posts(since=since)

    return search


# ---------------------------------------------------------------------------
# Targeted per-university foreign-page search.
#
# Broad `.ac.kr` discovery only keeps the ~50 most recent hits per keyword, so
# a given university's foreign-admission page often never surfaces — we just
# happen to catch one of its domestic pages. Searching INSIDE each known
# university domain (site:inha.ac.kr 외국인전형) reliably turns up that
# university's 외국인/재외국민 page. Run this over every domain we already know
# to fill in the foreign pages systematically.
# ---------------------------------------------------------------------------


def registrable_domain(url_or_host: str) -> str:
    """`https://admission.inha.ac.kr/x` -> `inha.ac.kr` (last 3 labels for the
    .ac.kr / .go.kr space). Used to group pages by university and to verify a
    search hit really belongs to the university we searched."""
    host = url_or_host
    if "//" in host:
        host = host.split("//", 1)[1]
    host = host.split("/", 1)[0].split("?", 1)[0].lower().strip()
    parts = [p for p in host.split(".") if p]
    if len(parts) >= 3:
        return ".".join(parts[-3:])
    return ".".join(parts)


def _candidate_rank_key(c: Candidate) -> tuple[bool, bool, int, bool, int]:
    """Sort key (ascending = best first): real admission guide before procurement
    noise, 모집요강 before not, a FOREIGN-applicant guide before a Korean-citizen
    one, 전형 before not, then shorter URL.

    The audience term ranks above 전형 because both a 외국인전형 and a
    재외국민전형 page carry 전형: without it the two tied and the per-university
    cap could keep the wrong one and drop the right one. See `audience_rank` —
    a combined 재외국민+외국인 page counts as foreign, which it is."""
    title = c.candidate_title or ""
    return (
        bool(_PROCUREMENT_NOISE_RE.search(title)),
        "모집요강" not in title,
        audience_rank(f"{title} {c.url_ko.lower()}"),
        "전형" not in title,
        len(c.url_ko),
    )


def cap_per_university(
    candidates: Iterable[Candidate], max_per_university: int
) -> list[Candidate]:
    """Keep only the best `max_per_university` candidates for each university."""
    by_domain: dict[str, list[Candidate]] = {}
    for c in candidates:
        by_domain.setdefault(registrable_domain(c.url_ko), []).append(c)
    kept: list[Candidate] = []
    for cands in by_domain.values():
        kept.extend(sorted(cands, key=_candidate_rank_key)[:max_per_university])
    return kept


async def fetch_known_domains(
    conn: asyncpg.Connection,
    *,
    statuses: Sequence[str] = ("pending_review",),
) -> list[str]:
    """Distinct university domains already sitting in proposed_sources."""
    rows = await conn.fetch(
        "select distinct url_ko from public.proposed_sources "
        "where status = any($1::text[])",
        list(statuses),
    )
    domains = {registrable_domain(r["url_ko"]) for r in rows if r["url_ko"]}
    return sorted(d for d in domains if d)


async def discover_targeted(
    conn: asyncpg.Connection,
    *,
    domains: Sequence[str],
    since: datetime,
    keywords: Sequence[str] = TARGETED_FOREIGN_KEYWORDS,
    max_per_university: int = DEFAULT_MAX_PER_UNIVERSITY,
    http_client: httpx.AsyncClient | None = None,
    search_site: SearchSiteFn | None = None,
    propose: ProposeFn = propose_batch,
) -> ProposeRun:
    """Search each university's own domain for its foreign-applicant page.

    `search_site(domain, keyword)` returns the hits for one (domain, keyword);
    the default restricts a NaverSearchAdapter to that domain. A result whose
    host doesn't actually belong to the searched university is dropped, so a
    loose `site:` match can't mis-attribute a page to the wrong school. Only the
    best `max_per_university` pages per school are proposed, so the review queue
    isn't flooded with near-duplicate copies of the same guide.
    """
    search_fn = search_site or _default_search_site(http_client, since)

    seen: dict[str, Candidate] = {}
    searches = 0
    search_errors = 0
    for domain in domains:
        for kw in keywords:
            searches += 1
            try:
                posts = await search_fn(domain, kw)
            except Exception as exc:  # one (domain, keyword) failing isn't fatal
                search_errors += 1
                log.warning(
                    "propose_worker[targeted]: %s %r failed: %s: %s",
                    domain, kw, type(exc).__name__, str(exc)[:160],
                )
                continue
            for ann in posts:
                if registrable_domain(ann.url_ko) != domain:
                    continue  # hit belongs to another university — skip
                if ann.url_ko in seen:
                    continue
                seen[ann.url_ko] = Candidate(
                    url_ko=ann.url_ko,
                    proposed_by="naver_search",
                    candidate_title=ann.title_ko,
                )

    candidates = cap_per_university(seen.values(), max_per_university)
    outcomes = await propose(conn, candidates)
    proposed = sum(1 for o in outcomes if o.inserted)
    skipped = len(outcomes) - proposed
    log.info(
        "propose_worker[targeted]: domains=%d searches=%d found=%d kept=%d "
        "proposed=%d skipped=%d search_errors=%d",
        len(domains), searches, len(seen), len(candidates),
        proposed, skipped, search_errors,
    )
    return ProposeRun(
        keywords_searched=searches,
        candidates_seen=len(seen),
        proposed=proposed,
        skipped=skipped,
        search_errors=search_errors,
    )


def _default_search_site(
    http_client: httpx.AsyncClient | None, since: datetime
) -> SearchSiteFn:
    if http_client is None:
        raise RuntimeError(
            "discover_targeted needs an http_client (or an injected search_site fn)"
        )

    async def search(domain: str, keyword: str) -> list[Announcement]:
        adapter = NaverSearchAdapter(
            source_id=uuid4(), keyword=keyword, site=domain, http_client=http_client
        )
        return await adapter.list_recent_posts(since=since)

    return search
