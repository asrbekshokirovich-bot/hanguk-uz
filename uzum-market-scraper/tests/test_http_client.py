"""Unit tests for the HTTP transport layer."""

from __future__ import annotations

import httpx

from uzum_scraper.config import Config
from uzum_scraper.http_client import HttpClient


def _cfg(**kw):
    base = dict(iid="iid-1", min_delay=0.0, jitter=0.0, max_retries=1, timeout=5.0)
    base.update(kw)
    return Config(**base)


def test_placeholder_token_when_none():
    client = HttpClient(_cfg(auth_token=""))
    headers = client._base_headers()
    assert headers["Authorization"] == "Bearer anonymous"
    assert client.has_real_token is False
    assert headers["x-iid"] == "iid-1"
    client.close()


def test_real_token_header():
    client = HttpClient(_cfg(auth_token="REALTOKEN"))
    headers = client._base_headers()
    assert headers["Authorization"] == "Bearer REALTOKEN"
    assert client.has_real_token is True
    client.close()


def test_empty_body_returns_none():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=b"")

    client = HttpClient(_cfg(auth_token="t"), transport=httpx.MockTransport(handler))
    assert client.get_json("main/root-categories") is None
    client.close()


def test_apollo_and_language_headers():
    client = HttpClient(_cfg(auth_token="t", language="ru-RU"))
    headers = client._base_headers()
    assert headers["Accept-Language"] == "ru-RU"
    assert headers["apollographql-client-name"] == "web-customer"
    client.close()
