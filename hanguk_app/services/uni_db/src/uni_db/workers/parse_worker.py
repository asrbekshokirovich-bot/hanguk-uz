"""Parse worker — pulls pending guideline_documents and runs extraction.

Plan §F. Phase 0 wiring:

  1. dequeue: read guideline_documents.parse_status='pending' (one row).
  2. classify archetype.
  3. for each field_group: call extract_field_group(...). With
     `UNI_DB_LIVE_APIS=false` this returns deterministic mocks so the
     end-to-end loop runs against fixtures.
  4. validate per-difficulty (plan §F.4).
  5. write extraction_jobs row + (auto-publish OR enqueue review_queue).

The DB write paths take an asyncpg.Connection; tests pass a fake.
"""

from __future__ import annotations

import json
import logging
import re
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Iterable
from uuid import UUID, uuid4

import asyncpg
import jsonschema

from ..config import settings
from ..extract.archetype import (
    ArchetypeFingerprint,
    classify_archetype,
    find_section_offsets,
)
from ..extract.degree_level import DegreeClassification, classify_degree_level
from ..extract.llm_anthropic import ExtractionResult, extract_field_group
from ..extract.validators import evaluate as validate_field
from ..parse.degree_sections import split_by_degree

log = logging.getLogger(__name__)

FIELD_GROUPS = (
    "calendar",
    "tuition",
    "requirements",
    "scholarships",
    "documents_required",
)


@dataclass(frozen=True, slots=True)
class ParseOutcome:
    guideline_document_id: UUID
    archetype: ArchetypeFingerprint
    degree: DegreeClassification
    extraction_results: list[ExtractionResult]
    review_queue_entries: list[dict[str, object]]


