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
    SECTION_ANCHORS,
    ArchetypeFingerprint,
    classify_archetype,
)
from ..extract.degree_level import DegreeClassification, classify_degree_level
from ..extract.llm_anthropic import (
    ExtractionResult,
    extract_all_groups,
    extract_field_group,
)
from ..extract.prompt_assembler import _estimate_tokens
from ..extract.validators import evaluate as validate_field
from ..parse.degree_sections import split_by_degree
from ..verify import verify_extraction
from ..verify.engine import ReliabilityReport
from ..watchdog import watchdog

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
    require_approval: bool | None = None,
    verify_level: str | None = None,
    target_year: int | None = None,
    target_term: str | None = None,
    only_groups: Iterable[str] | None = None,
) -> ParseOutcome:
    """Pure: returns the outcome without touching the DB.

    The DB-writing wrapper is `persist_outcome`. Tests exercise this
    function directly against fixture text.

    `auto_publish` (defaults to `settings.auto_publish_enabled`) controls the
    legacy gate. `require_approval` (defaults to `settings.require_approval`)
    is the human-in-front gate: when true, EVERY content-bearing extraction is
    queued as `open` for a staff member to approve, and nothing publishes on its
    own — this overrides `auto_publish`. `verify_level` (defaults to
    `settings.verify_level`) runs the reliability gauntlet (grounding / sanity /
    consensus / adversarial critics) per field group and attaches the
    green/amber/red report to each review card so the reviewer knows where to look.
    `only_groups` restricts extraction to a subset of FIELD_GROUPS (used by
    `retry-failed` to re-run just the groups whose last job failed instead of
    re-billing all five).
    """
    auto = settings.auto_publish_enabled if auto_publish is None else auto_publish
    approve = settings.require_approval if require_approval is None else require_approval
    # effective_verify_level caps the gauntlet at 'balanced' on the claude_cli
    # (subscription) backend so a document doesn't fan out ~35 nested claude calls.
    level = (settings.effective_verify_level if verify_level is None else verify_level).lower()
    year = target_year if target_year is not None else (datetime.now(tz=timezone.utc).year + 1)
    archetype = classify_archetype(pdf_text_first_pages)
    degree = classify_degree_level(
        first_pages_text=pdf_text_first_pages,
        full_text=pdf_text_full,
    )

    results: list[ExtractionResult] = []
    review_entries: list[dict[str, object]] = []

    wanted = None if only_groups is None else set(only_groups)
    groups = FIELD_GROUPS if wanted is None else tuple(
        g for g in FIELD_GROUPS if g in wanted
    )

    # Phase 2: when the whole document fits the token budget, EVERY field
    # group is extracted against the FULL text — the fixed 12k section slice
    # starved groups whose data sits in appendix tables. Oversized documents
    # get the TOC-aware, prefer-last-match anchor slicer instead.
    full_doc = _fits_full_doc(pdf_text_full)
    section_texts = _section_texts(pdf_text_full, groups, full_doc=full_doc)

    # Single-call mode (opt-in): ONE model call returns all requested groups
    # keyed by name. Groups missing from (or invalid in) the combined response
    # fall back to their per-group call below. Needs the full document — the
    # per-group anchor slices can't share one prompt.
    combined: dict[str, ExtractionResult] | None = None
    if settings.extract_single_call and full_doc and len(groups) > 1:
        try:
            combined = extract_all_groups(
                archetype=archetype.label,
                source_text_ko=pdf_text_full,
                groups=groups,
            )
        except Exception as exc:
            log.warning(
                "extract: single-call mode failed (%s: %s); falling back to "
                "per-group calls", type(exc).__name__, str(exc)[:160],
            )
            combined = None

    for group in groups:
        section_text = section_texts[group]
        started = time.monotonic()
        result = combined.get(group) if combined is not None else None
        if result is None:
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
                    group, violation=ve.message[:500],
                    latency_ms=int((time.monotonic() - started) * 1000)))
                continue
            except Exception as exc:
                # API timeout, rate limit, network error, malformed JSON, etc.
                # Don't abort the whole document — log + record failure + next group.
                log.warning(
                    "extract: extraction failed for %s: %s: %s",
                    group, type(exc).__name__, str(exc)[:160],
                )
                # Credit-balance and rejected-key failures are pointless to
                # retry — a human must top up or replace the secret. The
                # watchdog turns the first one into a loud alert.
                watchdog.record_llm_error(str(exc))
                results.append(_failed_result(
                    group,
                    violation=f"{type(exc).__name__}: {exc}",
                    latency_ms=int((time.monotonic() - started) * 1000)))
                # A dead credential fails every remaining group identically.
                # Stop here rather than record four more failures that say the
                # same thing — each one becomes a job a later retry pass picks
                # up and fails again. What was extracted before the break is
                # kept and persisted; the caller checks the same flag and ends
                # the run.
                if watchdog.fatal_alert() is not None:
                    log.error(
                        "extract: aborting document after %s — the credential "
                        "is broken, not this field group", type(exc).__name__,
                    )
                    break
                continue

        # If a row's source span was clipped mid-word, the model never saw the
        # full requirement. Re-extract once against a wider window before
        # accepting the truncated row. (Full-document mode already saw
        # everything, so there is no wider window to retry against.)
        if not full_doc and _looks_truncated(result.parsed_output):
            wider = _anchor_slice(pdf_text_full, group, max_len=_WIDE_SLICE_LEN)
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
                        # Verify against the SAME window the winning extraction
                        # saw, or consensus/critics would false-flag tail rows.
                        section_text = wider

        results.append(result)

        # Run-health signal: too many empty payloads across a run means the
        # sources/prompts are broken, not that the PDFs are thin (Phase 3).
        watchdog.record_payload(empty=_is_empty_output(result.parsed_output))

        # Empty extraction (e.g. {"rows": []}) → nothing to review. Don't
        # queue it; an empty result means a thin/wrong source and is handled
        # by re-extraction (Layer 2), not a human reviewer.
        if _is_empty_output(result.parsed_output):
            continue

        try:
            report = _verify_group(
                group=group,
                archetype=archetype.label,
                primary=result,
                pdf_text_full=pdf_text_full,
                section_text=section_text,
                level=level,
                target_year=year,
                target_term=target_term,
            )
        except Exception as exc:  # verification must never lose a good extraction
            log.warning("verify: gauntlet errored for %s (%s); routing unverified to review",
                        group, type(exc).__name__)
            report = None

        verdict = validate_field(
            field_name=_canonical_field_for(group),
            confidence=result.accuracy_self_score,
        )
        entry = _queue_entry_for(
            group, result, verdict,
            auto_publish=auto, require_approval=approve, report=report,
        )
        if entry is not None:
            review_entries.append(entry)

    # A single PDF that covers BOTH undergraduate and graduate admission is
    # mis-parsed as one undergraduate document. Flag it (document-level) so a
    # reviewer splits it into separate admission cycles. The split boundaries
    # are computed here for the reviewer/publish layer. Skipped on partial
    # (retry-failed) runs — the full parse already flagged it and there is no
    # dedup for document-level entries.
    if degree.is_combined and wanted is None:
        segments = split_by_degree(pdf_text_full)
        seg_desc = ", ".join(
            f"{s.level}@{s.start_offset}" for s in segments
        )
        # Two detectors have to agree before a human is told to split a file.
        #
        # `classify_degree_level` counts SUBSTRINGS over the whole document, so
        # one occurrence of 대학원 anywhere — "대학원 진학 시" in a footnote —
        # sets has_graduate and therefore is_combined. `split_by_degree` looks
        # for section HEADERS and was written precisely to reject that stray
        # mention; its docstring says so. When it returns a single segment
        # there is no boundary in the document, and the card was telling a
        # reviewer to split at a place that does not exist.
        #
        # Measured on this database: of 25 split cards ever raised, 13 carried
        # `Segments: <level>@0.` — one segment, nothing to split — and 11 of
        # those rested on a single grad_general hit with no 석사/박사 anywhere.
        # Roughly half the cards in this category were unactionable.
        #
        # So the header detector decides. When it finds a boundary the card is
        # raised as before, with offsets a reviewer can act on. When it does
        # not, the outcome depends on how specific the other detector's
        # evidence was: a named graduate programme (석사/박사/석박사통합) with
        # no section header is a genuine ambiguity worth a look, while a bare
        # 대학원 mention is a false positive and must not become a card.
        if len(segments) >= 2:
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
        elif degree.has_explicit_graduate_program:
            review_entries.append(
                {
                    "entity_type": "guideline_documents",
                    "entity_id": guideline_document_id,
                    "reason": "high_difficulty_field",
                    "priority": 3,
                    "field_group": "degree_check",
                    "rationale": (
                        "Graduate programme named but no degree section header "
                        f"found ({degree.rationale}). The document may cover one "
                        "level only, or the split heuristic may have missed its "
                        "heading — check before trusting the extracted figures. "
                        "No split boundary was located, so there is nothing to "
                        f"split at. Segments: {seg_desc}."
                    ),
                }
            )
        else:
            log.info(
                "degree: combined signalled but no section boundary and no named "
                "graduate programme for %s (%s) — not raising a split card",
                str(guideline_document_id)[:8], degree.rationale,
            )

    return ParseOutcome(
        guideline_document_id=guideline_document_id,
        archetype=archetype,
        degree=degree,
        extraction_results=results,
        review_queue_entries=review_entries,
    )


