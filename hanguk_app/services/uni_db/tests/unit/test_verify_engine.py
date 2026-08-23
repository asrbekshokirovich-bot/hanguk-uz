"""Reliability verification gauntlet — offline unit tests.

All LLM gates are injected, so these cover the pure logic (sanity ranges,
deterministic grounding, consensus diff, colour aggregation) and the agent
parsing/coercion, with no network.
"""

from __future__ import annotations

from uuid import uuid4

from uni_db.verify import agents, checks, engine
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

    def test_english_required_without_score_flagged(self) -> None:
        # English (IELTS/TOEFL) route stated as required but its cutoff dropped —
        # this would wrongly exclude English-track applicants.
        out = checks.sanity_checks("requirements", {"rows": [
            {"english_status": "required", "english_test": None, "source_text_ko": "x"},
        ]}, target_year=2027)
        assert any(i.problem == "english_required_no_score" for i in out)

    def test_topik_required_without_level_flagged(self) -> None:
        out = checks.sanity_checks("requirements", {"rows": [
            {"topik_status": "required", "topik_min_level": None,
             "topik_deferred": False, "source_text_ko": "x"},
        ]}, target_year=2027)
        assert any(i.problem == "topik_required_no_level" for i in out)

    def test_topik_required_but_deferred_is_ok(self) -> None:
        # 면제 / deferred is a legitimate no-number case.
        out = checks.sanity_checks("requirements", {"rows": [
            {"topik_status": "required", "topik_min_level": None,
             "topik_deferred": True, "source_text_ko": "x"},
        ]}, target_year=2027)
        assert not any(i.problem == "topik_required_no_level" for i in out)

    def test_both_language_routes_with_scores_clean(self) -> None:
        out = checks.sanity_checks("requirements", {"rows": [
            {"topik_status": "required", "topik_min_level": 3,
             "english_status": "required", "english_test": {"ielts": 5.5},
             "source_text_ko": "x"},
        ]}, target_year=2027)
        assert out == []


def test_completeness_critic_prompt_is_language_track_aware() -> None:
    from uni_db.verify import prompts

    sys_req, _ = prompts.completeness_critic_prompt(
        source_text_ko="x", rows=[{"a": 1}], field_group="requirements"
    )
    assert "IELTS" in sys_req and "TOPIK" in sys_req and "EITHER language" in sys_req
    sys_cal, _ = prompts.completeness_critic_prompt(
        source_text_ko="x", rows=[{"a": 1}], field_group="calendar"
    )
    assert "EITHER language" not in sys_cal   # clause is requirements-only


