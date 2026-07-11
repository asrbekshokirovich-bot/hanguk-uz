"""Reliability verification gauntlet — offline unit tests.

All LLM gates are injected, so these cover the pure logic (sanity ranges,
deterministic grounding, consensus diff, colour aggregation) and the agent
parsing/coercion, with no network.
"""

from __future__ import annotations

from uuid import uuid4

from uni_db.verify import agents, checks
from uni_db.verify.engine import aggregate, rollup, verify_extraction
from uni_db.verify.models import (
    ConsensusField,
    CriticIssue,
    GroundingIssue,
    IdentityVerdict,
    SanityIssue,
)


def _idv(**over) -> IdentityVerdict:
    base = dict(
        document_kind="guideline",
        university_name_ko_in_doc="인하대학교",
        matches_target_university=True,
        academic_year_in_doc=2027,
        term_in_doc="spring",
        matches_target_cycle=True,
        audience="foreign",
        serves_foreign_applicants=True,
        is_old_or_superseded=False,
        confidence=0.9,
        reject_reason=None,
    )
    base.update(over)
    return IdentityVerdict(**base)


# --------------------------------------------------------------------------- #
# Gate 5 — deterministic sanity
# --------------------------------------------------------------------------- #


class TestSanity:
    def test_tuition_out_of_range_is_high(self) -> None:
        out = checks.sanity_checks(
            "tuition",
            {"rows": [{"faculty_group": "인문", "academic_year": 2027,
                       "semester_number": 1, "amount_krw": 50, "source_text_ko": "x"}]},
            target_year=2027,
        )
        assert [(i.problem, i.severity) for i in out] == [("tuition_out_of_range", "high")]

    def test_tuition_year_mismatch_is_medium(self) -> None:
        out = checks.sanity_checks(
            "tuition",
            {"rows": [{"faculty_group": "인문", "academic_year": 2021,
                       "semester_number": 1, "amount_krw": 5_000_000, "source_text_ko": "x"}]},
            target_year=2027,
        )
        assert any(i.problem == "year_mismatch" and i.severity == "medium" for i in out)

    def test_calendar_out_of_order_is_high(self) -> None:
        out = checks.sanity_checks("calendar", {"events": [
            {"event_type": "apply_open", "starts_at": "2026-09-30T00:00:00+09:00", "source_text_ko": "a"},
            {"event_type": "apply_close", "starts_at": "2026-09-01T00:00:00+09:00", "source_text_ko": "b"},
        ]}, target_year=2027)
        assert any(i.problem == "out_of_order_dates" and i.severity == "high" for i in out)

    def test_calendar_in_order_is_clean(self) -> None:
        out = checks.sanity_checks("calendar", {"events": [
            {"event_type": "apply_open", "starts_at": "2026-09-01T00:00:00+09:00", "source_text_ko": "a"},
            {"event_type": "apply_close", "starts_at": "2026-09-30T00:00:00+09:00", "source_text_ko": "b"},
        ]}, target_year=2027)
        assert out == []

    def test_requirements_ranges(self) -> None:
        out = checks.sanity_checks("requirements", {"rows": [
            {"topik_min_level": 9, "gpa_floor_pct": 250,
             "english_test": {"ielts": 12.0}, "source_text_ko": "x"},
        ]}, target_year=2027)
        problems = {i.problem for i in out}
        assert {"topik_out_of_range", "gpa_out_of_range", "ielts_out_of_range"} <= problems


# --------------------------------------------------------------------------- #
# Gate 2 (deterministic) — grounding: the quote must be in the PDF
# --------------------------------------------------------------------------- #


class TestGroundingDeterministic:
    PDF = "인하대학교 2027학년도 외국인전형 모집요강\n원서접수: 2026.09.01 ~ 09.30\n등록금 5,000,000원"

    def test_quote_present_passes(self) -> None:
        out = checks.check_grounding_deterministic(
            "calendar",
            {"events": [{"event_type": "apply_open", "starts_at": "2026-09-01",
                         "source_text_ko": "원서접수: 2026.09.01 ~ 09.30"}]},
            self.PDF,
        )
        assert out == []

    def test_fabricated_quote_flagged(self) -> None:
        out = checks.check_grounding_deterministic(
            "tuition",
            {"rows": [{"amount_krw": 9_000_000,
                       "source_text_ko": "등록금 9,000,000원 전액 국비 지원"}]},
            self.PDF,
        )
        assert len(out) == 1 and out[0].problem == "quote_not_in_source"

    def test_whitespace_insensitive(self) -> None:
        out = checks.check_grounding_deterministic(
            "tuition",
            {"rows": [{"amount_krw": 5_000_000, "source_text_ko": "등록금  5,000,000 원"}]},
            self.PDF,
        )
        assert out == []


# --------------------------------------------------------------------------- #
# Gate 3 — consensus
# --------------------------------------------------------------------------- #


