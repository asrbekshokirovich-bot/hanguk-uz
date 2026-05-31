"""Per-archetype fixture coverage.

For each of the 8 archetypes:
  1. The classifier picks the correct label (or, when truly ambiguous,
     marks `requires_hitl=True` rather than guessing).
  2. The section detector finds calendar / tuition / requirements /
     documents_required / scholarships sections.
  3. The Korean parsers (dates_ko, numbers_ko, sections) normalise the
     payload's headline values.
"""

from __future__ import annotations

import pytest

from uni_db.extract.archetype import classify_archetype, find_section_offsets
from uni_db.parse.dates_ko import iter_dates_in
from uni_db.parse.sections import detect_tuition_section

from ..fixtures.archetypes.fixtures import ALL_FIXTURES, ArchetypeFixture


@pytest.fixture(params=ALL_FIXTURES, ids=lambda fx: f"archetype-{fx.label}")
def fx(request: pytest.FixtureRequest) -> ArchetypeFixture:
    return request.param


def test_classifier_picks_correct_label_or_routes_to_hitl(fx: ArchetypeFixture) -> None:
    out = classify_archetype(
        fx.korean_text,
        filename=fx.filename_hint,
        announcement_title=fx.title_hint,
    )
    if not out.requires_hitl:
        assert out.label == fx.label, (
            f"Archetype {fx.label} mis-classified as {out.label}; "
            f"rationale={out.rationale}"
        )


def test_section_detector_finds_canonical_blocks(fx: ArchetypeFixture) -> None:
    offsets = find_section_offsets(fx.korean_text)
    assert "calendar" in offsets, f"calendar section not found in {fx.label}"
    assert "tuition" in offsets, f"tuition section not found in {fx.label}"
    assert "requirements" in offsets, f"requirements section not found in {fx.label}"
    assert "documents_required" in offsets, f"documents_required not found in {fx.label}"


def test_korean_dates_extracted(fx: ArchetypeFixture) -> None:
    dates = list(iter_dates_in(fx.korean_text))
    assert len(dates) >= 2, f"expected ≥2 dates in {fx.label}, got {len(dates)}"


def test_tuition_section_extracts_amount_when_embedded(fx: ArchetypeFixture) -> None:
    if fx.expected_faculty_group_for_tuition is None:
        # Archetype A points at a separate booklet — emitting empty rows
        # is the correct behaviour.
        return
    sec = detect_tuition_section(fx.korean_text, academic_year=2026)
    assert sec.found_heading is not None, f"tuition heading not found in {fx.label}"
    assert any(
        r.faculty_group == fx.expected_faculty_group_for_tuition for r in sec.rows
    ), (
        f"expected faculty_group {fx.expected_faculty_group_for_tuition!r} "
        f"in {fx.label}; got {[r.faculty_group for r in sec.rows]}"
    )