def test_requirements_extraction_prompt_has_language_addendum() -> None:
    from uni_db.extract.prompt_assembler import assemble_prompt

    req = assemble_prompt(field_group="requirements", archetype="A", source_text_ko="x")
    assert "Language eligibility" in req.system and "IELTS" in req.system
    cal = assemble_prompt(field_group="calendar", archetype="A", source_text_ko="x")
    assert "Language eligibility" not in cal.system


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

    def test_short_quote_survives_a_small_gap(self) -> None:
        # A table row the model stitched from a header cell and a body cell that
        # sit apart in the extracted text: everything but the "국적 증빙" prefix is
        # verbatim. The old majority-of-20-char-chunks vote turned a quote this
        # short into a single chunk that had to match exactly, so this was
        # flagged as fabricated.
        pdf = "제출서류 안내\n해당자만 본인 외국인등록증(앞·뒷면) ○\n학력 증빙 졸업증명서 ○"
        out = checks.check_grounding_deterministic(
            "documents_required",
            {"rows": [{"source_text_ko": "국적 증빙 해당자만 본인 외국인등록증(앞·뒷면) ○"}]},
            pdf,
        )
        assert out == []

    def test_strictness_does_not_depend_on_quote_length(self) -> None:
        # Two quotes with the same verbatim ratio (~86% grounded, the rest
        # invented) must get the same verdict regardless of length. Under the
        # chunk vote the verdict flipped with length alone: a short quote
        # collapsed to one chunk that had to match exactly, while a long one
        # could lose 40 characters and still pass.
        pdf = checks._norm("가나다라마바사아자차카타파하" * 20)
        unit = "가나다라마바사아자차카타파하" * 3   # 42 grounded chars
        short = checks._norm(unit + "Z" * 7)
        long = checks._norm(unit * 4 + "Z" * 28)
        assert checks._quote_grounded(short, pdf) == checks._quote_grounded(long, pdf)
        assert checks._quote_grounded(short, pdf) is True

    def test_coverage_separates_real_from_fabricated(self) -> None:
        pdf = checks._norm(
            "원서접수 및 서류제출(전형료납부) 2023.10.04.(수) ~ 11.30.(목) 서류제출 마감 2023.12.04.(월)"
        )
        real = checks._norm("원서접수 및 서류제출(전형료납부) ~ 11.30.(목)")
        fake = checks._norm("본교는 모든 외국인 학생에게 기숙사를 무상으로 제공합니다")
        assert checks._covered_fraction(real, pdf) >= checks._MIN_COVERAGE
        assert checks._covered_fraction(fake, pdf) < 0.4


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
        disagreeing = [c for c in cons if c.field == "tuition:인문"]
        assert disagreeing and not disagreeing[0].unanimous

    def test_single_run_no_consensus(self) -> None:
        assert checks.consensus("tuition", [self._run(5_000_000)]) == []

    def test_swapped_faculty_amounts_flagged(self) -> None:
        # min + faculty-set are identical, but the per-faculty amounts are
        # swapped — value-aware signature must catch this.
        def run(hum: int, eng: int) -> dict:
            return {"rows": [
                {"faculty_group": "인문", "amount_krw": hum, "source_text_ko": "x"},
                {"faculty_group": "공학", "amount_krw": eng, "source_text_ko": "x"},
            ]}
        cons = checks.consensus("tuition", [run(4_000_000, 5_000_000), run(5_000_000, 4_000_000)])
        assert any(not c.unanimous for c in cons)

    def test_scholarship_value_change_flagged(self) -> None:
        def run(pct: float) -> dict:
            return {"rows": [{"name_ko": "글로벌장학금", "award_type": "tuition_waiver_pct",
                              "award_value": pct, "source_text_ko": "x"}]}
        cons = checks.consensus("scholarships", [run(100.0), run(50.0)])
        assert any(not c.unanimous for c in cons)


class TestPeriods:
    """The published calendar rows (periods[]) must be checked, not just events[]."""

    def test_period_out_of_order_flagged(self) -> None:
        out = checks.sanity_checks("calendar", {"periods": [
            {"application_start": "2027-03-01", "document_deadline": "2026-11-01",
             "source_text_ko": "x"},
        ]}, target_year=2027)
        assert any(i.problem == "out_of_order_dates" and i.field.startswith("period[")
                   for i in out)

    def test_period_dates_in_order_clean(self) -> None:
        out = checks.sanity_checks("calendar", {"periods": [
            {"application_start": "2026-09-01", "application_end": "2026-09-30",
             "document_deadline": "2026-10-05", "result_announcement": "2026-12-01",
             "source_text_ko": "x"},
        ]}, target_year=2027)
        assert out == []

    def test_period_quote_grounding(self) -> None:
        # A fabricated period source quote is flagged just like an event's.
        pdf = "인하대 원서접수 2026.09.01 ~ 09.30 서류마감 10.05"
        out = checks.check_grounding_deterministic(
            "calendar",
            {"periods": [{"application_start": "2026-09-01",
                          "source_text_ko": "완전히 지어낸 마감 문장입니다 전형료 면제"}]},
            pdf,
        )
        assert len(out) == 1 and out[0].problem == "quote_not_in_source"


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

    def test_red_on_cycle_mismatch(self) -> None:
        # Phase 1b: a cycle mismatch fails identity acceptance outright — the
        # old amber carve-out let 78/83 stored docs describe stale cycles.
        assert aggregate(identity=_idv(matches_target_cycle=False)).overall == "red"


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