def parse_one_document(
    *,
    guideline_document_id: UUID,
    pdf_text_first_pages: str,
    pdf_text_full: str,
    auto_publish: bool | None = None,
) -> ParseOutcome:
    """Pure: returns the outcome without touching the DB.

    The DB-writing wrapper is `persist_outcome`. Tests exercise this
    function directly against fixture text.

    `auto_publish` (defaults to `settings.auto_publish_enabled`) controls the
    gate: when true (the production default) EVERY content-bearing extraction
    is queued as an `approved` item so the publish worker normalizes it without
    a human — low-confidence / difficult-field ones flagged `needs_attention`
    but still published. When false the legacy human-review gate applies (only
    `requires_hitl` items queued as `open`).
    """
    auto = settings.auto_publish_enabled if auto_publish is None else auto_publish
    archetype = classify_archetype(pdf_text_first_pages)
    degree = classify_degree_level(
        first_pages_text=pdf_text_first_pages,
        full_text=pdf_text_full,
    )
    offsets = find_section_offsets(pdf_text_full)

    results: list[ExtractionResult] = []
    review_entries: list[dict[str, object]] = []

    for group in FIELD_GROUPS:
        section_text = _slice_for(pdf_text_full, group, offsets)
        started = time.monotonic()
        try:
            result = extract_field_group(
                field_group=group,
                archetype=archetype.label,
                source_text_ko=section_text,
            )
        except jsonschema.ValidationError as ve:
            log.warning(
                "extract: schema validation failed for %s: %s",
                group, ve.message[:160],
            )
            # Failed extraction → recorded as a failed job (error lane),
            # NOT queued for content review. A human can't review an error;
            # these need a prompt/schema fix + re-extraction (Layer 2).
            results.append(_failed_result(
                group, "claude-sonnet-4-6", violation=ve.message[:500],
                latency_ms=int((time.monotonic() - started) * 1000)))
            continue
        except Exception as exc:
            # API timeout, rate limit, network error, malformed JSON, etc.
            # Don't abort the whole document — log + record failure + next group.
            log.warning(
                "extract: extraction failed for %s: %s: %s",
                group, type(exc).__name__, str(exc)[:160],
            )
            results.append(_failed_result(
                group, "claude-sonnet-4-6",
                violation=f"{type(exc).__name__}: {exc}",
                latency_ms=int((time.monotonic() - started) * 1000)))
            continue

        # If a row's source span was clipped mid-word, the model never saw the
        # full requirement. Re-extract once against a wider window before
        # accepting the truncated row.
        if _looks_truncated(result.parsed_output) and group in offsets:
            wider = _slice_for(pdf_text_full, group, offsets, length=_WIDE_SLICE_LEN)
            if len(wider) > len(section_text):
                try:
                    retry = extract_field_group(
                        field_group=group,
                        archetype=archetype.label,
                        source_text_ko=wider,
                    )
                except Exception as exc:  # keep the original on retry failure
                    log.warning(
                        "extract: truncation retry failed for %s: %s",
                        group, type(exc).__name__,
                    )
                else:
                    if not _looks_truncated(retry.parsed_output):
                        log.info("extract: truncation retry recovered %s", group)
                        result = retry

        results.append(result)

        # Empty extraction (e.g. {"rows": []}) → nothing to review. Don't
        # queue it; an empty result means a thin/wrong source and is handled
        # by re-extraction (Layer 2), not a human reviewer.
        if _is_empty_output(result.parsed_output):
            continue

        verdict = validate_field(
            field_name=_canonical_field_for(group),
            confidence=result.accuracy_self_score,
        )
        entry = _queue_entry_for(group, result, verdict, auto_publish=auto)
        if entry is not None:
            review_entries.append(entry)

    # A single PDF that covers BOTH undergraduate and graduate admission is
    # mis-parsed as one undergraduate document. Flag it (document-level) so a
    # reviewer splits it into separate admission cycles. The split boundaries
    # are computed here for the reviewer/publish layer.
    if degree.is_combined:
        segments = split_by_degree(pdf_text_full)
        seg_desc = ", ".join(
            f"{s.level}@{s.start_offset}" for s in segments
        )
        review_entries.append(
            {
                "entity_type": "guideline_documents",
                "entity_id": guideline_document_id,
                "reason": "high_difficulty_field",
                "priority": 2,
                "field_group": "degree_split",
                "rationale": (
                    "Combined undergraduate + graduate guideline detected "
                    f"({degree.rationale}). Split into separate admission "
                    f"cycles (undergrad → foreign, graduate → grad_foreign). "
                    f"Segments: {seg_desc}."
                ),
            }
        )

    return ParseOutcome(
        guideline_document_id=guideline_document_id,
        archetype=archetype,
        degree=degree,
        extraction_results=results,
        review_queue_entries=review_entries,
    )


def _queue_entry_for(
    group: str,
    result: ExtractionResult,
    verdict,
    *,
    auto_publish: bool,
) -> dict[str, object] | None:
    """Build the review_queue entry for one content-bearing extraction.

    Auto-publish (default): every extraction is queued `approved` so the
    publish worker picks it up with no human. Difficult / low-confidence ones
    are still published, just flagged `needs_attention` for a read-only triage
    view. Legacy mode: only `requires_hitl` items are queued, as `open`.
    """
    score = result.accuracy_self_score
    base: dict[str, object] = {
        "entity_type": "extraction_jobs",
        "entity_id": None,           # filled by persist_outcome
        "field_group": group,
        "rationale": verdict.rationale,
    }

    if not auto_publish:
        # Legacy human-gated: drop high-confidence items, queue the rest as open.
        if not verdict.requires_hitl:
            return None
        return {
            **base,
            "status": "open",
            "needs_attention": False,
            "reason": "low_confidence" if score < 0.85 else "high_difficulty_field",
            "priority": 3 if score >= 0.7 else 2,
        }

    if verdict.requires_hitl:
        # Publish anyway, but flag it for triage.
        return {
            **base,
            "status": "approved",
            "needs_attention": True,
            "reason": "low_confidence" if score < 0.85 else "high_difficulty_field",
            "priority": 3 if score >= 0.7 else 2,
        }

    # Clean, high-confidence → publish without a flag.
    return {
        **base,
        "status": "approved",
        "needs_attention": False,
        "reason": "auto_approved",
        "priority": 5,
    }


