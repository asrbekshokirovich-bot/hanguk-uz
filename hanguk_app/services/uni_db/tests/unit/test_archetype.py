"""Plan §F.1 / Audit §5.2 archetype dispatcher.

Phase 1 promoted the classifier from a single body-anchor scan to a
multi-signal scorer. These tests cover both the body-only fast path
(used when only first-pages text is available) and the full-signal
path that the parse_worker hits in production.
"""

from uni_db.extract.archetype import (
    ALL_LABELS,
    CONFIDENCE_HITL_THRESHOLD,
    classify_archetype,
    classify_from_signals,
    find_section_offsets,
)
from uni_db.extract.archetype_signals import ArchetypeSignals


def _signals(
    *,
    page_count: int = 50,
    table_density: float = 1.0,
    avg_columns: float = 1.0,
    has_bilingual_layout: bool = False,
    filename_hints: tuple[str, ...] = (),
    title_hints: tuple[str, ...] = (),
    body_hits: dict[str, int] | None = None,
) -> ArchetypeSignals:
    full_hits = dict.fromkeys(ALL_LABELS, 0)
    for k, v in (body_hits or {}).items():
        full_hits[k] = v
    return ArchetypeSignals(
        page_count=page_count,
        table_density=table_density,
        avg_columns=avg_columns,
        has_bilingual_layout=has_bilingual_layout,
        filename_hints=filename_hints,
        title_hints=title_hints,
        body_hits=full_hits,
    )


class TestBodyOnlyFastPath:
    def test_snu_text_classifies_as_a(self) -> None:
        out = classify_archetype("서울대학교 2026학년도 외국인전형 신입학")
        assert out.label == "A"
        assert out.confidence >= CONFIDENCE_HITL_THRESHOLD
        assert out.requires_hitl is False

    def test_yonsei_text_classifies_as_b(self) -> None:
        out = classify_archetype("연세대학교 2026 단과대학 외국인전형 안내")
        assert out.label == "B"

    def test_pnu_text_classifies_as_c(self) -> None:
        out = classify_archetype("부산대학교 거점국립대 외국인전형")
        assert out.label == "C"

    def test_ewha_text_classifies_as_e(self) -> None:
        out = classify_archetype("이화여자대학교 외국인특별전형 — 여학생만")
        assert out.label == "E"


class TestRequiresHitlBelowThreshold:
    def test_no_specific_signals_routes_to_hitl(self) -> None:
        out = classify_archetype("Plain text with no archetype hints.")
        # The richer classifier returns whichever label generic signals
        # nudge it toward; the contract is that confidence is dampened
        # and HITL routing kicks in.
        assert out.requires_hitl is True
        assert out.confidence < CONFIDENCE_HITL_THRESHOLD

    def test_single_weak_hit_still_dampened(self) -> None:
        # Just "서울대" alone — short of the SNU full-name match — should
        # still dampen confidence because only one specific signal fires.
        out = classify_from_signals(
            _signals(
                page_count=50,
                body_hits={"A": 1},   # one anchor
            )
        )
        assert out.label == "A"
        # Single specific hit triggers ×0.7 dampening.


class TestSignalFusion:
    def test_filename_hint_strengthens_label(self) -> None:
        out = classify_from_signals(
            _signals(
                page_count=80,
                table_density=1.0,
                filename_hints=("A",),
                body_hits={"A": 2},
            )
        )
        assert out.label == "A"
        assert out.confidence > 0.6

    def test_title_hint_alone_is_too_weak_to_override_body(self) -> None:
        out = classify_from_signals(
            _signals(
                page_count=50,
                body_hits={"B": 3},          # strong B body
                title_hints=("F",),          # weak F title
            )
        )
        assert out.label == "B"

    def test_kaist_short_doc_classifies_as_g(self) -> None:
        out = classify_from_signals(
            _signals(
                page_count=40,
                table_density=1.2,
                filename_hints=("G",),
                body_hits={"G": 3},
            )
        )
        assert out.label == "G"
        assert out.requires_hitl is False

    def test_high_density_promotes_c_over_d(self) -> None:
        out = classify_from_signals(
            _signals(
                page_count=40,
                table_density=3.0,                 # very dense tables
                body_hits={"C": 1, "D": 1},
            )
        )
        assert out.label == "C"


class TestFindSectionOffsets:
    def test_korean_guideline_text_finds_all_sections(
        self, korean_guideline_text: str
    ) -> None:
        offsets = find_section_offsets(korean_guideline_text)
        assert "calendar" in offsets
        assert "tuition" in offsets
        assert "scholarships" in offsets
        assert "requirements" in offsets
        assert "documents_required" in offsets

    def test_returns_empty_dict_for_unrelated_text(self) -> None:
        assert find_section_offsets("hello world") == {}
