"""Shared admission-cycle detection (parse/cycle_detect) + the Phase-1 identity
hard gate: IdentityVerdict.accepted now REQUIRES matches_target_cycle."""

from __future__ import annotations

from datetime import date

from uni_db.parse.cycle_detect import cycle_is_older, cycle_window, detect_cycle
from uni_db.verify.models import IdentityVerdict


class TestDetectCycle:
    def test_haknyeondo_year_and_spring_markers(self) -> None:
        c = detect_cycle("2027학년도 전기 외국인 특별전형 모집요강 (3월 입학)")
        assert c.academic_year == 2027
        assert c.semester == "spring"
        assert not c.covers_both_terms

    def test_fall_markers(self) -> None:
        c = detect_cycle("2026학년도 후기 (9월 입학) 외국인전형")
        assert (c.academic_year, c.semester) == (2026, "fall")

    def test_both_terms_is_fullyear(self) -> None:
        c = detect_cycle("2027학년도 전기 및 후기 모집요강")
        assert c.academic_year == 2027
        assert c.semester is None
        assert c.covers_both_terms

    def test_english_pattern_counts(self) -> None:
        c = detect_cycle("Admissions Guide for International Students, 2026 Fall")
        assert (c.academic_year, c.semester) == (2026, "fall")

    def test_most_frequent_year_wins(self) -> None:
        text = "2027학년도 모집요강 … 2027학년도 전형일정 … 참고: 2026학년도 결과"
        assert detect_cycle(text).academic_year == 2027

    def test_no_year_is_none(self) -> None:
        c = detect_cycle("외국인 유학생 모집 안내")
        assert c.academic_year is None
        assert c.semester is None


class TestCycleIsOlder:
    def test_older_year(self) -> None:
        assert cycle_is_older(2026, "fall", target_year=2027, target_term="spring")

    def test_same_year_older_term(self) -> None:
        assert cycle_is_older(2027, "spring", target_year=2027, target_term="fall")
        assert not cycle_is_older(2027, "fall", target_year=2027, target_term="spring")

    def test_unknown_year_is_not_older(self) -> None:
        assert not cycle_is_older(None, None, target_year=2027, target_term="spring")

    def test_newer_year_is_not_older(self) -> None:
        assert not cycle_is_older(2028, None, target_year=2027, target_term=None)


class TestCycleWindow:
    def test_spring_2027_window_matches_plan(self) -> None:
        assert cycle_window(2027, "spring") == (date(2026, 8, 1), date(2027, 6, 30))

    def test_fall_window_is_the_calendar_year(self) -> None:
        assert cycle_window(2026, "fall") == (date(2026, 1, 1), date(2026, 12, 31))

    def test_unknown_term_is_the_union(self) -> None:
        assert cycle_window(2027, None) == (date(2026, 8, 1), date(2027, 12, 31))


def _verdict(**overrides) -> IdentityVerdict:
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
    )
    base.update(overrides)
    return IdentityVerdict(**base)


class TestAcceptedRequiresTargetCycle:
    def test_cycle_match_accepts(self) -> None:
        assert _verdict().accepted is True

    def test_cycle_mismatch_is_a_hard_reject_now(self) -> None:
        # Phase 1b: the old carve-out ("cycle mismatch is amber, not reject")
        # is removed — 78/83 stored docs were off-cycle because of it.
        assert _verdict(matches_target_cycle=False).accepted is False
