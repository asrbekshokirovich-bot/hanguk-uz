"""Low-level HTTP transport for the Uzum REST + GraphQL APIs.

Responsibilities:
  * build the header set the Uzum web client sends (auth, x-iid, apollo, UA);
  * be a polite citizen — a minimum delay + jitter between requests;
  * retry transient failures (network errors, 429, 5xx) with exponential
    backoff, honouring ``Retry-After`` when present;
  * translate HTTP/GraphQL failures into the package's exception hierarchy.
"""

from __future__ import annotations

import random
import time
from typing import Any

import httpx

from .config import Config
from .errors import (
    AuthError,
    GraphQLError,
    NotFoundError,
    RateLimitedError,
    UzumHTTPError,
)
from .logging_setup import get_logger

log = get_logger(__name__)

# A realistic desktop Chrome UA — Uzum's gateway rejects obviously-bot agents.
_DEFAULT_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
_RETRYABLE_STATUS = {429, 500, 502, 503, 504}

# api.uzum.uz requires *an* Authorization header, but public endpoints (the
# category tree) accept any non-empty bearer value. When the user hasn't
# supplied a real token we still send this placeholder so those endpoints work
# out of the box; token-gated endpoints (GraphQL search, product details,
# reviews) then fail with a clear AuthError instead of a cryptic one.
_PLACEHOLDER_TOKEN = "anonymous"


class _RateLimiter:
    """Enforce a minimum spacing (+ jitter) between consecutive requests."""

    def __init__(self, min_delay: float, jitter: float):
        self.min_delay = max(0.0, min_delay)
        self.jitter = max(0.0, jitter)
        self._last: float = 0.0

    def wait(self) -> None:
        now = time.monotonic()
        target = self._last + self.min_delay + random.uniform(0.0, self.jitter)
        sleep_for = target - now
        if sleep_for > 0:
            time.sleep(sleep_for)
        self._last = time.monotonic()


class HttpClient:
    """Thin wrapper around :class:`httpx.Client` with Uzum-specific behaviour."""

    def __init__(self, config: Config, *, transport: httpx.BaseTransport | None = None):
        self.config = config
        self._limiter = _RateLimiter(config.min_delay, config.jitter)
        self._client = httpx.Client(
            timeout=config.timeout,
            http2=True,
            follow_redirects=False,  # a 302 to the captcha page means "auth needed"
            headers=self._base_headers(),
            transport=transport,
        )

    # -- header construction ------------------------------------------------
    def _base_headers(self) -> dict[str, str]:
        headers = {
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": self.config.language,
            "User-Agent": _DEFAULT_UA,
            "Origin": "https://uzum.uz",
            "Referer": "https://uzum.uz/",
            "apollographql-client-name": "web-customer",
            "apollographql-client-version": "1.0.0",
        }
        if self.config.iid:
            headers["x-iid"] = self.config.iid
        token = self.config.auth_token or _PLACEHOLDER_TOKEN
        headers["Authorization"] = f"Bearer {token}"
        return headers

    @property
    def has_real_token(self) -> bool:
        return bool(self.config.auth_token)

    # -- public API ---------------------------------------------------------
    def get_json(self, path: str, params: dict[str, Any] | None = None) -> Any:
        """GET a REST endpoint and return parsed JSON (the raw payload envelope)."""
        url = self._rest_url(path)
        resp = self._request("GET", url, params=params)
        return _json_or_error(resp, url)

    def graphql(self, operation_name: str, query: str, variables: dict[str, Any]) -> dict[str, Any]:
        """POST a GraphQL operation and return the ``data`` object."""
        payload = {
            "operationName": operation_name,
            "query": query,
            "variables": variables,
        }
        resp = self._request(
            "POST",
            self.config.graphql_url,
            json=payload,
            headers={"Content-Type": "application/json"},
        )
        body = _json_or_error(resp, self.config.graphql_url)
        if isinstance(body, dict) and body.get("errors"):
            # Some GraphQL errors still carry partial data; surface the errors.
            raise GraphQLError(body["errors"])
        data = body.get("data") if isinstance(body, dict) else None
        if data is None:
            raise GraphQLError([{"message": "GraphQL response had no 'data'"}])
        return data

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> HttpClient:
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    # -- internals ----------------------------------------------------------
    def _rest_url(self, path: str) -> str:
        if path.startswith("http://") or path.startswith("https://"):
            return path
        return f"{self.config.rest_base.rstrip('/')}/{path.lstrip('/')}"

    def _request(self, method: str, url: str, **kwargs: Any) -> httpx.Response:
        attempts = self.config.max_retries + 1
        last_exc: Exception | None = None

        for attempt in range(1, attempts + 1):
            self._limiter.wait()
            try:
                resp = self._client.request(method, url, **kwargs)
            except (httpx.TransportError, httpx.TimeoutException) as exc:
                last_exc = exc
                if attempt >= attempts:
                    break
                delay = _backoff(attempt)
                log.warning(
                    "network error (%s), retry %d/%d in %.1fs", exc, attempt, attempts - 1, delay
                )
                time.sleep(delay)
                continue

            if resp.status_code in _RETRYABLE_STATUS and attempt < attempts:
                delay = _retry_after(resp) or _backoff(attempt)
                log.warning(
                    "HTTP %d from %s, retry %d/%d in %.1fs",
                    resp.status_code,
                    url,
                    attempt,
                    attempts - 1,
                    delay,
                )
                time.sleep(delay)
                continue

            return self._check_response(resp, url)

        assert last_exc is not None
        raise UzumHTTPError(0, f"request failed after {attempts} attempts: {last_exc}", url=url)

    def _check_response(self, resp: httpx.Response, url: str) -> httpx.Response:
        code = resp.status_code
        if code < 400:
            # A 302 here means Uzum bounced us to the captcha/login flow.
            if code in (301, 302, 303, 307, 308):
                raise AuthError(
                    code,
                    "redirected away from the API — the token is likely missing or expired. "
                    "Grab a fresh one (see README 'Getting a token').",
                    url=url,
                )
            return resp
        if code in (401, 403):
            raise AuthError(
                code,
                "unauthorized — token missing, invalid, or expired. Re-import with "
                "`uzum-scraper auth --from-curl-file curl.txt`.",
                url=url,
            )
        if code == 404:
            raise NotFoundError(code, "not found", url=url)
        if code == 429:
            raise RateLimitedError(code, "rate limited (retries exhausted)", url=url)
        raise UzumHTTPError(code, resp.text[:300], url=url)


def _json_or_error(resp: httpx.Response, url: str) -> Any:
    # api.uzum.uz answers 200 with an EMPTY body when a token-gated endpoint is
    # hit with an insufficient token. Treat that as "no data" (None) so callers
    # can raise a precise AuthError rather than a JSON-decode error.
    if not resp.content or not resp.text.strip():
        return None
    try:
        return resp.json()
    except ValueError as exc:
        raise UzumHTTPError(
            resp.status_code,
            f"expected JSON but got {resp.headers.get('content-type', 'unknown')} "
            f"(body starts: {resp.text[:120]!r})",
            url=url,
        ) from exc


def _backoff(attempt: int, *, base: float = 0.8, cap: float = 30.0) -> float:
    """Exponential backoff with full jitter."""
    raw = min(cap, base * (2 ** (attempt - 1)))
    return random.uniform(0.0, raw)


def _retry_after(resp: httpx.Response) -> float | None:
    value = resp.headers.get("Retry-After")
    if not value:
        return None
    try:
        return float(value)
    except ValueError:
        return None
