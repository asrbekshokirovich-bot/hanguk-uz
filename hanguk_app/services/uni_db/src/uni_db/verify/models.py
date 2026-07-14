"""Typed results for each verification gate. All frozen + slotted."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

Severity = Literal["high", "medium", "low"]
Color = Literal["green", "amber", "red"]


@dataclass(frozen=True, slots=True)
class IdentityVerdict:
    """Gate 0 — is the downloaded PDF the exact document we want?"""

    document_kind: str            # guideline | notice | correction | results | tender | other
    university_name_ko_in_doc: str | None
    matches_target_university: bool
    academic_year_in_doc: int | None
    term_in_doc: str | None       # spring | fall | None
    matches_target_cycle: bool
    audience: str                 # foreign | overseas_korean | domestic | mixed | unclear
    serves_foreign_applicants: bool
    is_old_or_superseded: bool
    confidence: float
    reject_reason: str | None = None

    @property
    def accepted(self) -> bool:
        """Hard-accept only a real, current, foreign-applicant guideline for the
        right university AND the right admission cycle. A cycle mismatch used to
        be tolerated (flagged amber downstream), which is exactly how 78/83
        stored documents ended up describing older cycles than the crawl
        target — so matches_target_cycle is now a hard requirement (correction
        plan, Phase 1b)."""
        return (
            self.document_kind == "guideline"
            and self.matches_target_university
            and self.matches_target_cycle
            and self.serves_foreign_applicants
            and not self.is_old_or_superseded
            and self.reject_reason is None
            and self.confidence >= 0.5
        )


@dataclass(frozen=True, slots=True)
class GroundingIssue:
    """Gate 2 — an extracted value not backed by the source."""

    field_group: str
    row_index: int
    field: str
    problem: str                  # quote_not_in_source | value_unsupported
    quote: str | None = None


@dataclass(frozen=True, slots=True)
class SanityIssue:
    """Gate 5 — a deterministic range/order/cycle violation."""

    field_group: str
    field: str
    severity: Severity
    problem: str
    detail: str | None = None


@dataclass(frozen=True, slots=True)
class CriticIssue:
    """Gate 4 — a problem raised by an adversarial critic agent."""

    critic: str                   # accuracy | completeness | scope
    severity: Severity
    problem: str
    field_group: str | None = None
    row_index: int | None = None
    field: str | None = None
    source_quote: str | None = None


@dataclass(frozen=True, slots=True)
class ConsensusField:
    """Gate 3 — how N independent extractions compared on one critical field."""

    field_group: str
    field: str
    values: list[Any]             # one entry per extraction run
    agreement: float              # fraction of runs sharing the modal value
    unanimous: bool
