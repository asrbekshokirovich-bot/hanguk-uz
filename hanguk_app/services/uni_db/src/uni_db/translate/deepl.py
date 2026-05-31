"""DeepL adapter.

Plan §P.3: excellent ko<->en, ko<->ru. Cheap per-character. Used
primarily for short labels (institution names, recruitment-unit
names) where DeepL's accuracy is comparable to Claude at a fraction
of the cost.

Phase 3: live call implemented and gated behind ``settings.live_apis``.
Uses the official ``deepl`` Python SDK (already a dependency).
"""

from __future__ import annotations

import logging

from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from ..config import settings
from .models import TargetLang, TranslationOutput

log = logging.getLogger(__name__)

DEEPL_SUPPORTED_FROM_KO: frozenset[TargetLang] = frozenset({"en", "ru", "id"})

# DeepL uses upper-case BCP-47 with optional region; for our targets
# the bare two-letter form is fine.
_DEEPL_LANG_CODES: dict[TargetLang, str] = {
    "en": "EN-US",
    "ru": "RU",
    "id": "ID",
}


class DeepLAPIError(RuntimeError):
    """Wraps DeepL transport / quota failures."""


def translate(*, source_text_ko: str, target_lang: TargetLang) -> TranslationOutput:
    if target_lang not in DEEPL_SUPPORTED_FROM_KO:
        raise ValueError(f"DeepL does not support ko->{target_lang}.")
    if not settings.live_apis:
        return TranslationOutput(
            text_value=f"[deepl-mock {target_lang}] {source_text_ko}".strip(),
            provider="deepl",
            confidence=0.88,
        )
    if not settings.deepl_api_key:
        raise RuntimeError(
            "DEEPL_API_KEY missing. Set the key or unset UNI_DB_LIVE_APIS."
        )

    translated = _call_deepl(
        source_text_ko=source_text_ko,
        target_lang=target_lang,
    )
    return TranslationOutput(
        text_value=translated,
        provider="deepl",
        confidence=0.88,
    )


def _retriable_exception_types() -> tuple[type[BaseException], ...]:  # pragma: no cover
    """DeepL SDK raises typed exceptions for quota / connection issues."""
    try:
        from deepl import (  # type: ignore[import-not-found]
            ConnectionException,
            QuotaExceededException,
            TooManyRequestsException,
        )

        return (ConnectionException, QuotaExceededException, TooManyRequestsException)
    except ImportError:
        return (ConnectionError, TimeoutError)


def _get_translator():  # pragma: no cover — exercised via monkeypatch
    import deepl

    return deepl.Translator(settings.deepl_api_key)


@retry(
    reraise=True,
    stop=stop_after_attempt(4),
    wait=wait_exponential(multiplier=2, min=2, max=30),
    retry=retry_if_exception_type(_retriable_exception_types()),
)
def _call_deepl(
    *,
    source_text_ko: str,
    target_lang: TargetLang,
) -> str:
    translator = _get_translator()
    target_code = _DEEPL_LANG_CODES[target_lang]
    result = translator.translate_text(
        source_text_ko,
        source_lang="KO",
        target_lang=target_code,
    )
    # The SDK returns either a TextResult or a list[TextResult] depending
    # on input type. We pass a single string, so we expect a single
    # TextResult, but defensively unwrap a list-of-one.
    if isinstance(result, list):
        if not result:
            raise DeepLAPIError("DeepL returned an empty result list")
        result = result[0]
    text = getattr(result, "text", None)
    if not isinstance(text, str):
        raise DeepLAPIError(f"DeepL result missing .text attribute: {result!r}")
    return text