def _verify_group(
    *,
    group: str,
    archetype: str,
    primary: ExtractionResult,
    pdf_text_full: str,
    section_text: str,
    level: str,
    target_year: int,
    target_term: str | None,
) -> ReliabilityReport | None:
    """Run the reliability gauntlet for one field group.

    Deterministic gates (grounding-in-source, sanity ranges, consensus diff)
    always run. The LLM judges (grounding, adversarial critics) run at
    `thorough`/`maximum` when live. `maximum` also re-extracts the group
    `consensus_runs` times so the critical fields must agree. Returns None when
    verification is off.
    """
    if level == "off":
        return None
    live = settings.live_apis
    # What the configured level PROMISES. If the promise cannot be kept — a
    # re-extraction throws, or the backend caps the level — the report says so
    # instead of coming out the same colour as a genuinely cross-checked one.
    consensus_expected = level == "maximum" and live and settings.consensus_runs > 1
    runs: list[dict[str, object]] = [primary.parsed_output]
    if level == "maximum" and live:
        for _ in range(max(0, settings.consensus_runs - 1)):
            try:
                extra = extract_field_group(
                    field_group=group, archetype=archetype, source_text_ko=section_text,
                )
            except Exception as exc:  # a failed re-extract just shrinks the vote
                log.warning("verify: consensus re-extract failed for %s: %s",
                            group, type(exc).__name__)
                break
            runs.append(extra.parsed_output)
    use_llm = level in ("thorough", "maximum") and live
    return verify_extraction(
        field_group=group,
        runs=runs,
        pdf_text=pdf_text_full,
        source_text_ko=section_text,
        target_year=target_year,
        target_term=target_term,
        use_grounding_llm=use_llm,
        use_critics=use_llm,
        consensus_expected=consensus_expected,
    )