async def persist_outcome(
    conn: asyncpg.Connection,
    outcome: ParseOutcome,
) -> None:
    for result in outcome.extraction_results:
        job_id = uuid4()
        job_status = "failed" if _is_failed_output(result.parsed_output) else "succeeded"
        await conn.execute(
            """
            insert into public.extraction_jobs (
              id, guideline_document_id, archetype, field_group,
              status, llm_provider, llm_model, input_tokens, output_tokens,
              cost_usd, latency_ms, accuracy_self_score,
              raw_output, parsed_output, started_at, ended_at, error_text
            ) values (
              $1,$2,$3,$4,
              $16, $5,$6,$7,$8,
              $9,$10,$11,
              $12::jsonb, $13::jsonb, $14, $15, $17
            )
            """,
            job_id,
            outcome.guideline_document_id,
            outcome.archetype.label,
            result.field_group,
            result.llm_provider,
            result.llm_model,
            result.input_tokens,
            result.output_tokens,
            result.cost_usd,
            result.latency_ms,
            result.accuracy_self_score,
            # Wrap raw_output as a JSON-encoded string so the ::jsonb cast
            # accepts arbitrary text (e.g. ```json fences from Claude).
            json.dumps(
                result.raw_output if isinstance(result.raw_output, str)
                else json.dumps(result.raw_output, ensure_ascii=False),
                ensure_ascii=False,
            ),
            json.dumps(result.parsed_output, ensure_ascii=False),
            datetime.now(tz=timezone.utc),
            datetime.now(tz=timezone.utc),
            job_status,
            result.error_text,
        )

        # Belt-and-suspenders: never enqueue an empty or failed extraction for
        # human review (these are handled by the error/refetch lane, not a
        # reviewer). parse_one_document already skips them, but guard here too.
        if _is_failed_output(result.parsed_output) or _is_empty_output(result.parsed_output):
            continue

        # If this group requires HITL, enqueue.
        for entry in outcome.review_queue_entries:
            if entry.get("field_group") == result.field_group:
                # De-dup: supersede any still-open review item for the same
                # (guideline document, field group) so a re-extraction replaces
                # the old card instead of stacking a duplicate next to it.
                await conn.execute(
                    """
                    update public.review_queue
                       set status = 'superseded', resolved_at = now()
                     where status in ('open', 'in_review', 'approved')
                       and published_at is null
                       and entity_type = 'extraction_jobs'
                       and entity_id in (
                         select ej.id from public.extraction_jobs ej
                          where ej.guideline_document_id = $1
                            and ej.field_group = $2
                            and ej.id <> $3
                       )
                    """,
                    outcome.guideline_document_id,
                    result.field_group,
                    job_id,
                )
                status = str(entry.get("status", "open"))
                await conn.execute(
                    """
                    insert into public.review_queue (
                      entity_type, entity_id, reason, priority,
                      reviewer_notes, status, needs_attention, resolved_at
                    ) values ($1,$2,$3,$4,$5,$6,$7,$8)
                    """,
                    "extraction_jobs",
                    job_id,
                    entry["reason"],
                    entry["priority"],
                    entry["rationale"],
                    status,
                    bool(entry.get("needs_attention", False)),
                    datetime.now(tz=timezone.utc)
                    if status in ("approved", "rejected") else None,
                )

    # Document-level review entries (e.g. the combined undergrad+grad split
    # flag) reference the guideline document itself, not an extraction job,
    # so they are inserted once here rather than inside the per-result loop.
    for entry in outcome.review_queue_entries:
        if entry.get("entity_type") == "guideline_documents":
            await conn.execute(
                """
                insert into public.review_queue (
                  entity_type, entity_id, reason, priority, reviewer_notes
                ) values ($1,$2,$3,$4,$5)
                """,
                "guideline_documents",
                outcome.guideline_document_id,
                entry["reason"],
                entry["priority"],
                entry["rationale"],
            )

    await conn.execute(
        """
        update public.guideline_documents
           set parse_status   = 'succeeded',
               parsed_version = parsed_version + 1,
               archetype      = $2
         where id = $1
        """,
        outcome.guideline_document_id,
        outcome.archetype.label,
    )