class TestConsensusMissingIsNotGreen:
    """A card nothing cross-checked must not wear the colour of one that was.

    `consensus` comes back empty in two very different situations: every
    independent re-extraction agreed and there was no disagreement to report,
    or the gate never ran — the backend capped the level, or each re-extraction
    threw and the vote shrank to one. Before `consensus_expected` the verdict
    could not tell them apart, so an unverified tuition table reached a
    reviewer wearing the same green as a verified one.
    """

    def test_unrun_consensus_is_amber_not_green(self) -> None:
        report = aggregate(field_group="tuition", consensus_expected=True)
        assert report.overall == "amber"
        assert report.consensus_missing is True

    def test_and_the_note_says_so_in_words(self) -> None:
        note = aggregate(field_group="tuition", consensus_expected=True).to_review_note()
        assert "consensus NOT RUN" in note

    def test_agreement_with_nothing_to_report_stays_green(self) -> None:
        # Consensus ran and every field was unanimous — the honest green.
        cons = [
            ConsensusField(
                field_group="tuition", field="fac:humanities",
                values=[1, 1, 1], agreement=1.0, unanimous=True,
            )
        ]
        report = aggregate(
            field_group="tuition", consensus_fields=cons, consensus_expected=True,
        )
        assert report.overall == "green"
        assert report.consensus_missing is False

    def test_a_level_that_never_promised_consensus_stays_green(self) -> None:
        # `balanced` does not run the gate at all, so its absence is not a gap.
        report = aggregate(field_group="tuition", consensus_expected=False)
        assert report.overall == "green"
        assert report.consensus_missing is False

    def test_disagreement_still_outranks_a_mere_gap(self) -> None:
        cons = [
            ConsensusField(
                field_group="tuition", field="fac:humanities",
                values=[1, 2, 1], agreement=2 / 3, unanimous=False,
            )
        ]
        report = aggregate(
            field_group="tuition", consensus_fields=cons, consensus_expected=True,
        )
        assert report.overall == "red"

    def test_rollup_holds_the_document_back_for_one_unchecked_group(self) -> None:
        # Averaging the gap away would let a document pass on the strength of
        # the groups that did get cross-checked.
        checked = aggregate(
            field_group="calendar",
            consensus_fields=[
                ConsensusField(field_group="calendar", field="ev:apply_open",
                               values=[1, 1, 1], agreement=1.0, unanimous=True)
            ],
            consensus_expected=True,
        )
        unchecked = aggregate(field_group="tuition", consensus_expected=True)
        assert rollup(None, [checked, unchecked]).overall == "amber"


class TestGroundingIgnoresControlCharacters:
    """A PDF that separates words with U+0001 must not make every citation
    look fabricated.

    Some Korean guideline PDFs carry their word separator as a C0 control
    character rather than a space. 연암공과대학교's 2027 guideline has 3,022 of
    them across 40k characters — roughly one per word. `\\s` does not match
    those, so they survived normalisation on the PDF side while the model's
    quote (written with real spaces) had its spaces stripped:

        quote  -> "13.일반한국어능력시험3급이상취득자격증빙서류"
        pdf    -> "13.\\x01일반\\x01한국어능력시험\\x013급이상..."

    Every row in that document was flagged `quote_not_in_source` — the
    fabricated-citation warning — on an extraction that was entirely correct
    and quotes that appear in the file verbatim. Checked against the real
    document: 4 false flags before this, 0 after.
    """

    QUOTE = "13. 일반 한국어능력시험 3급 이상 취득 자격 증빙 서류"

    def _payload(self, quote: str) -> dict:
        return {"rows": [{"source_text_ko": quote}]}

    def test_quote_grounds_through_u0001_separators(self) -> None:
        pdf = "2027학년도\x01모집요강\x0113.\x01일반\x01한국어능력시험\x013급\x01이상\x01취득\x01자격\x01증빙\x01서류"
        out = checks.check_grounding_deterministic(
            "requirements", self._payload(self.QUOTE), pdf
        )
        assert out == [], out

    def test_still_grounds_through_ordinary_spacing(self) -> None:
        # The behaviour that already worked must keep working.
        pdf = f"2027학년도 모집요강\n{self.QUOTE}\n기타"
        out = checks.check_grounding_deterministic(
            "requirements", self._payload(self.QUOTE), pdf
        )
        assert out == []

    def test_a_fabricated_quote_is_still_caught(self) -> None:
        # The point of the check survives: stripping control characters must
        # not make everything match.
        pdf = "2027학년도\x01모집요강\x01전형료\x0150,000원\x01납부"
        out = checks.check_grounding_deterministic(
            "requirements",
            self._payload("지원자는 TOEFL 100점 이상을 제출해야 한다"),
            pdf,
        )
        assert len(out) == 1
        assert out[0].problem == "quote_not_in_source"

    def test_control_chars_in_the_quote_itself_are_tolerated(self) -> None:
        # The model sometimes echoes the separator back inside its citation.
        pdf = f"모집요강 {self.QUOTE} 기타"
        echoed = self.QUOTE.replace(" ", "\x01")
        out = checks.check_grounding_deterministic(
            "requirements", self._payload(echoed), pdf
        )
        assert out == []

    def test_newlines_and_tabs_are_left_to_the_whitespace_rule(self) -> None:
        # \n and \t are legitimate layout, already handled by _WS_RE; the new
        # class must not be so wide that it changes how they normalise.
        assert checks._norm("a\nb\tc") == "abc"
        assert checks._norm("a\x01b\x0cc") == "abc"


