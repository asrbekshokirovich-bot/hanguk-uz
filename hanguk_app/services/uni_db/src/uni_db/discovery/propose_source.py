"""Auto-propose new sources from discovery search hits.

Phase 2-D3 (plan §E.4 + audit §6.9). When the discovery layer's Naver
search adapter (or okep / Adiga / Google PSE upstream) finds a URL
that:
  * has not been seen before in `announcement_sources`,
  * has not already been proposed (or rejected) in `proposed_sources`,
  * passes the `keywords_ko.matches_admission_signal()` check,
the worker writes a row to `proposed_sources` with status
`pending_review`. The HITL reviewer (ADR-005) approves or rejects
in the v_proposed_sources_queue view.

The trigger `trg_proposed_source_promote` (Phase 2 migration) handles
the `approved → promoted` flow, so this module's only job is the
gate-and-insert.

Phase 2 status: pure SQL writer; live calls are real but the discovery
adapters they're called from stay fixture-driven.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Iterable, Literal
from uuid import UUID

import asyncpg

from .keywords_ko import (
    PRIMARY_KEYWORDS_KO,
    is_disallowed_url,
    matches_admission_signal,
)

log = logging.getLogger(__name__)

ProposedBy = Literal[
    "naver_search", "google_pse", "okep_upstream", "adiga_upstream", "manual"
]
SourceType = Literal[
    "university_admission_board",
    "university_oia_board",
    "moe_okep",
    "adiga",
    "study_in_korea",
    "niied",
    "other_korean",
]


@dataclass(frozen=True, slots=True)
class Candidate:
    url_ko: str
    proposed_by: ProposedBy
    candidate_title: str | None = None
    candidate_snippet: str | None = None
    source_type: SourceType = "other_korean"


@dataclass(frozen=True, slots=True)
class ProposeOutcome:
    inserted: bool
    reason: str
    proposed_id: UUID | None = None


# ---------------------------------------------------------------------------
# Pure helpers — no DB IO.
# ---------------------------------------------------------------------------


def matched_keywords_for(text: str) -> tuple[str, ...]:
    """Return all PRIMARY_KEYWORDS_KO that fire against `text`.

    The count is the priority signal in `v_proposed_sources_queue`:
      3+ matches → priority 1
      2  matches → priority 2
      1  match   → priority 3
    """
    return tuple(kw for kw in PRIMARY_KEYWORDS_KO if kw in text)


def evaluate_candidate(c: Candidate) -> tuple[bool, str, tuple[str, ...]]:
    """Return (should_propose, reason, matched_keywords).

    Deterministic — easy to unit-test without a DB.
    """
    if not c.url_ko:
        return False, "empty url_ko", tuple()

    if is_disallowed_url(c.url_ko):
        return False, "disallowed URL (English mirror or non-ac.kr)", tuple()

    title_blob = (c.candidate_title or "") + " " + (c.candidate_snippet or "")
    if not matches_admission_signal(title_blob.strip(), []):
        return False, "no admission keyword in title/snippet", tuple()

    matched = matched_keywords_for(title_blob)
    return True, f"matched {len(matched)} keyword(s)", matched


# ---------------------------------------------------------------------------
# Persistence layer.
# ---------------------------------------------------------------------------


_INSERT_SQL = """
insert into public.proposed_sources (
  url_ko, source_type, proposed_by,
  candidate_title, candidate_snippet, matched_keywords
) values (
  $1, $2, $3, $4, $5,
  (select array_agg(v) from jsonb_array_elements_text($6::jsonb) v)
)
on conflict (url_ko) do update
  set candidate_title   = coalesce(public.proposed_sources.candidate_title,
                                   excluded.candidate_title),
      candidate_snippet = coalesce(public.proposed_sources.candidate_snippet,
                                   excluded.candidate_snippet),
      matched_keywords  = excluded.matched_keywords
returning id
"""

_ALREADY_LIVE_SQL = """
select 1 from public.announcement_sources where url_ko = $1
"""


async def propose(
    conn: asyncpg.Connection,
    candidate: Candidate,
) -> ProposeOutcome:
    """Insert a candidate into proposed_sources if it passes the gate.

    Idempotent — `unique(url_ko)` + `on conflict do update` means
    re-proposing the same URL refreshes the snippet/keywords without
    creating duplicates.
    """
    should, reason, matched = evaluate_candidate(candidate)
    if not should:
        return ProposeOutcome(inserted=False, reason=reason)

    # Skip if already in announcement_sources (already approved / live).
    already_live = await conn.fetchval(_ALREADY_LIVE_SQL, candidate.url_ko)
    if already_live:
        return ProposeOutcome(
            inserted=False, reason="url already in announcement_sources"
        )

    new_id = await conn.fetchval(
        _INSERT_SQL,
        candidate.url_ko,
        candidate.source_type,
        candidate.proposed_by,
        candidate.candidate_title,
        candidate.candidate_snippet,
        # jsonb text, not a raw Python list: the HTTP db-exec transport
        # JSON-encodes list params, which Postgres can't read back as a
        # native array literal directly (see publish_worker._j / ADR — the
        # scholarships.applicant_categories fix for the same root cause).
        json.dumps(list(matched), ensure_ascii=False),
    )
    if new_id is None:
        # `trg_proposed_sources_block_host` returns NULL for a host on
        # `blocked_link_hosts`, so the insert is skipped and `returning id`
        # yields nothing. Reporting that as inserted=True would put a
        # phantom `id=None` line in the discovery log for every blocked
        # candidate of every sweep.
        log.info(
            "proposed_source: %s is on a blocked host; skipped", candidate.url_ko
        )
        return ProposeOutcome(inserted=False, reason="host is blocked")
    log.info(
        "proposed_source: id=%s url=%s by=%s matches=%d",
        new_id,
        candidate.url_ko,
        candidate.proposed_by,
        len(matched),
    )
    return ProposeOutcome(inserted=True, reason=reason, proposed_id=new_id)


async def propose_batch(
    conn: asyncpg.Connection,
    candidates: Iterable[Candidate],
) -> list[ProposeOutcome]:
    """Convenience wrapper for the discovery worker's per-search-result loop."""
    out: list[ProposeOutcome] = []
    for c in candidates:
        out.append(await propose(conn, c))
    return out


def candidate_to_jsonable(c: Candidate) -> dict[str, object]:
    """Useful for logging / structured events."""
    return {
        "url_ko": c.url_ko,
        "proposed_by": c.proposed_by,
        "source_type": c.source_type,
        "title": c.candidate_title,
        "snippet": c.candidate_snippet,
    }


# Re-export for telemetry consumers.
__all__ = [
    "Candidate",
    "ProposeOutcome",
    "candidate_to_jsonable",
    "evaluate_candidate",
    "matched_keywords_for",
    "propose",
    "propose_batch",
]


def _debug_jsonl(candidates: Iterable[Candidate]) -> str:  # pragma: no cover
    """Local-debug: dump candidates as JSONL for eyeballing."""
    return "\n".join(json.dumps(candidate_to_jsonable(c)) for c in candidates)
