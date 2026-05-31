"""RSS / Atom feed adapter.

Used for the small set of `.ac.kr` boards that emit feeds (audit §6.2).
Far simpler than HTML scraping: feedparser handles Korean text + dates
out of the box.
"""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from pathlib import Path
from time import mktime
from uuid import UUID

import feedparser
import httpx

from ...config import settings
from .._adapter_base import SourceAdapter
from ..keywords_ko import is_disallowed_url, matches_admission_signal
from ..models import Announcement, Attachment, AttachmentBlob, PostDetail


class RssAdapter(SourceAdapter):
    institution_id: UUID | None
    source_id: UUID
    source_url_ko: str

    def __init__(
        self,
        *,
        source_id: UUID,
        source_url_ko: str,
        institution_id: UUID | None = None,
        http_client: httpx.AsyncClient | None = None,
        fixture_path: Path | None = None,
    ) -> None:
        if is_disallowed_url(source_url_ko):
            raise ValueError(f"refusing disallowed URL: {source_url_ko}")
        self.source_id = source_id
        self.source_url_ko = source_url_ko
        self.institution_id = institution_id
        self._http = http_client
        self._fixture_path = fixture_path

    async def list_recent_posts(self, since: datetime) -> list[Announcement]:
        feed_text = await self._load_feed()
        parsed = feedparser.parse(feed_text)
        announcements: list[Announcement] = []
        for entry in parsed.entries:
            title = (entry.get("title") or "").strip()
            link = (entry.get("link") or "").strip()
            if not title or not link:
                continue

            posted_struct = entry.get("published_parsed") or entry.get("updated_parsed")
            posted_at = (
                datetime.fromtimestamp(mktime(posted_struct), tz=timezone.utc)
                if posted_struct
                else None
            )
            if posted_at is not None and posted_at < since:
                continue

            attachments: list[Attachment] = []
            for enc in entry.get("enclosures", []) or []:
                attachments.append(
                    Attachment(
                        filename=enc.get("href", "").rsplit("/", 1)[-1],
                        url=enc.get("href", ""),
                        size_bytes=int(enc.get("length")) if enc.get("length") else None,
                        mime=enc.get("type"),
                    )
                )

            if not matches_admission_signal(title, [a.filename for a in attachments]):
                continue

            external_id = entry.get("id") or "h" + hashlib.sha256(link.encode()).hexdigest()[:12]
            announcements.append(
                Announcement(
                    external_post_id=external_id,
                    title_ko=title,
                    url_ko=link,
                    posted_at=posted_at,
                    attachments=attachments,
                )
            )
        return announcements

    async def fetch_post_detail(self, external_post_id: str) -> PostDetail:
        # RSS already carries summary; detail not needed for v1.
        return PostDetail(
            announcement=Announcement(
                external_post_id=external_post_id,
                title_ko="<rss-summary>",
                url_ko=self.source_url_ko,
                posted_at=None,
            ),
            body_html=None,
            body_text=None,
        )

    async def fetch_attachment(self, attachment_url: str) -> AttachmentBlob:
        if not settings.live_crawl:
            fixture_name = attachment_url.rsplit("/", 1)[-1]
            fixture_root = self._fixture_path or Path("tests/fixtures")
            blob_path = fixture_root / fixture_name
            data = blob_path.read_bytes() if blob_path.exists() else b""
            return AttachmentBlob(
                attachment=Attachment(filename=fixture_name, url=attachment_url, size_bytes=len(data)),
                bytes_=data,
                sha256=hashlib.sha256(data).hexdigest(),
            )
        if self._http is None:  # pragma: no cover
            raise RuntimeError("live_crawl=True but no http_client provided")
        resp = await self._http.get(attachment_url, timeout=settings.http_request_timeout_sec)
        resp.raise_for_status()
        data = resp.content
        return AttachmentBlob(
            attachment=Attachment(
                filename=attachment_url.rsplit("/", 1)[-1],
                url=attachment_url,
                size_bytes=len(data),
                mime=resp.headers.get("content-type"),
            ),
            bytes_=data,
            sha256=hashlib.sha256(data).hexdigest(),
            http_etag=resp.headers.get("etag"),
            http_last_modified=resp.headers.get("last-modified"),
        )

    async def _load_feed(self) -> str:
        if not settings.live_crawl:
            if self._fixture_path is None:
                raise RuntimeError("live_crawl=False and no fixture_path supplied")
            return self._fixture_path.read_text(encoding="utf-8")
        if self._http is None:  # pragma: no cover
            raise RuntimeError("live_crawl=True but no http_client provided")
        resp = await self._http.get(
            self.source_url_ko,
            headers={"User-Agent": settings.http_user_agent},
            timeout=settings.http_request_timeout_sec,
        )
        resp.raise_for_status()
        return resp.text
