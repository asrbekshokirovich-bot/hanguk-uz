"""Publish worker — approved review items → the public tables the app reads.

The pipeline extracts admission data into `extraction_jobs.parsed_output` and a
reviewer approves it in `review_queue`, but `fn_review_accept` only flips the
status — nothing was ever written to the normalized public tables
(`requirements`, `tuition`, `scholarships`, `university_admission_periods`,
`documents_required`). So applicants saw nothing. This worker closes that gap:
for each **approved, not-yet-published** review item it normalizes the (possibly
reviewer-edited) JSON into the matching public table.

Design (per the comparative study of UCAS / Common App / uni-assist / Common Data
Set):
  * Cycle-scoped: `requirements` and `documents_required` hang off an
    `admission_cycles` row (year + term + track + audience). The worker
    get-or-creates that cycle, links it to the source `guideline_document`
    (provenance), and leaves it `status='unverified'` so the inferred
    year/term/track gets a human check.
  * Provenance: every published row keeps its Korean `source_text_ko`; the cycle
    carries `guideline_document_id` → the original 모집요강.
  * Idempotent: `review_queue.published_at` marks done, so re-runs are safe and
    each newly-approved item is picked up automatically.

Inference is deterministic and conservative so all field groups of one document
converge on a single cycle. The DB connection is injectable so the mapping
unit-tests without a database.
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Any
from uuid import UUID

import asyncpg

log = logging.getLogger(__name__)

# Map the extracted `audience` to an admission_cycles.cycle_track CHECK value.
# Only the confident mappings live here; everything else falls through to the
# category-text heuristic in track_for() and finally the foreign default.
_AUDIENCE_TO_TRACK: dict[str, str] = {
    "foreign": "foreign",
    "overseas_korean": "overseas_korean_full",
}
_DEFAULT_TRACK = "foreign"
_DEFAULT_CATEGORY = "외국인전형"
_YEAR_RE = re.compile(r"(?<!\d)(20[2-3][0-9])(?!\d)")
# Past-cycle staleness signal. `_ANY_YEAR_RE` reads years out of the payload
# with a strict word boundary (so IDs / phone numbers don't read as years);
# `_URL_YEAR_RE` is lenient for source filenames, where the cycle is often
# concatenated with the term (cdu's '...guidebook_20171...' = 2017, term 1).
_ANY_YEAR_RE = re.compile(r"(?<!\d)(20[0-3][0-9])(?!\d)")
_URL_YEAR_RE = re.compile(r"(20[0-3][0-9])")
_FALL_HINTS = ("후기", "9월", "가을", "fall", "9 월")


@dataclass(frozen=True, slots=True)
class PublishRun:
    approved_seen: int
    published: int          # review items normalized into a public table
    rows_written: int       # individual rows inserted across all tables
    skipped: int            # empty/failed payloads, or unknown field group
    held: int               # approved but withheld — source is a past cycle
    errors: int


# --------------------------------------------------------------------------- #
# pure helpers (no DB)
# --------------------------------------------------------------------------- #

def _payload(record: Any) -> dict:
    """The data to publish: reviewer's edited version if present, else the raw
    extraction. Both are jsonb (asyncpg returns them as str or dict)."""
    raw = record["reviewer_decision"] or record["parsed_output"]
    if isinstance(raw, str):
        raw = json.loads(raw or "{}")
    return raw if isinstance(raw, dict) else {}


def _rows(payload: dict) -> list[dict]:
    rows = payload.get("rows")
    return [r for r in rows if isinstance(r, dict)] if isinstance(rows, list) else []


def _is_unpublishable(payload: dict) -> bool:
    return "_extraction_failed" in payload or (not _rows(payload)
                                               and not payload.get("events")
                                               and not payload.get("periods"))


def _as_date(value: object) -> date | None:
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        return date.fromisoformat(value[:10])
    except ValueError:
        return None


def _j(value: object) -> str | None:
    """JSON-encode for a `$n::jsonb` param (asyncpg has no jsonb codec here)."""
    return json.dumps(value, ensure_ascii=False) if value not in (None, {}, []) else None


def _arr(value: object) -> list | None:
    return value if isinstance(value, list) else None


def infer_year(payload: dict, *, default: int) -> int:
    blob = json.dumps(payload, ensure_ascii=False)
    years = [int(y) for y in _YEAR_RE.findall(blob)]
    years = [y for y in years if 2024 <= y <= 2031]
    return max(years) if years else default


def _min_publishable_year() -> int:
    """Cycle floor. Data whose newest detected admission year is below the
    current calendar year is a past cycle and must not reach applicants as if
    current (the audit found a 2017 guidebook and several 2022 cycles approved)."""
    return datetime.now(tz=timezone.utc).year


def detected_years(payload: dict, source_url: object) -> list[int]:
    """Every plausible admission year mentioned in the payload or the source
    document URL/filename (e.g. cdu's '...guidebook_20171...' → 2017)."""
    years = [int(y) for y in _ANY_YEAR_RE.findall(json.dumps(payload, ensure_ascii=False))]
    if isinstance(source_url, str):
        years += [int(y) for y in _URL_YEAR_RE.findall(source_url)]
    return years


def is_stale_cycle(payload: dict, source_url: object, *, floor: int) -> bool:
    """True only on a positive past-cycle signal: the newest year we can find is
    below `floor`. Undated payloads (no year anywhere) are NOT stale — they fall
    through to the normal unverified-cycle path for human year confirmation, so
    genuinely-current data that simply omits a year still publishes."""
    years = detected_years(payload, source_url)
    return bool(years) and max(years) < floor


def infer_term(payload: dict) -> str:
    blob = json.dumps(payload, ensure_ascii=False).lower()
    return "fall" if any(h in blob for h in _FALL_HINTS) else "spring"


def program_level_for(value: object) -> str:
    """Map an extracted program level to a university_admission_periods.program_level
    CHECK value ('undergraduate' | 'graduate' | 'both'). The extractor emits finer
    levels (master/doctoral/phd) that the table doesn't model, so collapse them to
    'graduate' — otherwise the row violates the CHECK and the whole calendar item
    fails to publish (audit: Ewha/KHU graduate periods looped as publish errors)."""
    v = value.strip().lower() if isinstance(value, str) else ""
    if v in ("undergraduate", "graduate", "both"):
        return v
    if v in ("master", "masters", "doctoral", "doctorate", "phd", "graduate_school",
             "grad", "master_doctoral", "integrated"):
        return "graduate"
    return "undergraduate"


def language_track_for(value: object) -> str | None:
    """Clamp to the language_track CHECK ('korean' | 'english' | 'both'); anything
    else (incl. null) becomes NULL so it never blocks a publish."""
    v = value.strip().lower() if isinstance(value, str) else ""
    return v if v in ("korean", "english", "both") else None


def first_doc_name(row: dict) -> str:
    for k in ("document_type", "document_name_ko", "name_ko", "label_ko", "name_en"):
        v = row.get(k)
        if isinstance(v, str) and v.strip():
            return v.strip()
    return "서류"


def track_for(audience: object, category_text: object) -> str:
    """Resolve a row to an admission_cycles.cycle_track. Prefer the extracted
    `audience`; otherwise read the applicant-category text; else foreign. This is
    what keeps 재외국민 / 편입학 / 대학원 rows out of the plain foreign track so the
    app never shows another audience's rules to a foreign applicant."""
    a = audience.strip().lower() if isinstance(audience, str) else ""
    if a in _AUDIENCE_TO_TRACK:
        return _AUDIENCE_TO_TRACK[a]
    cat = category_text if isinstance(category_text, str) else ""
    if "재외국민" in cat:
        return "overseas_korean_full"
    if "편입" in cat:
        return "transfer"
    if "대학원" in cat or "대학원" in a:
        return "grad_foreign"
    return _DEFAULT_TRACK


def category_for(row: dict) -> str:
    cat = row.get("applicant_category")
    return cat.strip() if isinstance(cat, str) and cat.strip() else _DEFAULT_CATEGORY


# --------------------------------------------------------------------------- #
# DB ops
# --------------------------------------------------------------------------- #

_FETCH_SQL = """
select rq.id            as queue_id,
       rq.reviewer_decision,
       rq.needs_attention,
       rq.reviewer_notes as attention_reason,
       ej.field_group,
       ej.parsed_output,
       ej.accuracy_self_score,
       ej.guideline_document_id,
       gd.institution_id,
       gd.source_url_ko
  from public.review_queue rq
  join public.extraction_jobs ej     on ej.id = rq.entity_id
  join public.guideline_documents gd on gd.id = ej.guideline_document_id
 where rq.status = 'approved'
   and rq.published_at is null
   and rq.entity_type = 'extraction_jobs'
   and gd.institution_id is not null
 order by rq.resolved_at asc nulls last
 limit $1
"""


async def get_or_create_cycle(
    conn: asyncpg.Connection,
    *,
    institution_id: UUID,
    guideline_document_id: UUID,
    intake_year: int,
    intake_term: str,
    cycle_track: str,
    applicant_category: str,
    needs_attention: bool = False,
    attention_reason: str | None = None,
) -> UUID:
    return await conn.fetchval(
        """
        insert into public.admission_cycles
          (institution_id, intake_year, intake_term, cycle_track, round_number,
           applicant_category, guideline_document_id, status,
           needs_attention, attention_reason)
        values ($1,$2,$3,$4,1,$5,$6,'unverified',$7,$8)
        on conflict (institution_id, intake_year, intake_term, cycle_track,
                     round_number, applicant_category)
          do update set guideline_document_id = excluded.guideline_document_id,
                        needs_attention = admission_cycles.needs_attention
                                          or excluded.needs_attention,
                        attention_reason = coalesce(admission_cycles.attention_reason,
                                                    excluded.attention_reason),
                        updated_at = now()
        returning id
        """,
        institution_id, intake_year, intake_term, cycle_track,
        applicant_category, guideline_document_id,
        needs_attention, attention_reason,
    )


async def _publish_tuition(conn, rec, payload) -> int:
    n = 0
    for r in _rows(payload):
        amount = r.get("amount_krw")
        if amount is None:
            continue
        sem = r.get("semester_number") or 1
        await conn.execute(
            """insert into public.tuition (institution_id, faculty_group, academic_year,
                 semester_number, amount_krw, admission_fee_krw, is_first_semester,
                 source_text_ko, extractor_confidence, needs_attention, attention_reason)
               values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)""",
            rec["institution_id"], r.get("faculty_group") or "전체",
            r.get("academic_year") or rec["_year"], sem, amount,
            r.get("admission_fee_krw"), bool(r.get("is_first_semester", sem == 1)),
            r.get("source_text_ko"), r.get("extractor_confidence"),
            bool(rec.get("_na", False)), rec.get("_ar"),
        )
        n += 1
    return n


def _is_empty_scholarship(row: dict) -> bool:
    """An 'other'-type row with no award value and no tier table carries nothing
    actionable — it's how the extractor packages 'this guideline lists no
    scholarships' (audit: hanseo's lone scholarship row). Don't publish an empty
    card a user would tap into and find nothing."""
    return (
        row.get("award_type") == "other"
        and row.get("award_value") in (None, 0)
        and not row.get("topik_tier_table")
        and not row.get("ielts_tier_table")
    )


async def _publish_scholarships(conn, rec, payload) -> int:
    n = 0
    for r in _rows(payload):
        if not (r.get("scope") and r.get("name_ko") and r.get("award_type")):
            continue
        if _is_empty_scholarship(r):
            continue
        await conn.execute(
            """insert into public.scholarships (institution_id, scope, name_ko, name_en,
                 award_type, award_value, applicant_categories, topik_tier_table,
                 ielts_tier_table, eligibility_predicate, prose_ko, source_text_ko,
                 extractor_confidence, needs_attention, attention_reason)
               values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11,$12,$13,$14,$15)""",
            rec["institution_id"], r["scope"], r["name_ko"], r.get("name_en"),
            r["award_type"], r.get("award_value"),
            _arr(r.get("applicant_categories")), _j(r.get("topik_tier_table")),
            _j(r.get("ielts_tier_table")), _j(r.get("eligibility_predicate")),
            r.get("prose_ko"), r.get("source_text_ko"), r.get("extractor_confidence"),
            bool(rec.get("_na", False)), rec.get("_ar"),
        )
        n += 1
    return n


async def _row_cycle(conn, rec, row: dict) -> UUID:
    """Resolve the admission cycle for one row by its audience/category, so a
    foreign requirement and a 재외국민 requirement in the same document land in
    different cycles (and the app can filter correctly)."""
    category = category_for(row)
    return await get_or_create_cycle(
        conn,
        institution_id=rec["institution_id"],
        guideline_document_id=rec["guideline_document_id"],
        intake_year=rec["_year"],
        intake_term=rec["_term"],
        cycle_track=track_for(row.get("audience"), category),
        applicant_category=category,
        needs_attention=bool(rec.get("_na", False)),
        attention_reason=rec.get("_ar"),
    )


async def _publish_requirements(conn, rec, payload) -> int:
    n = 0
    for r in _rows(payload):
        cycle_id = await _row_cycle(conn, rec, r)
        await conn.execute(
            """insert into public.requirements (cycle_id, applicant_category,
                 topik_min_level, topik_deferred, english_test, gpa_floor_pct,
                 interview_required, practical_exam_required, prose_ko,
                 source_text_ko, extractor_confidence, needs_attention, attention_reason)
               values ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11,$12,$13)""",
            cycle_id, category_for(r),
            r.get("topik_min_level"), bool(r.get("topik_deferred", False)),
            _j(r.get("english_test")), r.get("gpa_floor_pct"),
            bool(r.get("interview_required", False)),
            bool(r.get("practical_exam_required", False)),
            r.get("prose_ko"), r.get("source_text_ko"), r.get("extractor_confidence"),
            bool(rec.get("_na", False)), rec.get("_ar"),
        )
        n += 1
    return n


async def _publish_documents(conn, rec, payload) -> int:
    n = 0
    for r in _rows(payload):
        cycle_id = await _row_cycle(conn, rec, r)
        await conn.execute(
            """insert into public.documents_required (cycle_id, applicant_category,
                 document_type, is_required, is_apostille_required, country_specific,
                 notes_ko, source_text_ko, needs_attention, attention_reason)
               values ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10)""",
            cycle_id, category_for(r),
            first_doc_name(r), bool(r.get("is_required", True)),
            bool(r.get("is_apostille_required") or r.get("is_notarization_required") or False),
            _j(r.get("country_specific")), r.get("notes_ko"), r.get("source_text_ko"),
            bool(rec.get("_na", False)), rec.get("_ar"),
        )
        n += 1
    return n


async def _publish_calendar(conn, rec, payload) -> int:
    periods = payload.get("periods")
    periods = periods if isinstance(periods, list) else []
    semester = rec["_term"]
    n = 0
    for p in periods:
        if not isinstance(p, dict):
            continue
        await conn.execute(
            """insert into public.university_admission_periods (institution_id,
                 semester, year, program_level, language_track,
                 application_start, application_end, document_deadline,
                 result_announcement, online_application_start, online_application_end,
                 offline_application_start, offline_application_end,
                 interview_start, interview_end, application_fee_krw, application_fee_usd,
                 needs_attention, attention_reason)
               values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
               on conflict (institution_id, semester, year, program_level, language_track)
               do update set
                 application_start = excluded.application_start,
                 application_end = excluded.application_end,
                 document_deadline = excluded.document_deadline,
                 result_announcement = excluded.result_announcement,
                 online_application_start = excluded.online_application_start,
                 online_application_end = excluded.online_application_end,
                 offline_application_start = excluded.offline_application_start,
                 offline_application_end = excluded.offline_application_end,
                 interview_start = excluded.interview_start,
                 interview_end = excluded.interview_end,
                 application_fee_krw = excluded.application_fee_krw,
                 application_fee_usd = excluded.application_fee_usd,
                 needs_attention = excluded.needs_attention,
                 attention_reason = excluded.attention_reason,
                 updated_at = now()""",
            rec["institution_id"], semester, rec["_year"],
            program_level_for(p.get("program_level")), language_track_for(p.get("language_track")),
            _as_date(p.get("application_start")), _as_date(p.get("application_end")),
            _as_date(p.get("document_deadline")), _as_date(p.get("result_announcement")),
            _as_date(p.get("online_application_start")), _as_date(p.get("online_application_end")),
            _as_date(p.get("offline_application_start")), _as_date(p.get("offline_application_end")),
            _as_date(p.get("interview_start")), _as_date(p.get("interview_end")),
            p.get("application_fee_krw"), p.get("application_fee_usd"),
            bool(rec.get("_na", False)), rec.get("_ar"),
        )
        n += 1
    return n


_PUBLISHERS = {
    "tuition": _publish_tuition,
    "scholarships": _publish_scholarships,
    "requirements": _publish_requirements,
    "basic_requirements": _publish_requirements,
    "documents_required": _publish_documents,
    "document_checklist": _publish_documents,
    "calendar": _publish_calendar,
}


async def publish_pending(conn: asyncpg.Connection, *, limit: int = 200) -> PublishRun:
    """Normalize approved, not-yet-published review items into the public tables."""
    records = await conn.fetch(_FETCH_SQL, limit)
    log.info("publish_worker: %d approved item(s) to publish", len(records))
    published = rows_written = skipped = held = errors = 0
    default_year = datetime.now(tz=timezone.utc).year + 1
    floor = _min_publishable_year()
    for rec in records:
        rec = dict(rec)
        payload = _payload(rec)
        publisher = _PUBLISHERS.get(rec["field_group"])
        if publisher is None or _is_unpublishable(payload):
            skipped += 1
            await _mark_published(conn, rec["queue_id"])  # nothing to do, don't re-scan
            continue
        if is_stale_cycle(payload, rec.get("source_url_ko"), floor=floor):
            held += 1
            log.info("publish_worker: HOLD %s (%s) — past-cycle source (newest %d < %d)",
                     str(rec["queue_id"])[:8], rec["field_group"],
                     max(detected_years(payload, rec.get("source_url_ko"))), floor)
            await _mark_published(conn, rec["queue_id"])  # processed; re-ingest brings a fresh cycle
            continue
        rec["_year"] = infer_year(payload, default=default_year)
        rec["_term"] = infer_term(payload)
        # Auto-gate flag (from review_queue) carried onto every published row.
        rec["_na"] = bool(rec.get("needs_attention", False))
        rec["_ar"] = rec.get("attention_reason")
        try:
            n = await publisher(conn, rec, payload)
        except Exception as exc:  # one bad item must not abort the batch
            errors += 1
            log.warning("publish_worker: %s (%s) failed: %s: %s",
                        str(rec["queue_id"])[:8], rec["field_group"],
                        type(exc).__name__, str(exc)[:160])
            continue
        await _mark_published(conn, rec["queue_id"])
        published += 1
        rows_written += n
        log.info("publish_worker: %s %s → %d row(s)",
                 str(rec["queue_id"])[:8], rec["field_group"], n)
    return PublishRun(
        approved_seen=len(records), published=published,
        rows_written=rows_written, skipped=skipped, held=held, errors=errors,
    )


async def _mark_published(conn: asyncpg.Connection, queue_id: UUID) -> None:
    await conn.execute(
        "update public.review_queue set published_at = now() where id = $1", queue_id
    )