def group_summary(group: str, parsed: object) -> str:
    """One-line per-group digest (counts + key values) for the review card.

    Lands in review_queue.reviewer_notes so the admin queue can show WHAT was
    extracted (tracks, TOPIK minimums, tuition range, scholarship names, doc
    counts) without opening the raw JSON — previously the notes only carried
    the confidence/reliability verdict, so reviewers effectively only saw
    dates/periods.
    """
    if not isinstance(parsed, dict):
        return ""
    rows = parsed.get("rows") if isinstance(parsed.get("rows"), list) else []
    parts: list[str] = []

    if group == "calendar":
        events = parsed.get("events") if isinstance(parsed.get("events"), list) else []
        periods = parsed.get("periods") if isinstance(parsed.get("periods"), list) else []
        parts.append(f"{len(events)} event(s), {len(periods)} period(s)")
        dates = sorted(
            str(e.get("starts_at"))[:10]
            for e in events
            if isinstance(e, dict) and e.get("starts_at")
        )
        if dates:
            parts.append(f"dates {dates[0]}..{dates[-1]}")
    elif group in ("tuition",):
        amounts = [
            r["amount_krw"] for r in rows
            if isinstance(r, dict) and isinstance(r.get("amount_krw"), (int, float))
        ]
        parts.append(f"{len(rows)} tuition row(s)")
        if amounts:
            parts.append(f"₩{min(amounts):,.0f}–₩{max(amounts):,.0f}")
    elif group in ("requirements", "basic_requirements"):
        parts.append(f"{len(rows)} track(s)")
        topik = [
            r["topik_min_level"] for r in rows
            if isinstance(r, dict) and isinstance(r.get("topik_min_level"), int)
        ]
        if topik:
            parts.append(f"TOPIK min {min(topik)}")
        hours = [
            r["korean_hours_min"] for r in rows
            if isinstance(r, dict) and isinstance(r.get("korean_hours_min"), int)
        ]
        if hours:
            parts.append(f"Korean hours min {min(hours)}")
        majors = {
            m
            for r in rows if isinstance(r, dict) and isinstance(r.get("majors"), list)
            for m in r["majors"] if isinstance(m, str)
        }
        if majors:
            parts.append(f"{len(majors)} major(s)")
    elif group == "scholarships":
        parts.append(f"{len(rows)} scholarship(s)")
        names = [
            r["name_ko"] for r in rows
            if isinstance(r, dict) and isinstance(r.get("name_ko"), str)
        ][:3]
        if names:
            parts.append(", ".join(names))
    elif group in ("documents_required", "document_checklist"):
        parts.append(f"{len(rows)} document(s)")
        names = [
            str(r.get("document_type") or r.get("label_ko") or r.get("document_name_ko") or "")
            for r in rows if isinstance(r, dict)
        ]
        names = [n for n in names if n][:3]
        if names:
            parts.append(", ".join(names))
    else:
        parts.append(f"{len(rows)} row(s)")

    return f"[{group}] " + "; ".join(parts)