class TestEmptyPayloadIsNotGreen:
    """A card with nothing on it must not claim its checks passed.

    Every signal comes back clean for an empty extraction, and each for the
    same reason: there is nothing to find. `verify_extraction` skips both LLM
    gates when there are no rows (`if use_grounding_llm and rows`, `if
    use_critics and rows`), sanity checks find no bad value in an absent one,
    and consensus over identical emptiness is unanimous.

    The reviewer then sees "Tekshiruvlar o'tdi · ishonch 60%" above a body
    reading "Ko'rsatilmagan" — the badge asserting the opposite of the card.
    Reported from production on a `tuition` card.
    """

    def test_empty_rows_are_amber_not_green(self) -> None:
        report = verify_extraction(
            field_group="tuition",
            runs=[{"rows": []}],
            pdf_text="2027학년도 모집요강 등록금 안내",
            source_text_ko="",
            target_year=2027,
            use_grounding_llm=False,
            use_critics=False,
        )
        assert report.overall == "amber", report.overall

    def test_no_runs_at_all_is_amber(self) -> None:
        report = verify_extraction(
            field_group="tuition", runs=[], pdf_text="", source_text_ko="",
            target_year=2027,
        )
        assert report.overall == "amber"

    def test_a_populated_payload_can_still_be_green(self) -> None:
        # The fix must not paint every card amber — a clean extraction with
        # content keeps its green.
        report = verify_extraction(
            field_group="tuition",
            runs=[{"rows": [{"amount_krw": 4_000_000, "source_text_ko": "등록금 400만원"}]}],
            pdf_text="등록금 400만원",
            source_text_ko="등록금 400만원",
            target_year=2027,
            use_grounding_llm=False,
            use_critics=False,
        )
        assert report.overall == "green", report.overall

    def test_periods_only_counts_as_content(self) -> None:
        # A calendar payload can carry `periods` and no rows/events. `_rows`
        # is empty there, but the card renders the periods — so it is not an
        # empty card and must not be downgraded for emptiness.
        assert engine._rendered_items({"periods": [{"application_fee_krw": 60000}]}) == 1
        assert engine._rendered_items({"rows": [], "events": [], "periods": []}) == 0

    def test_emptiness_alone_never_reaches_red(self) -> None:
        # Absence of evidence is not evidence of error: an empty card is
        # unreviewed, not wrong.
        report = engine.aggregate(field_group="tuition", payload_empty=True)
        assert report.overall == "amber"


class TestGroundingFlagSaysWhy:
    """`quote_not_in_source` must carry the numbers that distinguish its causes.

    A quote can fail three different ways — fabricated, a page-long block the
    model pasted whole, or a genuine citation sitting just under the bar after
    a table reflow — and they need different responses. The flag used to say
    only "quote_not_in_source" plus 120 characters of Korean, which separates
    none of them.

    Measured on production: among cards that went through the gauntlet, 39%
    carried this flag before the U+0001 fix and 58% after (n=26), so the
    control-character case was real but not the dominant cause. The next
    occurrence should answer the question instead of raising it again.
    """

    def test_message_carries_coverage_and_length(self) -> None:
        pdf = "2027학년도 모집요강 등록금 안내 장학금 신청 방법"
        payload = {"rows": [{"source_text_ko": "지원자는 반드시 TOEFL 120점을 제출해야 하며 별도 서류가 필요하다"}]}
        out = checks.check_grounding_deterministic("requirements", payload, pdf)
        assert len(out) == 1
        msg = out[0].quote or ""
        assert "coverage" in msg, msg
        assert "chars]" in msg, msg

    def test_a_grounded_quote_still_raises_nothing(self) -> None:
        pdf = "2027학년도 모집요강 등록금 400만원 안내"
        payload = {"rows": [{"source_text_ko": "등록금 400만원"}]}
        assert checks.check_grounding_deterministic("tuition", payload, pdf) == []

    def test_the_original_quote_is_still_readable_in_the_message(self) -> None:
        # The prefix must not push the Korean out of the message entirely —
        # a reviewer still needs to see what was cited.
        pdf = "관계 없는 내용"
        quote = "TOEFL 120점 이상 제출" * 3
        out = checks.check_grounding_deterministic("requirements", {"rows": [{"source_text_ko": quote}]}, pdf)
        assert "TOEFL" in (out[0].quote or "")