class TestConsensus:
    def _run(self, amt: int) -> dict:
        return {"rows": [{"faculty_group": "인문", "amount_krw": amt, "source_text_ko": "x"}]}

    def test_unanimous(self) -> None:
        cons = checks.consensus("tuition", [self._run(5_000_000), self._run(5_000_000)])
        assert all(c.unanimous for c in cons)

    def test_disagreement_flagged(self) -> None:
        cons = checks.consensus("tuition", [self._run(5_000_000), self._run(6_000_000)])
        disagreeing = [c for c in cons if c.field == "tuition:min_krw"]
        assert disagreeing and not disagreeing[0].unanimous

    def test_single_run_no_consensus(self) -> None:
        assert checks.consensus("tuition", [self._run(5_000_000)]) == []


# --------------------------------------------------------------------------- #
# identity
# --------------------------------------------------------------------------- #


class TestIdentity:
    def test_names_match_suffix_insensitive(self) -> None:
        assert agents.names_match("서울대학교", "서울대학교", None)
        assert agents.names_match("Yonsei University", "연세대학교", "Yonsei University")
        assert not agents.names_match("고려대학교", "연세대학교", None)

    def test_accepted_verdict(self) -> None:
        assert _idv().accepted is True

    def test_rejected_when_old(self) -> None:
        assert _idv(is_old_or_superseded=True).accepted is False

    def test_rejected_when_not_guideline(self) -> None:
        assert _idv(document_kind="notice").accepted is False

    def test_check_identity_blocks_wrong_university(self) -> None:
        # LLM claims it matches, but the doc's name is a DIFFERENT school → the
        # deterministic cross-check overrides and the verdict is not accepted.
        def fake(system, user, model):
            return {"document_kind": "guideline", "university_name_ko_in_doc": "고려대학교",
                    "matches_target_university": True, "serves_foreign_applicants": True,
                    "audience": "foreign", "confidence": 0.95}

        v = agents.check_identity(
            university_name_ko="연세대학교", university_name_en="Yonsei University",
            target_year=2027, target_term="spring", head_text="...",
            call_json=fake,
        )
        assert v.matches_target_university is False
        assert v.accepted is False
        assert v.reject_reason and "고려대학교" in v.reject_reason

    def test_check_identity_accepts_right_university(self) -> None:
        def fake(system, user, model):
            return {"document_kind": "guideline", "university_name_ko_in_doc": "연세대학교",
                    "matches_target_university": True, "serves_foreign_applicants": True,
                    "matches_target_cycle": True, "audience": "foreign", "confidence": 0.93}

        v = agents.check_identity(
            university_name_ko="연세대학교", university_name_en=None,
            target_year=2027, target_term="spring", head_text="...",
            call_json=fake,
        )
        assert v.accepted is True


# --------------------------------------------------------------------------- #
# critics / grounding judge (injected)
# --------------------------------------------------------------------------- #


class TestAgentsParsing:
    ROWS = [{"amount_krw": 5_000_000, "source_text_ko": "등록금 5,000,000원"}]

    def test_run_critics_parses_and_isolates_failures(self) -> None:
        def fake(system, user, model):
            if "fact-checker" in system:
                return {"issues": [{"row_index": 0, "field": "amount_krw",
                                    "severity": "high", "problem": "wrong amount"}]}
            if "OMISSIONS" in system:
                raise RuntimeError("completeness critic down")  # non-fatal
            return {"misscoped": []}

        issues = agents.run_critics(
            field_group="tuition", source_text_ko="등록금 5,000,000원", rows=self.ROWS,
            target_year=2027, target_term="spring", call_json=fake,
        )
        accuracy = [i for i in issues if i.critic == "accuracy"]
        assert accuracy and accuracy[0].severity == "high"

    def test_scope_issue_is_high(self) -> None:
        def fake(system, user, model):
            if "target audience is FOREIGN" in system:
                return {"misscoped": [{"row_index": 0, "field": "applicant_category",
                                       "actual": "재외국민"}]}
            return {"issues": [], "missing": []}

        issues = agents.run_critics(
            field_group="requirements", source_text_ko="x", rows=self.ROWS,
            target_year=2027, target_term=None, call_json=fake,
        )
        scope = [i for i in issues if i.critic == "scope"]
        assert scope and scope[0].severity == "high"

    def test_grounding_judge_parses(self) -> None:
        def fake(system, user, model):
            return {"unsupported": [{"row_index": 0, "field": "amount_krw",
                                     "value": 5_000_000, "reason": "not in source"}]}

        out = agents.grounding_judge(
            field_group="tuition", source_text_ko="x", rows=self.ROWS, call_json=fake,
        )
        assert len(out) == 1 and out[0].problem == "value_unsupported"


# --------------------------------------------------------------------------- #
# aggregation colour policy
# --------------------------------------------------------------------------- #


