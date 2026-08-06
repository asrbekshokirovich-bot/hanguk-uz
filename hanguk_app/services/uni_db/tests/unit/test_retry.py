"""uni_db.retry — shared transient-failure retry policy.

Used by both the retry-failed worker (stored-blob re-extraction) and the PDF
download path (direct_ingest_worker._get). Covers: transient errors retried
with backoff, non-retryable errors failing immediately with no sleep, the
retry budget being capped, and a server Retry-After header overriding the
fixed backoff schedule.
"""

from __future__ import annotations

import httpx
import pytest

from uni_db import retry as retry_policy


def test_is_retryable_for_httpx_timeout_and_transport_errors() -> None:
    assert retry_policy.is_retryable(httpx.ReadTimeout("timed out"))
    assert retry_policy.is_retryable(httpx.ConnectError("refused"))
    assert retry_policy.is_retryable(TimeoutError("stdlib timeout"))
    assert retry_policy.is_retryable(ConnectionError("stdlib connection error"))
    assert retry_policy.is_retryable(retry_policy.EmptyResponseError("empty body"))


def test_is_retryable_for_5xx_and_429_status_but_not_4xx() -> None:
    request = httpx.Request("GET", "https://example.ac.kr/x.pdf")
    for code in (408, 429, 500, 502, 503, 504):
        response = httpx.Response(code, request=request)
        exc = httpx.HTTPStatusError("boom", request=request, response=response)
        assert retry_policy.is_retryable(exc), code

    for code in (400, 401, 403, 404):
        response = httpx.Response(code, request=request)
        exc = httpx.HTTPStatusError("boom", request=request, response=response)
        assert not retry_policy.is_retryable(exc), code


def test_is_retryable_false_for_ordinary_errors() -> None:
    assert not retry_policy.is_retryable(ValueError("bad data"))
    assert not retry_policy.is_retryable(RuntimeError("schema failed"))


async def test_with_retry_retries_transient_then_succeeds(monkeypatch) -> None:
    sleeps: list[float] = []

    async def _fake_sleep(sec: float) -> None:
        sleeps.append(sec)

    monkeypatch.setattr(retry_policy.asyncio, "sleep", _fake_sleep)

    attempts = {"n": 0}

    async def _attempt() -> str:
        attempts["n"] += 1
        if attempts["n"] == 1:
            raise httpx.ReadTimeout("timed out")
        return "ok"

    result = await retry_policy.with_retry(_attempt, label="test")
    assert result == "ok"
    assert attempts["n"] == 2
    assert len(sleeps) == 1


async def test_with_retry_non_retryable_fails_immediately_without_sleep(monkeypatch) -> None:
    async def _fake_sleep(sec: float) -> None:
        raise AssertionError("must not sleep for a non-transient failure")

    monkeypatch.setattr(retry_policy.asyncio, "sleep", _fake_sleep)

    async def _attempt() -> None:
        raise RuntimeError("permanent failure")

    with pytest.raises(RuntimeError, match="permanent failure"):
        await retry_policy.with_retry(_attempt, label="test")


async def test_with_retry_budget_is_capped(monkeypatch) -> None:
    sleeps: list[float] = []

    async def _fake_sleep(sec: float) -> None:
        sleeps.append(sec)

    monkeypatch.setattr(retry_policy.asyncio, "sleep", _fake_sleep)

    attempts = {"n": 0}

    async def _attempt() -> None:
        attempts["n"] += 1
        raise httpx.ConnectError("connection refused")

    with pytest.raises(httpx.ConnectError):
        await retry_policy.with_retry(_attempt, label="test")

    assert attempts["n"] == retry_policy.MAX_RETRY_ATTEMPTS + 1
    assert len(sleeps) == retry_policy.MAX_RETRY_ATTEMPTS


async def test_with_retry_after_header_overrides_backoff_schedule(monkeypatch) -> None:
    sleeps: list[float] = []

    async def _fake_sleep(sec: float) -> None:
        sleeps.append(sec)

    monkeypatch.setattr(retry_policy.asyncio, "sleep", _fake_sleep)

    request = httpx.Request("GET", "https://example.ac.kr/x.pdf")
    response = httpx.Response(503, headers={"retry-after": "3"}, request=request)
    attempts = {"n": 0}

    async def _attempt() -> str:
        attempts["n"] += 1
        if attempts["n"] == 1:
            raise httpx.HTTPStatusError("unavailable", request=request, response=response)
        return "ok"

    result = await retry_policy.with_retry(_attempt, label="test")
    assert result == "ok"
    assert sleeps == [3.0]  # Retry-After wins over the 5-10s default window


async def test_with_retry_empty_response_is_retried(monkeypatch) -> None:
    sleeps: list[float] = []

    async def _fake_sleep(sec: float) -> None:
        sleeps.append(sec)

    monkeypatch.setattr(retry_policy.asyncio, "sleep", _fake_sleep)

    attempts = {"n": 0}

    async def _attempt() -> bytes:
        attempts["n"] += 1
        if attempts["n"] == 1:
            raise retry_policy.EmptyResponseError("empty body")
        return b"%PDF-real"

    result = await retry_policy.with_retry(_attempt, label="test")
    assert result == b"%PDF-real"
    assert len(sleeps) == 1
