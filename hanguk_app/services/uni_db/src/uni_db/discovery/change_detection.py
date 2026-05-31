"""Change detection layer.

Plan §E.5 / Audit §6.5. Compares a freshly-seen Announcement against
the prior snapshot in `announcements` and emits a `crawl_findings.finding_type`
plus an optional `change_events` row.

For Phase 0 the function is pure — it consumes a "prior" dataclass and
returns the next state. The DB writers in workers/ glue it onto persistence.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import datetime
from typing import Literal

from .keywords_ko import is_correction_notice
from .models import Announcement

FindingType = Literal[
    "new_post",
    "title_change",
    "attachment_change",
    "correction_notice",
    "removed",
    "noop",
]


@dataclass(frozen=True, slots=True)
class PriorAnnouncementSnapshot:
    title_ko: str
    attachment_hashes: tuple[str, ...]
    seen_at: datetime


@dataclass(frozen=True, slots=True)
class ChangeFinding:
    finding_type: FindingType
    priority: int
    details: dict[str, object]


def detect_change(
    fresh: Announcement,
    prior: PriorAnnouncementSnapshot | None,
) -> ChangeFinding:
    """Return the most-significant finding for this snapshot pair.

    Rules (audit §6.5):
      * No prior → new_post (priority 5).
      * Title acquires correction-notice keyword → correction_notice (priority 1).
      * Title text changed (substantively) → title_change (priority 3).
      * Attachment hashes diverge → attachment_change (priority 2).
      * Otherwise noop.
    """
    if prior is None:
        return ChangeFinding(
            finding_type="new_post",
            priority=5 if not is_correction_notice(fresh.title_ko) else 1,
            details={"title_ko": fresh.title_ko},
        )

    if is_correction_notice(fresh.title_ko) and not is_correction_notice(prior.title_ko):
        return ChangeFinding(
            finding_type="correction_notice",
            priority=1,
            details={
                "old_title": prior.title_ko,
                "new_title": fresh.title_ko,
            },
        )

    fresh_hashes = tuple(sorted(att.sha256 or "" for att in fresh.attachments))
    if fresh_hashes != prior.attachment_hashes and fresh_hashes:
        return ChangeFinding(
            finding_type="attachment_change",
            priority=2,
            details={
                "old_hashes": list(prior.attachment_hashes),
                "new_hashes": list(fresh_hashes),
            },
        )

    if _normalize(fresh.title_ko) != _normalize(prior.title_ko):
        return ChangeFinding(
            finding_type="title_change",
            priority=3,
            details={
                "old_title": prior.title_ko,
                "new_title": fresh.title_ko,
            },
        )

    return ChangeFinding(finding_type="noop", priority=9, details={})


def title_hash(title: str) -> str:
    """Stable hash for change-detection comparisons."""
    return hashlib.sha256(_normalize(title).encode("utf-8")).hexdigest()


def _normalize(title: str) -> str:
    return " ".join(title.split()).strip().lower()