class TestAggregate:
    def test_green_when_clean(self) -> None:
        assert aggregate(field_group="tuition", identity=_idv()).overall == "green"

    def test_red_on_identity_reject(self) -> None:
        assert aggregate(identity=_idv(is_old_or_superseded=True)).overall == "red"

    def test_red_on_fabricated_citation(self) -> None:
        gi = [GroundingIssue("tuition", 0, "source_text_ko", "quote_not_in_source", "x")]
        assert aggregate(grounding_issues=gi).overall == "red"

    def test_red_on_high_critic(self) -> None:
        ci = [CriticIssue("accuracy", "high", "wrong")]
        assert aggregate(critic_issues=ci).overall == "red"

    def test_red_on_consensus_disagreement(self) -> None:
        cf = [ConsensusField("tuition", "tuition:min_krw", [1, 2], 0.5, unanimous=False)]
        assert aggregate(consensus_fields=cf).overall == "red"

    def test_amber_on_medium_sanity(self) -> None:
        si = [SanityIssue("tuition", "academic_year", "medium", "year_mismatch")]
        assert aggregate(sanity_issues=si).overall == "amber"

    def test_amber_on_cycle_mismatch(self) -> None:
        assert aggregate(identity=_idv(matches_target_cycle=False)).overall == "amber"


# --------------------------------------------------------------------------- #
# end-to-end orchestrator (injected agents)
# --------------------------------------------------------------------------- #

_NONE_GROUNDING = lambda fg, s, rows: []           # noqa: E731
_NONE_CRITICS = lambda fg, s, rows, y, t: []       # noqa: E731

_PDF = "인하대학교 2027학년도 외국인전형 모집요강\n인문계열 1학기 등록금 5,000,000원"


class TestVerifyExtraction:
    def _run(self, amt: int) -> dict:
        return {"rows": [{"faculty_group": "인문", "academic_year": 2027, "semester_number": 1,
                          "amount_krw": amt, "source_text_ko": "인문계열 1학기 등록금 5,000,000원"}]}

    def test_green_path(self) -> None:
        rep = verify_extraction(
            field_group="tuition", runs=[self._run(5_000_000)], pdf_text=_PDF,
            source_text_ko="인문계열 1학기 등록금 5,000,000원", target_year=2027,
            grounding_fn=_NONE_GROUNDING, critics_fn=_NONE_CRITICS,
        )
        assert rep.overall == "green"

    def test_red_on_bad_pdf_quote(self) -> None:
        rep = verify_extraction(
            field_group="tuition",
            runs=[{"rows": [{"faculty_group": "인문", "amount_krw": 5_000_000,
                             "source_text_ko": "완전히 지어낸 문장입니다 전액지원"}]}],
            pdf_text=_PDF, source_text_ko="x", target_year=2027,
            grounding_fn=_NONE_GROUNDING, critics_fn=_NONE_CRITICS,
        )
        assert rep.overall == "red"
        assert "quote_not_in_source" in rep.to_review_note()

    def test_red_on_consensus_disagreement(self) -> None:
        rep = verify_extraction(
            field_group="tuition", runs=[self._run(5_000_000), self._run(6_000_000)],
            pdf_text=_PDF, source_text_ko="인문계열 1학기 등록금 5,000,000원", target_year=2027,
            grounding_fn=_NONE_GROUNDING, critics_fn=_NONE_CRITICS,
        )
        assert rep.overall == "red"

    def test_rollup_worst_colour_wins(self) -> None:
        green = aggregate(field_group="tuition", identity=None)
        red = aggregate(field_group="calendar",
                        sanity_issues=[SanityIssue("calendar", "x", "high", "out_of_order_dates")])
        assert rollup(_idv(), [green, red]).overall == "red"


# --------------------------------------------------------------------------- #
# parse_worker full-HITL integration (offline: mock extraction, no LLM gates)
# --------------------------------------------------------------------------- #


def test_parse_require_approval_queues_everything_open() -> None:
    from uni_db.workers.parse_worker import parse_one_document

    text = (
        "연세대학교 2027학년도 외국인전형 모집요강\n"
        "원서접수: 2026.09.01(월) ~ 09.30(화)\n"
        "지원 자격: TOPIK 4급 이상\n"
    )
    outcome = parse_one_document(
        guideline_document_id=uuid4(),
        pdf_text_first_pages=text,
        pdf_text_full=text,
        require_approval=True,
        verify_level="balanced",   # deterministic gates only — no live LLM needed
        target_year=2027,
    )
    ej = [e for e in outcome.review_queue_entries if e.get("entity_type") == "extraction_jobs"]
    assert ej                                              # mock extraction yields content
    assert all(e["status"] == "open" for e in ej)         # nothing auto-approved
    assert all(str(e["rationale"]).startswith("[") for e in ej)  # reliability note attached

