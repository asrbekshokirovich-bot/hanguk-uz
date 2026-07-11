"""Thin JSON-returning Claude call for the verifier agents.

Reuses the extractor's Anthropic client + fence-stripping so identity / grounding
/ critic calls share one code path and one retry policy. Gated on
`settings.live_apis`; with the flag off it raises (verifier unit tests inject a
fake `call_json` and never reach here).
"""

from __future__ import annotations

import json
import logging
from typing import Any

from ..config import settings
from ..extract.llm_anthropic import (
    AnthropicResponseError,
    _extract_text,
    _get_client,
    _strip_fences,
)

log = logging.getLogger(__name__)

# (system, user, model) -> parsed JSON object. The injection seam for tests.
CallJson = Any  # Callable[[str, str, str], dict[str, Any]] — kept loose for fakes


def call_json(system: str, user: str, model: str, *, max_tokens: int = 2048) -> dict[str, Any]:
    """One Claude call that must return a JSON object. Raises when live_apis is
    off or the model returns non-JSON."""
    if not settings.live_apis:
        raise RuntimeError(
            "verify.call_json needs UNI_DB_LIVE_APIS=true (paid Claude call). "
            "Tests should inject a fake call_json instead."
        )
    if not settings.anthropic_api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is not set; cannot run verification agents.")

    client = _get_client()
    response = client.messages.create(
        model=model,
        max_tokens=max_tokens,
        system=[{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
        messages=[{"role": "user", "content": user}],
    )
    raw = _strip_fences(_extract_text(response))
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        start, end = raw.find("{"), raw.rfind("}")
        if start != -1 and end > start:
            try:
                parsed = json.loads(raw[start : end + 1])
            except json.JSONDecodeError:
                parsed = None
        else:
            parsed = None
        if parsed is None:
            raise AnthropicResponseError(f"verifier response not JSON: {raw[:200]!r}") from None
    if not isinstance(parsed, dict):
        raise AnthropicResponseError(f"verifier response was {type(parsed).__name__}, expected dict")
    return parsed
