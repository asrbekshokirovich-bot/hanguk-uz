"""Translation pipeline routing tests (mocked).

Plan §P.3 provider strategy:
    en  → Claude (prose) / DeepL (labels)
    uz  → pivot via en (Claude both hops); confidence -= 0.15
    vi  → Papago primary
    ru  → DeepL

Phase 2 (ADR-004): only `en` is enabled by default. Tests that exercise
non-en targets opt in by widening `settings.translation_languages_enabled`
via monkeypatch so the routing logic stays exercised even with the
ADR-004 default-off gate in place.
"""

import pytest

from uni_db.translate import pipeline
from uni_db.translate.glossary import GlossaryHit
from uni_db.translate.pipeline import (
    LanguageNotEnabledError,
    is_suspect_translation,
    translate,
)


def _glossary() -> dict:
    return {
        ("서울대학교", "en"): GlossaryHit(
            term_ko="서울대학교",
            term_value="Seoul National University",
            category="institution_name",
        ),
        ("서울대학교", "uz"): GlossaryHit(
            term_ko="서울대학교",
            term_value="Seul Milliy Universiteti",
            category="institution_name",
        ),
        ("외국인전형", "en"): GlossaryHit(
            term_ko="외국인전형",
            term_value="Foreign Applicant Track",
            category="official_term",
        ),
    }


class TestPipelineRouting:
    def test_label_to_english_uses_deepl_mock(self, monkeypatch) -> None:
        # Phase 4 added a no-DeepL-key fallback to Claude. Set a stub key
        # so the routing test continues to assert the DeepL-preferred path.
        monkeypatch.setattr(pipeline.settings, "deepl_api_key", "stub", raising=False)
        out = translate(
            source_text_ko="서울대학교",
            target_lang="en",
            glossary=_glossary(),
            is_label=True,
        )
        # Glossary hit replaces the whole token before MT runs.
        assert "Seoul National University" in out.text_value
        assert out.provider == "deepl"

    def test_prose_to_english_uses_claude_mock(self) -> None:
        out = translate(
            source_text_ko="서울대학교의 외국인전형 안내입니다.",
            target_lang="en",
            glossary=_glossary(),
            is_label=False,
        )
        assert "Seoul National University" in out.text_value
        assert "Foreign Applicant Track" in out.text_value
        assert out.provider == "claude"

    def test_uzbek_pivots_via_english(self, monkeypatch) -> None:
        # ADR-004: uz is default-off in Phase 2; widen to test routing.
        monkeypatch.setattr(
            pipeline.settings, "translation_languages_enabled", "en,uz",
            raising=False,
        )
        out = translate(
            source_text_ko="외국인전형 모집요강",
            target_lang="uz",
            glossary=_glossary(),
        )
        assert out.via_pivot is True
        assert out.confidence < 0.85       # pivot tax applied
        assert out.provider == "claude"

    def test_vietnamese_uses_papago(self, monkeypatch) -> None:
        monkeypatch.setattr(
            pipeline.settings, "translation_languages_enabled", "en,vi",
            raising=False,
        )
        # Phase 4 added a Papago-cred fallback to Claude. Stub the creds
        # so the routing test continues to assert the Papago-preferred path.
        monkeypatch.setattr(pipeline.settings, "naver_papago_client_id", "stub", raising=False)
        monkeypatch.setattr(pipeline.settings, "naver_papago_client_secret", "stub", raising=False)
        out = translate(
            source_text_ko="모집요강",
            target_lang="vi",
            glossary={},
        )
        assert out.provider == "papago"

    def test_russian_uses_deepl(self, monkeypatch) -> None:
        monkeypatch.setattr(
            pipeline.settings, "translation_languages_enabled", "en,ru",
            raising=False,
        )
        monkeypatch.setattr(pipeline.settings, "deepl_api_key", "stub", raising=False)
        out = translate(
            source_text_ko="모집요강",
            target_lang="ru",
            glossary={},
        )
        assert out.provider == "deepl"


