"""Layered admission-relevance classifier.

Audit §6.6:
  1. Hard rules (keyword match in title) — handled by keywords_ko.
  2. Attachment heuristic — handled by keywords_ko.matches_admission_signal.
  3. Embedding similarity — Phase 2+.
  4. LLM tiebreaker — Phase 2+ via Claude Haiku, gated behind settings.live_apis.

Phase 0 implements layers 1 and 2; layers 3 and 4 expose mock entry points
so the discovery worker can call them without paying for tokens.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from .keywords_ko import is_correction_notice, matches_admission_signal
from .models import Announcement

ClassifierLabel = Literal[
    "admission_announcement",
    "correction_notice",
    "schedule_change",
    "additional_recruitment",
    "results_announcement",
    "other",
    "unknown",
]


@dataclass(frozen=True, slots=True)
class Classification:
    label: ClassifierLabel
    confidence: float
    rationale: str


def classify(announcement: Announcement) -> Classification:
    """Run layers 1 + 2 only. Returns 'unknown' when neither fires.

    The discovery worker uses `Classification.label='unknown'` as a signal
    to enqueue the row to layer 4 (LLM tiebreaker), which is currently a
    stub returning the same input unchanged.
    """
    title = announcement.title_ko
    if is_correction_notice(title):
        return Classification(
            label="correction_notice",
            confidence=0.97,
            rationale="title contains correction-notice keyword",
        )
    attachments = [a.filename for a in announcement.attachments]
    if matches_admission_signal(title, attachments):
        if "추가모집" in title:
            return Classification(
                label="additional_recruitment",
                confidence=0.92,
                rationale="title contains 추가모집",
            )
        if "합격자발표" in title or "합격자 발표" in title:
            return Classification(
                label="results_announcement",
                confidence=0.92,
                rationale="title contains 합격자발표",
            )
        if "일정변경" in title:
            return Classification(
                label="schedule_change",
                confidence=0.95,
                rationale="title contains 일정변경",
            )
        return Classification(
            label="admission_announcement",
            confidence=0.88,
            rationale="hard-rule keyword + valid attachment",
        )
    return Classification(label="unknown", confidence=0.0, rationale="no rule fired")


def llm_tiebreaker_stub(announcement: Announcement) -> Classification:
    """Layer 4 — Claude Haiku call. Disabled in Phase 0.

    Returns a deterministic 'unknown' so the discovery worker can run end-to-end.
    The real implementation in Phase 2 calls the Anthropic SDK and parses a
    structured JSON response. See plan §F.3 cost estimate.
    """
    return Classification(
        label="unknown",
        confidence=0.0,
        rationale="llm tiebreaker stubbed in Phase 0 (UNI_DB_LIVE_APIS=false)",
    )
