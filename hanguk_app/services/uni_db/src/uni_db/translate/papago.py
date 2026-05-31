"""Naver Papago adapter.

Plan §P.3: best ko<->vi and ko<->id. No first-party ko<->uz path
(audit §P-6 risk). Phase 3: live HTTP call implemented and gated
behind ``settings.live_apis``.

Papago Cloud uses an apigw.ntruss.com endpoint and bearer-style
auth via two header values (Client ID / Client Secret). We use httpx
synchronously here — the worker is single-threaded today, and the
extra async machinery isn't worth it for the per-row latency.
"""

from __future__ import annotations

import logging

import httpx
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from ..config import settings
from .models import TargetLang, TranslationOutput

log = logging.getLogger(__name__)

# Papago supports these directly from Korean.
PAPAGO_SUPPORTED_FROM_KO: frozenset[TargetLang] = frozenset(
    {"en", "vi", "id", "ru"}     # ru via N2MT; uz / mn unsupported
)

_PAPAGO_ENDPOINT = "https://naveropenapi.apigw.ntruss.com/nmt/v1/translation"

# Papago BCP-47 codes per its REST docs.
_PAPAGO_LANG_CODES: dict[TargetLang, str] = {
    "en": "en",
    "vi": "vi",
    "id": "id",
    "ru": "ru",
}


class PapagoAPIError(RuntimeError):
    """Wraps non-2xx responses from Papago."""


def translate(*, source_text_ko: str, target_lang: TargetLang) -> TranslationOutput:
    if target_lang not in PAPAGO_SUPPORTED_FROM_KO:
        raise ValueError(
            f"Papago does not support ko->{target_lang}; pivot via Claude required."
        )
    if not settings.live_apis:
        return TranslationOutput(
            text_value=f"[papago-mock {target_lang}] {source_text_ko}".strip(),
            provider="papago",
            confidence=0.82,
        )
    if not (settings.naver_papago_client_id and settings.naver_papago_client_secret):
        raise RuntimeError(
            "Papago credentials missing. Set NAVER_PAPAGO_CLIENT_ID and "
            "NAVER_PAPAGO_CLIENT_SECRET, or unset UNI_DB_LIVE_APIS."
        )

    translated = _call_papago(
        source_text_ko=source_text_ko,
        target_lang=target_lang,
    )
    return TranslationOutput(
        text_value=translated,
        provider="papago",
        confidence=0.82,
    )


@retry(
    reraise=True,
    stop=stop_after_attempt(4),
    wait=wait_exponential(multiplier=2, min=2, max=30),
    retry=retry_if_exception_type((httpx.HTTPError, PapagoAPIError)),
)
def _call_papago(
    *,
    source_text_ko: str,
    target_lang: TargetLang,
) -> str:
    headers = {
        "X-NCP-APIGW-API-KEY-ID": settings.naver_papago_client_id,
        "X-NCP-APIGW-API-KEY": settings.naver_papago_client_secret,
        "User-Agent": settings.http_user_agent,
    }
    data = {
        "source": "ko",
        "target": _PAPAGO_LANG_CODES[target_lang],
        "text": source_text_ko,
    }
    with httpx.Client(timeout=settings.http_request_timeout_sec) as client:
        response = client.post(_PAPAGO_ENDPOINT, headers=headers, data=data)
    if response.status_code >= 500 or response.status_code == 429:
        # Retriable: server error or rate limit
        raise PapagoAPIError(
            f"Papago returned {response.status_code}: {response.text[:200]!r}"
        )
    if response.status_code != 200:
        # Non-retriable client errors (400, 401, 403, 404)
        raise RuntimeError(
            f"Papago non-retriable error {response.status_code}: "
            f"{response.text[:200]!r}"
        )
    body = response.json()
    try:
        return body["message"]["result"]["translatedText"]
    except (KeyError, TypeError) as exc:
        raise PapagoAPIError(
            f"Papago response missing translatedText: {body!r}"
        ) from exc
