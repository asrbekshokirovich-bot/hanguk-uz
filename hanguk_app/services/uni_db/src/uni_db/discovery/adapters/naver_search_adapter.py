"""Naver Search API adapter — auto-discovery for unknown universities.

Plan §E.4: hourly site:.ac.kr search for the keyword vocabulary, restricted
to last 24h. Each unknown root domain becomes a `discovery_lead`.

Phase 0: code is wired but the live HTTP call site is gated behind
`settings.live_apis`. Tests run against a saved JSON fixture.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID, uuid5

import httpx

from ...config import settings
from .._adapter_base import SourceAdapter
from ..keywords_ko import (
    PRIMARY_KEYWORDS_KO,
    is_disallowed_url,
    matches_admission_signal,
)
from ..models import Announcement

NAVER_SEARCH_NAMESPACE = UUID("c3a4d4dc-9b7a-4f9e-9ad3-1f5b8a2e2a01")
NAVER_BLOG_API = "https://openapi.naver.com/v1/search/webkr.json"


class NaverSearchAdapter(SourceAdapter):
    """Discovery-only adapter; doesn't bind to a single institution."""

    institution_id: UUID | None = None
    source_id: UUID
    source_url_ko: str

    def __init__(
        self,
        *,
        source_id: UUID,
        keyword: str = "외국인전형",
        site: str = ".ac.kr",
        http_client: httpx.AsyncClient | None = None,
        fixture_path: Path | None = None,
    ) -> None:
        self.source_id = source_id
        self.source_url_ko = f"naver-search://{site}/{keyword}"
        self._keyword = keyword
        # `.ac.kr` searches every Korean university at once (broad discovery);
        # a specific domain (e.g. `inha.ac.kr`) restricts the search to one
        # university so its foreign-admission page actually surfaces.
        self._site = site
        self._http = http_client
        self._fixture_path = fixture_path

    async def list_recent_posts(self, since: datetime) -> list[Announcement]:
        payload = await self._search()
        items = payload.get("items", [])
        announcements: list[Announcement] = []
        for item in items:
            link = item.get("link", "")
            title = self._strip_html(item.get("title", ""))
            if is_disallowed_url(link):
                continue
            if not matches_admission_signal(title, []):
                continue
            posted_at = self._parse_naver_date(item.get("postdate") or item.get("pubDate"))
            if posted_at is not None and posted_at < since:
                continue
            external_id = "n" + uuid5(NAVER_SEARCH_NAMESPACE, link).hex[:12]
            announcements.append(
                Announcement(
                    external_post_id=external_id,
                    title_ko=title,
                    url_ko=link,
                    posted_at=posted_at,
                    raw_payload=item,
                )
            )
        return announcements

    async def fetch_post_detail(self, external_post_id: str) -> object:  # type: ignore[override]
        raise NotImplementedError("naver-search adapter is discovery-only")

    async def fetch_attachment(self, attachment_url: str) -> object:  # type: ignore[override]
        raise NotImplementedError("naver-search adapter does not fetch attachments")

    # ------------------------------------------------------------------ helpers

    async def _search(self) -> dict[str, object]:
        if not settings.live_apis:
            if self._fixture_path is None:
                raise RuntimeError(
                    "live_apis=False and no fixture_path supplied; cannot run Naver discovery."
                )
            return json.loads(self._fixture_path.read_text(encoding="utf-8"))
        if self._http is None:  # pragma: no cover
            raise RuntimeError("live_apis=True but no http_client provided")
        if not (settings.naver_search_client_id and settings.naver_search_client_secret):
            raise RuntimeError("NAVER_SEARCH_CLIENT_ID/SECRET missing; cannot call live API")
        resp = await self._http.get(
            NAVER_BLOG_API,
            params={
                "query": f"site:{self._site} {self._keyword}",
                "display": 50,
                "sort": "date",
            },
            headers={
                "X-Naver-Client-Id": settings.naver_search_client_id,
                "X-Naver-Client-Secret": settings.naver_search_client_secret,
                "User-Agent": settings.http_user_agent,
            },
            timeout=settings.http_request_timeout_sec,
        )
        resp.raise_for_status()
        return resp.json()

    @staticmethod
    def _strip_html(text: str) -> str:
        return text.replace("<b>", "").replace("</b>", "").replace("&quot;", '"').strip()

    @staticmethod
    def _parse_naver_date(value: str | None) -> datetime | None:
        if not value:
            return None
        try:
            return datetime.strptime(value[:8], "%Y%m%d").replace(tzinfo=timezone.utc)
        except ValueError:
            return None


# Re-export for the discovery worker so it can iterate over the registered
# keyword vocabulary easily.
DEFAULT_DISCOVERY_KEYWORDS = PRIMARY_KEYWORDS_KO
