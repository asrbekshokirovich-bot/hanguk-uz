"""Aggregation + orchestration: turn the individual gate results into one
green/amber/red ReliabilityReport, and run the whole gauntlet for a field group.

Colour policy (a guideline is RED = must not publish until a human fixes it):
  RED   — identity rejected; a fabricated citation (quote not in the PDF);
          any HIGH-severity critic issue; a non-unanimous consensus on a
          critical field; any HIGH-severity sanity violation.
  AMBER — softer signals: an unsupported value, a MEDIUM critic/sanity issue,
          low identity confidence. (A target-cycle mismatch is RED since
          Phase 1b — identity acceptance now requires the target cycle.)
  GREEN — nothing tripped.

Every guideline still requires human approval regardless of colour (that is the
`require_approval` gate in parse_worker); the colour tells the reviewer where to
look first.
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from . import agents
from .checks import (
    check_grounding_deterministic,
    consensus,
    sanity_checks,
)
from .models import (
    Color,
    ConsensusField,
    CriticIssue,
    GroundingIssue,
    IdentityVerdict,
    SanityIssue,
)

log = logging.getLogger(__name__)

# Injection seams (default to the live agents; tests pass fakes).
GroundingFn = Callable[[str, str, list[dict[str, Any]]], list[GroundingIssue]]
CriticsFn = Callable[[str, str, list[dict[str, Any]], int, str | None], list[CriticIssue]]


@dataclass(frozen=True, slots=True)
class ReliabilityReport:
    overall: Color
    field_group: str | None = None
    identity: IdentityVerdict | None = None
    grounding_issues: list[GroundingIssue] = field(default_factory=list)
    sanity_issues: list[SanityIssue] = field(default_factory=list)
    critic_issues: list[CriticIssue] = field(default_factory=list)
    consensus: list[ConsensusField] = field(default_factory=list)

    #: The configured level promised to cross-check this extraction against
    #: independent re-extractions, and that did not happen — the backend capped
    #: the level, or every re-extraction threw and the vote shrank to one.
    #:
    #: It cannot be derived from `consensus` being empty, because empty also
    #: means "ran, and every field agreed". Before this flag the verdict could
    #: not tell those apart, so an unverified tuition table reached a reviewer
    #: wearing the same green as a verified one. At rollup it must be carried
    #: from the per-group reports rather than recomputed: one group's populated
    #: list would otherwise mask another group's gap.
    consensus_missing: bool = False

    @property
    def is_red(self) -> bool:
        return self.overall == "red"

    def to_review_note(self) -> str:
        """Compact reviewer-facing summary for review_queue.reviewer_notes."""
        lines = [f"[{self.overall.upper()}] reliability"
                 + (f" · {self.field_group}" if self.field_group else "")]
        if self.consensus_missing:
            lines.append(
                "  consensus NOT RUN — no independent re-extraction agreed this; "
                "check the figures against the source yourself"
            )
        if self.identity and not self.identity.accepted:
            lines.append(f"  identity: REJECTED — {self.identity.reject_reason or 'failed'}")
        for c in self.consensus:
            if not c.unanimous:
                lines.append(f"  consensus DISAGREEMENT on {c.field}: {c.values}")
        for g in self.grounding_issues:
            lines.append(f"  grounding[{g.problem}] row {g.row_index} {g.field}"
                         + (f": {g.quote}" if g.quote else ""))
        for s in self.sanity_issues:
            lines.append(f"  sanity[{s.severity}] {s.field}: {s.problem}"
                         + (f" — {s.detail}" if s.detail else ""))
        for ci in self.critic_issues:
            where = f" row {ci.row_index}" if ci.row_index is not None else ""
            lines.append(f"  {ci.critic}[{ci.severity}]{where}: {ci.problem}")
        if len(lines) == 1:
            lines.append("  all checks passed")
        return "\n".join(lines)


def aggregate(
    *,
    field_group: str | None = None,
    identity: IdentityVerdict | None = None,
    grounding_issues: list[GroundingIssue] | None = None,
    sanity_issues: list[SanityIssue] | None = None,
    critic_issues: list[CriticIssue] | None = None,
    consensus_fields: list[ConsensusField] | None = None,
    consensus_expected: bool = False,
    consensus_missing: bool | None = None,
    payload_empty: bool = False,
) -> ReliabilityReport:
    grounding_issues = grounding_issues or []
    sanity_issues = sanity_issues or []
    critic_issues = critic_issues or []
    consensus_fields = consensus_fields or []

    red = (
        (identity is not None and not identity.accepted)
        or any(g.problem == "quote_not_in_source" for g in grounding_issues)
        or any(c.severity == "high" for c in critic_issues)
        or any(not cf.unanimous for cf in consensus_fields)
        or any(s.severity == "high" for s in sanity_issues)
    )
    # Absence of evidence, not evidence of error — so amber, not red. The
    # point is that it must not read as green: a card nothing cross-checked
    # looked exactly like one three independent extractions agreed on, which is
    # how an unverified tuition table reaches a reviewer wearing the same
    # colour as a verified one.
    if consensus_missing is None:
        consensus_missing = consensus_expected and not consensus_fields
    # An extraction with nothing in it is the purest case of the rule above,
    # and it was the one the rule missed. `verify_extraction` skips BOTH LLM
    # gates when there are no rows (`if use_grounding_llm and rows`, `if
    # use_critics and rows`), sanity checks find nothing to complain about in
    # an empty payload, and consensus over identical emptiness is unanimous —
    # so every signal comes back clean and the card is graded green.
    #
    # A reviewer then sees "Tekshiruvlar o'tdi · ishonch 60%" above a body
    # that says "Ko'rsatilmagan", which is the badge asserting the opposite of
    # what the card shows. Nothing was checked, because there was nothing to
    # check; that is amber by the same reasoning as `consensus_missing`.
    amber = (
        consensus_missing
        or payload_empty
        or bool(grounding_issues)
        or any(c.severity in ("medium", "low") for c in critic_issues)
        or any(s.severity in ("medium", "low") for s in sanity_issues)
        # A cycle mismatch is no longer an amber case: IdentityVerdict.accepted
        # now requires matches_target_cycle (Phase 1b), so it lands RED above.
        or (identity is not None and identity.accepted and identity.confidence < 0.7)
    )
    overall: Color = "red" if red else ("amber" if amber else "green")
    return ReliabilityReport(
        overall=overall,
        field_group=field_group,
        identity=identity,
        grounding_issues=grounding_issues,
        sanity_issues=sanity_issues,
        critic_issues=critic_issues,
        consensus=consensus_fields,
        consensus_missing=consensus_missing,
    )


def verify_extraction(
    *,
    field_group: str,
    runs: list[dict[str, Any]],
    pdf_text: str,
    source_text_ko: str,
    target_year: int,
    target_term: str | None = None,
    use_grounding_llm: bool = True,
    use_critics: bool = True,
    consensus_expected: bool = False,
    grounding_fn: GroundingFn | None = None,
    critics_fn: CriticsFn | None = None,
) -> ReliabilityReport:
    """Run the extraction-side gauntlet (2–5) for ONE field group and aggregate.

    `runs` are 1..N independent extraction payloads for this group (>1 enables
    the consensus gate). The primary extraction is `runs[0]`. LLM gates are
    injectable so this unit-tests without network.
    """
    if not runs:
        return aggregate(
            field_group=field_group, consensus_expected=consensus_expected,
            payload_empty=True,
        )
    primary = runs[0]
    rows = _rows(primary)
    # Counted over everything the app renders, not just what feeds the LLM
    # gates: a calendar payload carrying only `periods` has something to show
    # a reviewer even though `_rows` (rows + events) is empty.
    payload_empty = not _rendered_items(primary)

    grounding = check_grounding_deterministic(field_group, primary, pdf_text)
    if use_grounding_llm and rows:
        gfn = grounding_fn or _default_grounding_fn
        try:
            grounding = grounding + gfn(field_group, source_text_ko, rows)
        except Exception as exc:  # a judge error must never lose the extraction
            log.warning("verify: grounding judge failed for %s (%s); deterministic only",
                        field_group, type(exc).__name__)

    sanity = sanity_checks(
        field_group, primary, target_year=target_year, target_term=target_term
    )
    cons = consensus(field_group, runs) if len(runs) > 1 else []

    critics: list[CriticIssue] = []
    if use_critics and rows:
        cfn = critics_fn or _default_critics_fn
        try:
            critics = cfn(field_group, source_text_ko, rows, target_year, target_term)
        except Exception as exc:  # ditto — critics are advisory, never fatal
            log.warning("verify: critics failed for %s (%s)", field_group, type(exc).__name__)

    return aggregate(
        field_group=field_group,
        grounding_issues=grounding,
        sanity_issues=sanity,
        critic_issues=critics,
        consensus_fields=cons,
        consensus_expected=consensus_expected,
        payload_empty=payload_empty,
    )


def rollup(identity: IdentityVerdict | None, reports: list[ReliabilityReport]) -> ReliabilityReport:
    """Combine per-group reports + the document identity into one document verdict
    (worst colour wins)."""
    grounding = [g for r in reports for g in r.grounding_issues]
    sanity = [s for r in reports for s in r.sanity_issues]
    critics = [c for r in reports for c in r.critic_issues]
    cons = [cf for r in reports for cf in r.consensus]
    return aggregate(
        identity=identity,
        grounding_issues=grounding,
        sanity_issues=sanity,
        critic_issues=critics,
        consensus_fields=cons,
        # One group that nothing cross-checked is enough to hold the whole
        # document back from green. Passed explicitly, not re-derived: `cons`
        # here is every group's fields concatenated, so a populated list from
        # one group would hide the gap in another.
        consensus_missing=any(r.consensus_missing for r in reports),
    )


def _rows(parsed_output: object) -> list[dict[str, Any]]:
    if not isinstance(parsed_output, dict):
        return []
    out: list[dict[str, Any]] = []
    for key in ("rows", "events"):
        seq = parsed_output.get(key)
        if isinstance(seq, list):
            out.extend(r for r in seq if isinstance(r, dict))
    return out


def _rendered_items(parsed_output: object) -> int:
    """How many items the review card will actually show.

    Wider than `_rows` on purpose: that one selects what the LLM gates read,
    this one answers "is there anything on this card at all", which is the
    question the reliability badge is making a claim about.
    """
    if not isinstance(parsed_output, dict):
        return 0
    total = 0
    for key in ("rows", "events", "periods"):
        seq = parsed_output.get(key)
        if isinstance(seq, list):
            total += sum(1 for r in seq if isinstance(r, dict))
    return total


def _default_grounding_fn(
    field_group: str, source_text_ko: str, rows: list[dict[str, Any]]
) -> list[GroundingIssue]:
    return agents.grounding_judge(
        field_group=field_group, source_text_ko=source_text_ko, rows=rows
    )


def _default_critics_fn(
    field_group: str,
    source_text_ko: str,
    rows: list[dict[str, Any]],
    target_year: int,
    target_term: str | None,
) -> list[CriticIssue]:
    return agents.run_critics(
        field_group=field_group, source_text_ko=source_text_ko, rows=rows,
        target_year=target_year, target_term=target_term,
    )