def _queue_entry_for(
    group: str,
    result: ExtractionResult,
    verdict,
    *,
    auto_publish: bool,
    require_approval: bool = False,
    report: ReliabilityReport | None = None,
) -> dict[str, object] | None:
    """Build the review_queue entry for one content-bearing extraction.

    require_approval (human-in-front): EVERY extraction waits as `open` for a
    staff member; the reliability report colour sets the priority and the
    `needs_attention` flag (red = look here first). Nothing publishes on its own.

    Auto-publish (legacy default): every extraction is queued `approved` so the
    publish worker picks it up with no human. Legacy human-gate: only
    `requires_hitl` items are queued, as `open`.
    """
    score = result.accuracy_self_score
    color = report.overall if report is not None else None
    rationale = report.to_review_note() if report is not None else verdict.rationale
    # Per-group content summary so the review card shows what was extracted,
    # not only the confidence verdict.
    summary = group_summary(group, result.parsed_output)
    if summary:
        rationale = f"{rationale} | {summary}"
    base: dict[str, object] = {
        "entity_type": "extraction_jobs",
        "entity_id": None,           # filled by persist_outcome
        "field_group": group,
        "rationale": rationale,
    }

    if require_approval:
        # Human-in-front: nothing auto-publishes; everything waits as `open`.
        # `reason` must satisfy the review_queue.reason CHECK constraint, so we
        # use an allowed value and carry the reliability COLOUR out-of-band in
        # reviewer_notes ("[RED]/[AMBER]/[GREEN] …", from report.to_review_note)
        # and the needs_attention flag — which the review UI reads for the badge.
        reason = "high_difficulty_field" if color == "red" else "low_confidence"
        priority = 1 if color == "red" else (2 if color == "amber" else 3)
        return {
            **base,
            "status": "open",
            "needs_attention": color == "red",
            "reason": reason,
            "priority": priority,
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
        # Keys schema-guided pruning stripped are logged onto the job (the
        # dedicated free-text column; the job still succeeds) so drift between
        # the PDFs and our schemas stays visible. The unpruned model output is
        # preserved in raw_output.
        error_text = result.error_text
        if error_text is None and result.dropped_keys:
            error_text = "pruned unknown keys: " + ", ".join(result.dropped_keys)
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
            error_text,
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

# --- Phase 2 anchor slicing (documents over the full-doc token budget) ------
# An anchor window runs from the chosen match to the next section anchor, but
# never shorter than the floor (dense anchor clusters would starve a group)
# nor longer than the cap.
_MAX_ANCHOR_WINDOW = 20_000
_MIN_ANCHOR_WINDOW = 4_000
# ~2 pages of text when the document has no \f page markers to count.
_TOC_CHAR_FALLBACK = 4_000
# Groups whose data commonly lives in appendix tables at the END of the
# document (등록금 납부 안내 / 장학 제도 / 제출서류 별표). With no usable
# anchor, their fallback scans from the document end, not the head.
_APPENDIX_GROUPS = frozenset({"tuition", "scholarships", "documents_required"})
_TAIL_FALLBACK_LEN = 16_000
# A table-of-contents line: dot/middle-dot leaders running into a page number
# ("제출서류 ·········· 12"). Anchor matches on such lines are TOC noise.
_DOT_LEADER_RE = re.compile(r"(?:[.·•‥…]\s*){4,}\d{1,3}\s*$")


def _fits_full_doc(full_text: str) -> bool:
    """True when the whole document fits the full-text extraction budget."""
    return _estimate_tokens(full_text) <= settings.extract_fulldoc_token_budget


def _section_texts(
    full_text: str, groups: Iterable[str], *, full_doc: bool | None = None
) -> dict[str, str]:
    """The source text each field group is extracted against (Phase 2).

    Within the token budget every group gets the FULL text; above it, each
    group gets its anchor window (see `_anchor_slice`).
    """
    fits = _fits_full_doc(full_text) if full_doc is None else full_doc
    if fits:
        return {g: full_text for g in groups}
    return {g: _anchor_slice(full_text, g) for g in groups}


def _toc_boundary(text: str) -> int:
    """Offset where the first two pages end (TOC territory).

    PyMuPDF's get_text uses \\f between pages; without page markers, fall back
    to a fixed char count.
    """
    idx = -1
    for _ in range(2):
        idx = text.find("\f", idx + 1)
        if idx == -1:
            return min(len(text), _TOC_CHAR_FALLBACK)
    return idx


def _is_toc_match(text: str, pos: int, toc_end: int) -> bool:
    """A match is TOC noise when it sits in the first two pages or on a
    dot-leader line (heading ····· page-number)."""
    if pos < toc_end:
        return True
    line_start = text.rfind("\n", 0, pos) + 1
    line_end = text.find("\n", pos)
    if line_end == -1:
        line_end = len(text)
    return bool(_DOT_LEADER_RE.search(text[line_start:line_end]))


# Matches closer together than this belong to the same section run: an anchor
# word recurs constantly INSIDE its own section body (등록금 appears on every
# tuition-table row), so "last match" must mean "last cluster", not the last
# raw occurrence at the section's tail.
_ANCHOR_CLUSTER_GAP = 2_000


def _next_anchor_after(text: str, pos: int, *, exclude_group: str) -> int:
    """Start of the nearest OTHER section's anchor after `pos`, or EOF.

    The group's own pattern is excluded — its anchor word repeating inside its
    own body must not terminate the window one row in.
    """
    nearest = len(text)
    for name, pattern in SECTION_ANCHORS.items():
        if name == exclude_group:
            continue
        m = pattern.search(text, pos + 1)
        if m and m.start() < nearest:
            nearest = m.start()
    return nearest


def _anchor_slice(
    full_text: str, group: str, *, max_len: int = _MAX_ANCHOR_WINDOW
) -> str:
    """Anchor window for one group in an over-budget document.

    All anchor matches are collected (finditer), TOC hits are dropped (first
    two pages / dot-leader lines), and the LAST match CLUSTER wins — the real
    detail/appendix table sits later in the document than the early summary
    mentions the old first-match logic latched onto. The window starts at the
    last cluster's FIRST match (its section heading) and runs to the next
    OTHER-group anchor (floored/capped, word-boundary extended). With no
    usable match, appendix-style groups (tuition / scholarships /
    documents_required) scan from the document END; the rest keep the head
    fallback.
    """
    pattern = SECTION_ANCHORS.get(group)
    toc_end = _toc_boundary(full_text)
    starts = (
        [
            m.start()
            for m in pattern.finditer(full_text)
            if not _is_toc_match(full_text, m.start(), toc_end)
        ]
        if pattern is not None
        else []
    )
    if not starts:
        if group in _APPENDIX_GROUPS:
            return full_text[max(0, len(full_text) - _TAIL_FALLBACK_LEN):]
        return _extend_to_boundary(full_text, 0, _FALLBACK_LEN)
    # First match of the last cluster = the heading of the last section run.
    start = starts[0]
    prev = starts[0]
    for s in starts[1:]:
        if s - prev > _ANCHOR_CLUSTER_GAP:
            start = s
        prev = s
    end = _next_anchor_after(full_text, start, exclude_group=group)
    length = min(max(end - start, _MIN_ANCHOR_WINDOW), max_len)
    return _extend_to_boundary(full_text, start, length)

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


def _current_llm_provider() -> str:
    """The provider a live extraction call would actually use right now."""
    if not settings.live_apis:
        return "mock"
    return "claude_cli" if settings.llm_backend == "claude_cli" else "anthropic"


def _failed_result(
    group: str, model: str | None = None, *, violation: str, latency_ms: int = 0
) -> ExtractionResult:
    # The error goes in error_text (the dedicated column), NOT buried in
    # raw_output. parsed_output keeps a minimal marker so status detection
    # (_is_failed_output) still routes it to the error lane. raw_output is a
    # valid-but-empty jsonb doc. latency_ms is the real elapsed time.
    # llm_provider/llm_model reflect the CONFIGURED backend (previously
    # hardcoded to anthropic/claude-sonnet-4-6, which mislabelled every
    # claude_cli-lane failure).
    return ExtractionResult(
        field_group=group,
        parsed_output={"_extraction_failed": violation},
        raw_output="{}",
        error_text=violation,
        llm_provider=_current_llm_provider(),
        llm_model=model or settings.anthropic_model_extract,
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