class TestDefaultLanguageGate:
    """Default-on languages: `en`, `uz`, `vi`, `mn`
    (per ADR-004-amend-1 2026-05-08 and ADR-004-amend-2 2026-05-10).

    `ru` and `id` still raise LanguageNotEnabledError until explicitly
    enabled via UNI_DB_TRANSLATION_LANGUAGES.
    """

    def test_uz_works_by_default(self) -> None:
        out = translate(
            source_text_ko="외국인전형",
            target_lang="uz",
            glossary={},
        )
        assert out.via_pivot is True
        assert out.confidence < 0.85       # pivot tax still applied
        assert out.provider == "claude"

    def test_vi_raises_by_default(self) -> None:
        # ADR-004-amend-3 (2026-05-17): vi reverted from default-on.
        # The contracted-student cohort doesn't need Vietnamese right now;
        # re-enable later by setting UNI_DB_TRANSLATION_LANGUAGES=en,uz,vi
        # at the env layer.
        with pytest.raises(LanguageNotEnabledError):
            translate(
                source_text_ko="외국인전형",
                target_lang="vi",
                glossary={},
            )

    def test_mn_raises_by_default(self) -> None:
        # ADR-004-amend-3 (2026-05-17): mn reverted from default-on
        # alongside vi (no Mongolian-speaking cohort currently).
        with pytest.raises(LanguageNotEnabledError):
            translate(
                source_text_ko="외국인전형",
                target_lang="mn",
                glossary={},
            )

    def test_ru_raises_by_default(self) -> None:
        with pytest.raises(LanguageNotEnabledError):
            translate(
                source_text_ko="외국인전형",
                target_lang="ru",
                glossary={},
            )

    def test_en_works_by_default(self) -> None:
        out = translate(
            source_text_ko="외국인전형",
            target_lang="en",
            glossary={},
        )
        assert out.provider == "claude"


class TestBackTranslationHook:
    def test_back_translate_callback_is_invoked_when_supplied(self) -> None:
        called: list[tuple[str, str]] = []

        def fake_back(text: str, lang: str) -> str:
            called.append((text, lang))
            return "외국인전형 모집요강"      # identical → distance ≈ 0

        out = translate(
            source_text_ko="외국인전형 모집요강",
            target_lang="en",
            glossary={},
            back_translate_fn=fake_back,
        )
        assert called, "back-translate fn should be invoked"
        assert out.back_trans_distance is not None
        assert out.back_trans_distance < 1.0


class TestPendingSqlCoverage:
    """Phase 5: the translate worker must also queue the published admission
    content (not just institution names + announcement titles), so applicants
    read the actual data in EN/UZ."""

    def test_pending_sql_includes_published_content(self) -> None:
        from uni_db.workers.translate_worker import PENDING_SQL

        for entity_type in ("institutions", "announcements", "requirements",
                             "scholarships", "documents_required"):
            assert f"'{entity_type}'" in PENDING_SQL, entity_type
        for field in ("prose_ko", "name_ko", "document_type", "notes_ko"):
            assert field in PENDING_SQL, field

    def test_pending_sql_skips_domain_placeholder_institution_names(self) -> None:
        # Domain-string placeholder names (e.g. 'cdu.ac.kr') have no Hangul and
        # must not be machine-translated into junk like 'cdu.ac.kr (EN)'.
        from uni_db.workers.translate_worker import PENDING_SQL

        assert "i.name_ko ~ '[가-힣]'" in PENDING_SQL


class TestSuspectTranslationGuard:
    """Audit: provider error strings and leaked model reasoning were stored as
    translations (an English institution name became the model's
    '...Wait — I need to reconsider...' deliberation). is_suspect_translation
    drops these before they're persisted."""

    def test_empty_is_suspect(self) -> None:
        assert is_suspect_translation("", "en")
        assert is_suspect_translation("   ", "uz")

    def test_provider_error_marker_is_suspect(self) -> None:
        assert is_suspect_translation(
            "트러스트 토큰이 없는 일반 텍스트가 입력되었습니다.", "vi")

    def test_model_reasoning_leak_is_suspect(self) -> None:
        assert is_suspect_translation(
            "Hallym University\n\nWait — I need to reconsider. 한라대학교 is Halla.", "en")

    def test_surviving_glossary_placeholder_is_suspect(self) -> None:
        assert is_suspect_translation("of ⟨G:N⟩ Gangwon University", "vi")

    def test_korean_echo_for_latin_target_is_suspect(self) -> None:
        # no-op: Korean returned unchanged for a non-Korean target
        assert is_suspect_translation("한양대학교", "en")
        assert is_suspect_translation("제주대학교", "uz")

    def test_clean_translations_are_not_suspect(self) -> None:
        assert not is_suspect_translation("Seoul National University", "en")
        assert not is_suspect_translation("Seul Milliy Universiteti", "uz")
        assert not is_suspect_translation("Đại học Yonsei", "vi")
