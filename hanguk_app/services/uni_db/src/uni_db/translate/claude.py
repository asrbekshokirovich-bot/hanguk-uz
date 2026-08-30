"""Claude translation adapter.

Plan §P.3 — primary for prose, primary for ko->en pivot legs to languages
that lack direct ko providers (uz, mn).

Phase 3: live call site implemented and gated behind `settings.live_apis`.
With `live_apis=False` the deterministic mock path runs (preserves the
Phase 0/1/2 test contract). Live calls use the Anthropic SDK, mark the
system message as cacheable, and return the parsed first text block.
"""

from __future__ import annotations

import logging
import re
from typing import Any

from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from ..config import settings
from .models import TargetLang, TranslationOutput

log = logging.getLogger(__name__)

# Sonnet pricing (USD per 1M tokens) — same as extract/llm_anthropic.py.
_SONNET_INPUT_USD_PER_M = 3.00
_SONNET_OUTPUT_USD_PER_M = 15.00

# Cheap heuristic to strip ```text``` markdown fences if Claude wraps.
_FENCE_RE = re.compile(r"^\s*```(?:[a-zA-Z]+)?\s*(.*?)\s*```\s*$", re.DOTALL)

# Long-form names of supported targets — used to phrase the prompt.
_LANG_NAMES: dict[TargetLang, str] = {
    "en": "English",
    "uz": "Uzbek",
    "vi": "Vietnamese",
    "mn": "Mongolian",
    "ru": "Russian",
    "id": "Indonesian",
}


def translate(
    *,
    source_text_ko: str,
    target_lang: TargetLang,
    pivot: TargetLang | None = None,
) -> TranslationOutput:
    """Translate one Korean string into ``target_lang``.

    When ``pivot`` is set the input is treated as already-English text
    being translated onward to ``target_lang`` — used by the en-pivot
    flow for languages without direct ko providers.
    """
    if not settings.live_apis:
        prefix = f"[claude-mock {target_lang}]"
        if pivot:
            prefix = f"[claude-mock ko->{pivot}->{target_lang}]"
        return TranslationOutput(
            text_value=f"{prefix} {source_text_ko}".strip(),
            provider="claude",
            confidence=0.55 if pivot else 0.85,
            via_pivot=pivot is not None,
        )

    if settings.llm_backend == "claude_cli":
        text = _call_cli_translate(
            source_text_ko=source_text_ko,
            target_lang=target_lang,
            pivot=pivot,
        )
    else:
        if not settings.anthropic_api_key:
            raise RuntimeError(
                "ANTHROPIC_API_KEY is not set; cannot call Claude translation. "
                "Unset UNI_DB_LIVE_APIS to use the deterministic mock path."
            )
        text = _call_anthropic_translate(
            source_text_ko=source_text_ko,
            target_lang=target_lang,
            pivot=pivot,
        )
    return TranslationOutput(
        text_value=text,
        provider="claude",
        confidence=0.55 if pivot else 0.85,
        via_pivot=pivot is not None,
    )


def _retriable_exception_types() -> tuple[type[BaseException], ...]:  # pragma: no cover
    try:
        from anthropic import (  # type: ignore[import-not-found]
            APIConnectionError,
            APITimeoutError,
            InternalServerError,
            RateLimitError,
        )

        return (APIConnectionError, APITimeoutError, InternalServerError, RateLimitError)
    except ImportError:
        return (ConnectionError, TimeoutError)


def _get_client():  # pragma: no cover — exercised via monkeypatch in tests
    from anthropic import Anthropic

    return Anthropic(
        api_key=settings.anthropic_api_key,
        timeout=settings.http_request_timeout_sec,
    )


@retry(
    reraise=True,
    stop=stop_after_attempt(4),
    wait=wait_exponential(multiplier=2, min=2, max=30),
    retry=retry_if_exception_type(_retriable_exception_types()),
)
def _call_anthropic_translate(
    *,
    source_text_ko: str,
    target_lang: TargetLang,
    pivot: TargetLang | None,
) -> str:
    """Live ko -> target_lang translation via Claude.

    Prompt-cached system message (so a long crawl batch hits the cache
    after the first call). Output is the model's text block, fences
    stripped if it wrapped them.
    """
    client = _get_client()
    target_name = _LANG_NAMES.get(target_lang, target_lang)
    system_text = _build_system_prompt(
        target_lang=target_lang,
        target_name=target_name,
        pivot=pivot,
    )

    response = client.messages.create(
        model=settings.anthropic_model_translate,
        max_tokens=2048,
        system=[
            {
                "type": "text",
                "text": system_text,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[{"role": "user", "content": source_text_ko}],
    )
    raw = _extract_text(response)
    return _strip_fences(raw)


def _build_system_prompt(
    *,
    target_lang: TargetLang,
    target_name: str,
    pivot: TargetLang | None,
) -> str:
    base = (
        f"You are a translator producing high-quality {target_name} prose "
        "for a Korean university admissions information system used by "
        "international students. Translate the user's input into "
        f"{target_name}. Preserve the placeholder tokens of the form "
        "U+27EAG:N U+27EB exactly — they are glossary substitutions for "
        "proper nouns. Do not translate them, do not reformat them.\n\n"
        "Return ONLY the translated text. No commentary, no headings, "
        "no quotation marks around the result, no markdown fences."
    )
    if pivot:
        base += (
            f"\n\nThis is the second leg of a pivoted translation: the "
            f"input is already in {_LANG_NAMES.get(pivot, pivot)}, "
            f"translate it onward to {target_name}."
        )
    return base


def _strip_fences(text: str) -> str:
    match = _FENCE_RE.match(text)
    if match:
        return match.group(1).strip()
    return text.strip()


def _extract_text(response: Any) -> str:
    content = getattr(response, "content", None)
    if not content:
        raise RuntimeError("Claude translation response had no content blocks")
    parts: list[str] = []
    for block in content:
        text = getattr(block, "text", None)
        if isinstance(text, str):
            parts.append(text)
    if not parts:
        raise RuntimeError("Claude translation response had no text blocks")
    return "".join(parts)


def _call_cli_translate(
    *,
    source_text_ko: str,
    target_lang: TargetLang,
    pivot: TargetLang | None,
) -> str:
    """Translation via the keyless Claude CLI backend."""
    from ..extract.llm_cli import run_claude_cli

    target_name = _LANG_NAMES.get(target_lang, target_lang)
    system_text = _build_system_prompt(
        target_lang=target_lang,
        target_name=target_name,
        pivot=pivot,
    )
    raw = run_claude_cli(
        system_text,
        source_text_ko,
        settings.anthropic_model_translate,
        timeout=120.0,
    )
    return _strip_fences(raw)
