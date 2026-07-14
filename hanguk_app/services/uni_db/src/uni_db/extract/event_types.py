"""Canonical calendar event-type table — ONE source of truth for BOTH lanes.

Phase 3 of the extraction correction plan. The extraction lane
(extract/normalize.py — synonym repair, period derivation) and the
verification lane (verify/checks.py — date-ordering sanity, consensus
signatures) each carried their own copy of the event-type vocabulary, and
they disagreed: checks.py keyed its ordering on `document_submission_deadline`
while normalize.py rewrites that synonym to `documents_deadline`, so the
ordering/consensus gates silently skipped the canonical type. Both lanes now
import THIS table; nothing else may define event-type names.

Pure data / no IO.
"""

from __future__ import annotations

# Allowed calendar event types (mirror of CALENDAR_SCHEMA's enum). Anything
# outside this set is mapped to "other" by the normalize lane.
CALENDAR_EVENT_TYPES: frozenset[str] = frozenset({
    "apply_open", "apply_close",
    "document_submission_deadline", "documents_deadline", "document_submission_close",
    "first_stage_results", "interview", "practical_exam",
    "final_results", "additional_admit", "offer_confirmation",
    "registration_open", "registration_close",
    "registration_withdrawal_open", "registration_withdrawal_close",
    "orientation", "semester_start",
    "scholarship_application_close", "language_test_deadline",
    "other",
})

# event_type variants (schema-valid but unmapped by the review UI, or common
# model paraphrases) → the canonical type. Targets the high-volume cases.
EVENT_TYPE_SYNONYMS: dict[str, str] = {
    "document_submission_deadline": "documents_deadline",
    "documents_submission_deadline": "documents_deadline",
    "document_deadline": "documents_deadline",
    "result_announcement": "final_results",
    "results_announcement": "final_results",
    "final_announcement": "final_results",
    "first_round_results": "first_stage_results",
    "first_stage_announcement": "first_stage_results",
    "application_open": "apply_open",
    "application_start": "apply_open",
    "application_close": "apply_close",
    "application_end": "apply_close",
    "registration_start": "registration_open",
    "registration_end": "registration_close",
}


def canonical_event_type(event_type: object) -> str | None:
    """Map any known synonym onto its canonical event type.

    Unknown strings pass through unchanged (the normalize lane clamps unknowns
    to "other" at its own layer; the verify lane just won't match them).
    Non-strings return None.
    """
    if not isinstance(event_type, str):
        return None
    return EVENT_TYPE_SYNONYMS.get(event_type, event_type)


# Canonical event type → the university_admission_periods field it populates.
# Keys are CANONICAL types — run `canonical_event_type` before looking up, so
# `apply_close` → `application_end` and `document_submission_deadline` →
# `documents_deadline` → `document_deadline` resolve consistently in every
# lane.
EVENT_TO_PERIOD_FIELD: dict[str, str] = {
    "apply_open": "application_start",
    "apply_close": "application_end",
    "documents_deadline": "document_deadline",
    "document_submission_close": "document_deadline",
    "interview": "interview_start",
    "final_results": "result_announcement",
}

# The dated milestones that must occur in this order within one admission
# cycle (canonical names — the verify lane canonicalizes before comparing).
CALENDAR_EVENT_ORDER: tuple[str, ...] = (
    "apply_open",
    "apply_close",
    "documents_deadline",
    "final_results",
)

# The published `periods[]` date fields, in the order they must occur.
PERIOD_FIELD_ORDER: tuple[str, ...] = (
    "application_start",
    "application_end",
    "document_deadline",
    "result_announcement",
)
