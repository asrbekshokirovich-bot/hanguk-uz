"""Translation orchestrator.

Plan §P.3 provider routing:
    ko → en   : Claude (prose) | DeepL (labels)
    ko → uz   : Pivot via en (Claude both hops); confidence -= 0.15
    ko → vi   : Papago primary; Claude fallback
    ko → mn   : Pivot via en (Claude); always low-confidence
    ko → ru   : DeepL
    ko → id   : Papago

Phase 0/1: every adapter returns mocks; the pipeline composition is real
so we can verify the routing logic and the back-translation QC plumbing.

Phase 2 (per ADR-004 + ADR-007):
    Default-on languages — `ko` (canonical, no translation) and `en`
    (required for the in-office reviewer + counselor UX).
    Default-off languages — `uz`, `vi`, `mn`, `ru`, `id` are gated
    behind `settings.live_apis` AND `settings.translation_languages_enabled`
    contains the target language. Calling translate() with a disabled
    target lang raises `LanguageNotEnabledError`.

    ADR-004: Uzbek explicitly stays Phase 3 — even though it's the
    primary user cohort's language (ADR-007), shipping broken pivoted
    Uzbek without a native reviewer would destroy trust. The "View
    original (한국어)" toggle is the Phase 2 safety valve.
"""

from __future__ import annotations

import logging
import re
from typing import Callable, Final

from ..config import settings
from . import claude as claude_adapter
from . import deepl as deepl_adapter
from . import papago as papago_adapter
from .back_translation_qc import (
    confidence_from_back_translation,
    normalized_distance,
)
from .glossary import (
    GlossaryCache,
    apply_glossary_post_translate,
    apply_glossary_pre_translate,
    contains_placeholder_residue,
)
from .models import TargetLang, TranslationOutput

log = logging.getLogger(__name__)


PIVOT_VIA_EN: Final[frozenset[TargetLang]] = frozenset({"uz"})  # ADR-004-amend-3: mn dropped


# Default-on translation targets.
# ADR-004-amend-1 (2026-05-08): Uzbek added by owner override despite
# the absence of a native reviewer.
# ADR-004-amend-2 (2026-05-10): Vietnamese and Mongolian added under
# the same risk profile ahead of cohort growth.
# ADR-004-amend-3 (2026-05-17): owner reverted vi/mn — contracted
# students don't need either right now; translating prose we won't
# surface burns tokens for no user value. Re-add by setting
# UNI_DB_TRANSLATION_LANGUAGES=en,uz,vi,mn at the env layer.
# Korean is canonical and isn't a "translation target".
DEFAULT_ENABLED_LANGUAGES: Final[frozenset[TargetLang]] = frozenset({"en", "uz"})


class LanguageNotEnabledError(RuntimeError):
    """Raised when a translation is requested for a language that is
    explicitly disabled in this phase. ADR-004 is the canonical
    explanation for why Uzbek raises this in Phase 2."""


def enabled_languages() -> frozenset[TargetLang]:
    """Resolve the active enabled-languages set.

    Phase 2 default = {"en"}. Operator can override via env:
        UNI_DB_TRANSLATION_LANGUAGES=en,uz
    """
    raw = getattr(settings, "translation_languages_enabled", None)
    if not raw:
        return DEFAULT_ENABLED_LANGUAGES
    if isinstance(raw, str):
        parsed = {item.strip() for item in raw.split(",") if item.strip()}
        return frozenset(parsed)  # type: ignore[arg-type]
    return frozenset(raw)


# --- output sanity guard --------------------------------------------------- #
# Provider error strings and leaked model reasoning have been observed stored as
# translations (audit: an English institution name became the model's
# "...Wait — I need to reconsider..." deliberation; a Korean
# "트러스트 토큰... 입력되었습니다" error was prepended to another). Drop these
# before they reach a user — the worker keeps the Korean original instead.
_SUSPECT_MARKERS = re.compile(r"(트러스트 토큰|입력되었습니다|I need to reconsider)")
# Any target-language letter — Latin (covers en/uz/vi base letters) or Cyrillic
# (ru). Korean-only output for these targets means MT echoed the source.
_TARGET_SCRIPT = re.compile(r"[A-Za-zЀ-ӿ]")
_HANGUL = re.compile(r"[가-힣]")


def is_suspect_translation(text: str, target_lang: TargetLang) -> bool:
    """True when MT output looks like garbage we must not persist: empty, a
    provider/error or model-reasoning leak, a surviving glossary placeholder, or
    a no-op echo (Korean returned unchanged for a non-Korean target)."""
    t = (text or "").strip()
    if not t:
        return True
    if _SUSPECT_MARKERS.search(t):
        return True
    if contains_placeholder_residue(t):
        return True
    if target_lang != "ko" and _HANGUL.search(t) and not _TARGET_SCRIPT.search(t):
        return True
    return False


