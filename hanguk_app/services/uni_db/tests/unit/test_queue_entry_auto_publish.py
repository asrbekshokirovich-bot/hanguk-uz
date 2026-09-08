"""Auto-publish must consult the reliability gauntlet, not just the model's
own self-reported confidence.

2026-09-01 audit finding: `_queue_entry_for`'s auto-publish branch computed a
`ReliabilityReport` (RED/AMBER/GREEN) but never read it — a RED verdict
(fabricated citation, stale-cycle date, non-unanimous consensus) could still
land as `status='approved'` with nothing but an advisory `needs_attention`
flag, because the branch gated only on `verdict.requires_hitl` (the model's
self-reported `accuracy_self_score` run through the difficulty table). This
file pins the fixed behaviour.
"""

from __future__ import annotations

from dataclasses import dataclass

from uni_db.extract.validators import ValidationVerdict
from uni_db.verify.engine import ReliabilityReport
from uni_db.workers.parse_worker import _queue_entry_for


@dataclass
class _FakeResult:
    parsed_output: dict = None
    accuracy_self_score: float = 0.95

    def __post_init__(self):
        if self.parsed_output is None:
            self.parsed_output = {"rows": [{"a": 1}]}


def _verdict(requires_hitl: bool) -> ValidationVerdict:
    return ValidationVerdict(auto_publish=not requires_hitl, requires_hitl=requires_hitl, rationale="test")


def test_red_report_never_auto_publishes_even_with_a_confident_model():
    """The exact gap the audit found: a high self-score model with a RED
    gauntlet verdict must wait for a human, not publish with a soft flag."""
    result = _FakeResult(accuracy_self_score=0.97)
    verdict = _verdict(requires_hitl=False)  # model is confident
    report = ReliabilityReport(overall="red")

    entry = _queue_entry_for(
        "calendar", result, verdict, auto_publish=True, require_approval=False, report=report,
    )

    assert entry["status"] == "open"
    assert entry["needs_attention"] is True
    assert entry["priority"] == 1


def test_amber_report_flags_even_when_model_self_score_is_high():
    result = _FakeResult(accuracy_self_score=0.95)
    verdict = _verdict(requires_hitl=False)
    report = ReliabilityReport(overall="amber")

    entry = _queue_entry_for(
        "tuition", result, verdict, auto_publish=True, require_approval=False, report=report,
    )

    assert entry["status"] == "approved"
    assert entry["needs_attention"] is True


def test_green_report_and_confident_model_publish_clean():
    result = _FakeResult(accuracy_self_score=0.95)
    verdict = _verdict(requires_hitl=False)
    report = ReliabilityReport(overall="green")

    entry = _queue_entry_for(
        "requirements", result, verdict, auto_publish=True, require_approval=False, report=report,
    )

    assert entry["status"] == "approved"
    assert entry["needs_attention"] is False
    assert entry["reason"] == "auto_approved"


def test_low_self_score_still_flags_even_on_a_green_report():
    """The self-score gate and the reliability-colour gate are additive —
    neither can silence the other."""
    result = _FakeResult(accuracy_self_score=0.5)
    verdict = _verdict(requires_hitl=True)
    report = ReliabilityReport(overall="green")

    entry = _queue_entry_for(
        "scholarships", result, verdict, auto_publish=True, require_approval=False, report=report,
    )

    assert entry["status"] == "approved"
    assert entry["needs_attention"] is True


def test_no_report_falls_back_to_self_score_only_unchanged():
    """When the gauntlet itself errored (report=None), the call site's
    'verification must never lose a good extraction' invariant means this
    function must not start blocking publication it didn't block before."""
    result = _FakeResult(accuracy_self_score=0.97)
    verdict = _verdict(requires_hitl=False)

    entry = _queue_entry_for(
        "calendar", result, verdict, auto_publish=True, require_approval=False, report=None,
    )

    assert entry["status"] == "approved"
    assert entry["needs_attention"] is False
