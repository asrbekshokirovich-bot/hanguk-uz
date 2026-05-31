"""Plan §C.16 / §P.3 — glossary lookup must bypass MT for institution
names and official terms."""

from uni_db.translate.glossary import (
    GlossaryHit,
    apply_glossary_post_translate,
    apply_glossary_pre_translate,
    contains_placeholder_residue,
    lookup,
)


def _cache() -> dict:
    return {
        ("서울대학교", "en"): GlossaryHit(
            term_ko="서울대학교",
            term_value="Seoul National University",
            category="institution_name",
        ),
        ("서울대", "en"): GlossaryHit(
            term_ko="서울대",
            term_value="Seoul National University",
            category="institution_name",
        ),
        ("외국인전형", "en"): GlossaryHit(
            term_ko="외국인전형",
            term_value="Foreign Applicant Track",
            category="official_term",
        ),
    }


class TestLookup:
    def test_returns_hit_when_term_present(self) -> None:
        hit = lookup(_cache(), term_ko="서울대학교", target_lang="en")
        assert hit is not None
        assert hit.term_value == "Seoul National University"

    def test_returns_none_when_missing(self) -> None:
        assert lookup(_cache(), term_ko="없는학교", target_lang="en") is None


class TestPrePostTranslateRoundtrip:
    def test_longer_term_takes_precedence_over_shorter(self) -> None:
        text = "서울대학교의 외국인전형 안내"
        primed, hits = apply_glossary_pre_translate(
            text, cache=_cache(), target_lang="en"
        )
        # Longer match wins: 서울대학교 not 서울대 by itself.
        assert "서울대학교" not in primed
        assert "서울대학교" in [h.term_ko for h in hits]
        assert "외국인전형" in [h.term_ko for h in hits]

    def test_post_translate_substitutes_authoritative_target(self) -> None:
        text = "서울대학교의 외국인전형"
        primed, hits = apply_glossary_pre_translate(
            text, cache=_cache(), target_lang="en"
        )
        # Pretend MT happened — for the test we just keep `primed`.
        out = apply_glossary_post_translate(primed, hits)
        assert "Seoul National University" in out
        assert "Foreign Applicant Track" in out


class TestPostTranslateRobustness:
    """The placeholder ⟪G:N⟫ gets mangled by MT (esp. ko→en→uz). Restore must
    tolerate that and never leak a placeholder into the output."""

    _hits = [
        GlossaryHit(term_ko="고려대학교", term_value="Korea University", category="institution"),
        GlossaryHit(term_ko="외국인전형", term_value="Foreign Applicant Track", category="term"),
    ]

    def test_exact_placeholder_restored(self) -> None:
        assert apply_glossary_post_translate("2026 ⟪G:0⟫ 안내", self._hits) == "2026 Korea University 안내"

    def test_mangled_single_brackets_restored(self) -> None:
        assert apply_glossary_post_translate("2026 ⟨G:0⟩ Plan", self._hits) == "2026 Korea University Plan"

    def test_spaces_and_index_one_restored(self) -> None:
        assert apply_glossary_post_translate("⟨ G : 1 ⟩ guide", self._hits) == "Foreign Applicant Track guide"

    def test_lost_index_literal_N_is_stripped(self) -> None:
        out = apply_glossary_post_translate("2028 Academic Year ⟨G:N⟩ University Plan", self._hits)
        assert "⟨" not in out and "G:N" not in out
        assert out == "2028 Academic Year University Plan"

    def test_out_of_range_index_stripped(self) -> None:
        assert apply_glossary_post_translate("x ⟪G:9⟫ y", self._hits) == "x y"

    def test_plain_text_unchanged(self) -> None:
        assert apply_glossary_post_translate("plain text", self._hits) == "plain text"


class TestContainsPlaceholderResidue:
    def test_detects_exact_and_mangled_forms(self) -> None:
        assert contains_placeholder_residue("name ⟪G:0⟫")
        assert contains_placeholder_residue("name ⟨G:N⟩ x")
        assert contains_placeholder_residue("a « G : 2 » b")

    def test_clean_text_has_no_residue(self) -> None:
        assert not contains_placeholder_residue("Seoul National University")
        assert not contains_placeholder_residue("한양대학교")