def translate(
    *,
    source_text_ko: str,
    target_lang: TargetLang,
    glossary: GlossaryCache,
    is_label: bool = False,
    back_translate_fn: Callable[[str, TargetLang], str] | None = None,
) -> TranslationOutput:
    """Translate one field.

    Args:
        is_label: True for short institution names / category names. We
                  prefer DeepL (cheaper) over Claude when supported.
        back_translate_fn: optional injected back-translator for QC. If
                           None, back-translation distance is left null.

    Raises:
        LanguageNotEnabledError: if `target_lang` is not in the active
            enabled-languages set. Phase 2 ships only `en`. ADR-004
            covers why `uz` is deferred to Phase 3.
    """
    if target_lang not in enabled_languages():
        raise LanguageNotEnabledError(
            f"target_lang={target_lang!r} is not enabled in this phase. "
            f"Active set: {sorted(enabled_languages())}. "
            "ADR-004: Uzbek ships in Phase 3 with native reviewer; "
            "until then, Uzbek-speaking users see the Korean original "
            "and English translation per plan §P.4 'View original' toggle."
        )

    primed_text, hits = apply_glossary_pre_translate(
        source_text_ko, cache=glossary, target_lang=target_lang
    )

    primary = _pick_primary(target_lang=target_lang, is_label=is_label)
    out = primary(primed_text, target_lang)

    finalized_text = apply_glossary_post_translate(out.text_value, hits)

    if back_translate_fn is not None:
        try:
            roundtrip_ko = back_translate_fn(finalized_text, target_lang)
            distance = normalized_distance(source_text_ko, roundtrip_ko)
            new_conf = confidence_from_back_translation(
                llm_self_confidence=out.confidence,
                normalized_back_trans_distance=distance,
            )
            return TranslationOutput(
                text_value=finalized_text,
                provider=out.provider,
                confidence=new_conf,
                back_trans_distance=distance,
                via_pivot=out.via_pivot,
            )
        except Exception as exc:  # pragma: no cover — guarded for ops
            log.warning("back-translation QC failed: %s", exc)

    return TranslationOutput(
        text_value=finalized_text,
        provider=out.provider,
        confidence=out.confidence,
        back_trans_distance=None,
        via_pivot=out.via_pivot,
    )


def _pick_primary(
    *,
    target_lang: TargetLang,
    is_label: bool,
) -> Callable[[str, TargetLang], TranslationOutput]:
    if target_lang == "en":
        if is_label and settings.deepl_api_key:
            return _wrap(deepl_adapter.translate)
        return _wrap(claude_adapter.translate)

    if target_lang in PIVOT_VIA_EN:
        return _pivoted_via_en

    if target_lang in {"vi", "id"}:
        # Papago is preferred for vi/id quality, but it requires Naver Cloud
        # credentials. When they're absent (early Phase 4 ops), fall back
        # to Claude so the worker stays productive.
        if settings.naver_papago_client_id and settings.naver_papago_client_secret:
            return _wrap(papago_adapter.translate)
        log.info(
            "translate: Papago credentials missing — falling back to Claude for ko->%s",
            target_lang,
        )
        return _wrap(claude_adapter.translate)

    if target_lang == "ru":
        # DeepL is preferred for ru, but falls back to Claude when DeepL
        # credentials are missing.
        if settings.deepl_api_key:
            return _wrap(deepl_adapter.translate)
        log.info(
            "translate: DeepL credentials missing — falling back to Claude for ko->ru",
        )
        return _wrap(claude_adapter.translate)

    raise ValueError(f"unsupported target_lang: {target_lang}")


def _wrap(
    fn: Callable[..., TranslationOutput],
) -> Callable[[str, TargetLang], TranslationOutput]:
    def runner(text: str, lang: TargetLang) -> TranslationOutput:
        return fn(source_text_ko=text, target_lang=lang)

    return runner


def _pivoted_via_en(text: str, lang: TargetLang) -> TranslationOutput:
    # ko → en
    en_step = claude_adapter.translate(source_text_ko=text, target_lang="en")
    # en → target
    final = claude_adapter.translate(
        source_text_ko=en_step.text_value, target_lang=lang, pivot="en"
    )
    return TranslationOutput(
        text_value=final.text_value,
        provider="claude",
        confidence=max(0.0, final.confidence - 0.15),
        via_pivot=True,
    )
