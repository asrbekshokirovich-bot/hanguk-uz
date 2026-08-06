"""Shared transient-failure retry policy for network I/O (HTTP fetches, blob
downloads, db-exec calls).

A read timeout, a dropped connection, an empty response body, or a 5xx from
an overloaded/rate-limiting endpoint is worth a few retries within THIS run.
Everything else (a 404, a bad PDF, a schema failure) is a real failure and
must fail immediately — retrying it wastes time and, worse, hammers a host
that may already be bot-protecting itself, risking a tighter block or an IP
ban. Retries here are therefore capped and back off with jitter (honoring a
server-supplied Retry-After when present); once the schedule is exhausted the
caller's failure stands for THIS run — a scheduled routine picks it up again
next time rather than being retried forever in one sitting.
"""

from __future__ import annotations

import asyncio
import logging
import random
from collections.abc import Awaitable, Callable

import httpx

log = logging.getLogger(__name__)


class EmptyResponseError(RuntimeError):
    """A 2xx response with an empty body — often a transient CDN/proxy hiccup
    on Korean university hosts, worth retrying like a 5xx rather than being
    taken at face value as "no content"."""


RETRYABLE_ERRORS: tuple[type[BaseException], ...] = (
    TimeoutError,
    ConnectionError,
    EmptyResponseError,
    httpx.TimeoutException,
    httpx.TransportError,
)
RETRYABLE_STATUS_CODES = frozenset({408, 429, 500, 502, 503, 504})

# (min, max) jittered sleep window before each retry attempt, in order.
BACKOFF_WINDOWS_SEC: tuple[tuple[float, float], ...] = (
    (5.0, 10.0),
    (20.0, 30.0),
    (60.0, 60.0),
)
MAX_RETRY_ATTEMPTS = len(BACKOFF_WINDOWS_SEC)


def status_code_of(exc: BaseException) -> int | None:
    """Extract an HTTP status code from either an httpx.HTTPStatusError or a
    storage3.exceptions.StorageApiError (which carries `.status` instead of
    a `.response`)."""
    response = getattr(exc, "response", None)
    status = response.status_code if response is not None else getattr(exc, "status", None)
    try:
        return int(status) if status is not None else None
    except (TypeError, ValueError):
        return None


def retry_after_sec(exc: BaseException) -> float | None:
    """A server-supplied Retry-After (seconds), when present — takes priority
    over the fixed backoff schedule."""
    response = getattr(exc, "response", None)
    headers = getattr(response, "headers", None)
    value = headers.get("retry-after") if headers else None
    if value is None:
        return None
    try:
        return float(value)
    except ValueError:
        return None


def is_retryable(exc: BaseException) -> bool:
    if isinstance(exc, RETRYABLE_ERRORS):
        return True
    return status_code_of(exc) in RETRYABLE_STATUS_CODES


async def with_retry[T](attempt: Callable[[], Awaitable[T]], *, label: str) -> T:
    """Run `attempt()`, retrying transient network/5xx/empty-response failures
    with a capped, jittered backoff (honoring Retry-After when the error
    carries one). Non-retryable errors, and retryable ones that exhaust the
    schedule, propagate on their final try."""
    for retry_num in range(MAX_RETRY_ATTEMPTS + 1):
        try:
            return await attempt()
        except Exception as exc:
            if not is_retryable(exc) or retry_num >= MAX_RETRY_ATTEMPTS:
                raise
            wait = retry_after_sec(exc)
            if wait is None:
                low, high = BACKOFF_WINDOWS_SEC[retry_num]
                wait = random.uniform(low, high)
            log.warning(
                "retry: %s transient %s — retry %d/%d in %.0fs",
                label, type(exc).__name__, retry_num + 1, MAX_RETRY_ATTEMPTS, wait,
            )
            await asyncio.sleep(wait)
    raise AssertionError("unreachable")  # loop always returns or raises above