_SLICE_LEN = 12000
_FALLBACK_LEN = 8000
# A truncation re-extraction reads a wider window so a clipped span (e.g.
# "English Proficiency T") can be recovered in full.
_WIDE_SLICE_LEN = 24000
# When the hard cut lands mid-token, extend up to this many extra chars to
# reach the next whitespace/newline boundary instead of clipping a word.
_BOUNDARY_LOOKAHEAD = 600

# A row's source_text_ko looks truncated when it ends with a short dangling
# alphabetic token after whitespace (e.g. "... Proficiency T"). Numbers
# ("TOPIK 4", "iBT 80") and Korean clause-enders ("...제출") don't match, so
# this is a low-false-positive signal.
_TRUNCATION_RE = re.compile(r"\s[A-Za-z]{1,2}$")


def _slice_for(
    full_text: str, group: str, offsets: dict[str, int], *, length: int = _SLICE_LEN
) -> str:
    if group not in offsets:
        return _extend_to_boundary(full_text, 0, _FALLBACK_LEN)
    start = offsets[group]
    return _extend_to_boundary(full_text, start, length)


def _extend_to_boundary(text: str, start: int, length: int) -> str:
    """Slice ``text[start:start+length]`` but extend the end to the next
    whitespace/newline so we never hand the model a mid-word cut."""
    end = start + length
    if end >= len(text):
        return text[start:]
    window = text[end : end + _BOUNDARY_LOOKAHEAD]
    match = re.search(r"\s", window)
    if match:
        return text[start : end + match.start()]
    return text[start:end]


def _looks_truncated(parsed_output: object) -> bool:
    """True when any row's ``source_text_ko`` ends mid-word (see _TRUNCATION_RE)."""
    if not isinstance(parsed_output, dict):
        return False
    for key in ("rows", "events"):
        rows = parsed_output.get(key)
        if isinstance(rows, list):
            for row in rows:
                if isinstance(row, dict):
                    span = row.get("source_text_ko")
                    if isinstance(span, str) and _TRUNCATION_RE.search(span):
                        return True
    return False


def _failed_result(
    group: str, model: str, *, violation: str, latency_ms: int = 0
) -> ExtractionResult:
    # The error goes in error_text (the dedicated column), NOT buried in
    # raw_output. parsed_output keeps a minimal marker so status detection
    # (_is_failed_output) still routes it to the error lane. raw_output is a
    # valid-but-empty jsonb doc. latency_ms is the real elapsed time.
    return ExtractionResult(
        field_group=group,
        parsed_output={"_extraction_failed": violation},
        raw_output="{}",
        error_text=violation,
        llm_provider="anthropic",
        llm_model=model,
        input_tokens=0,
        output_tokens=0,
        cost_usd=0.0,
        latency_ms=latency_ms,
        accuracy_self_score=0.0,
    )


def _is_failed_output(parsed_output: object) -> bool:
    """An extraction that errored carries an `_extraction_failed` marker."""
    return isinstance(parsed_output, dict) and "_extraction_failed" in parsed_output


def _is_empty_output(parsed_output: object) -> bool:
    """True when an extraction produced no usable content (e.g. {"rows": []}
    or {"events": []}). Empty results mean a thin/wrong source rather than
    something a human can review, so they are not enqueued."""
    if not isinstance(parsed_output, dict) or not parsed_output:
        return True
    if "_extraction_failed" in parsed_output:
        return False  # failed, handled separately
    for value in parsed_output.values():
        if isinstance(value, bool):
            continue
        if isinstance(value, list) and len(value) > 0:
            return False
        if isinstance(value, dict) and value:
            return False
        if isinstance(value, str) and value.strip():
            return False
        if isinstance(value, (int, float)):
            return False
    return True


def _canonical_field_for(group: str) -> str:
    return {
        "calendar":           "application_open_at",     # representative D1 field
        "tuition":            "tuition_per_semester",    # D3
        "requirements":       "topik_required_level",    # D3
        "scholarships":       "scholarships",            # D4
        "documents_required": "documents_required",      # D4
    }.get(group, group)


def iter_field_groups() -> Iterable[str]:
    return iter(FIELD_GROUPS)
