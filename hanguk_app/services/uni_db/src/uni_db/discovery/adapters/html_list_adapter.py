"""HTML list-page adapter.

Generic implementation for the ~85% of `.ac.kr` boards that paginate
HTML rows with announcement links (audit §6.2). Subclassed per university
to inject CSS selectors for row, title, link, posted_at, attachments.

Phase 0 contract:
  * Live network calls are gated behind `settings.live_crawl`. When
    disabled, the adapter loads HTML from `tests/fixtures/<fixture_name>.html`
    so the discovery loop runs end-to-end without touching ac.kr.
  * `fetch_attachment()` is also gated; against fixtures it returns the
    bytes of `tests/fixtures/<attachment_name>` and a deterministic hash.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

import httpx
from bs4 import BeautifulSoup

from ...config import settings
from .._adapter_base import SourceAdapter
from ..keywords_ko import is_disallowed_url, matches_admission_signal
from ..models import Announcement, Attachment, AttachmentBlob, PostDetail


@dataclass(frozen=True, slots=True)
class HtmlListSelectors:
    """CSS selectors / regex anchors used to scrape one specific list page.

    Per-university overrides supply this dataclass; the adapter logic itself
    is shared across universities.
    """

    row: str                # selector matching one announcement row
    title: str              # selector inside the row that contains the title
    link: str               # selector inside the row that has the post URL (an `a` tag)
    posted_at: str | None   # optional selector for the posted-at cell
    posted_at_format: str = "%Y.%m.%d"
    # If set, applied to the posted-at cell text before strptime — group(1)
    # must capture the date substring. Use when the cell carries trailing
    # text like view counts or a Korean prefix (e.g. "작성일: 2026/03/04 ㅣ 조회수: 18969").
    posted_at_regex: str | None = None
    attachments_in_detail: bool = True   # if True, fetch_post_detail() finds attachments

    # Each row's `external_post_id` is extracted from the post URL via this
    # regex group. Most egov boards expose `?nttId=12345` or similar.
    external_id_regex: str = r"(?:nttId|articleNo|seq|bbsSeq|BBS_NO)=([0-9]+)"


class HtmlListAdapter(SourceAdapter):
    institution_id: UUID | None
    source_id: UUID
    source_url_ko: str

    def __init__(
        self,
        *,
        source_id: UUID,
        source_url_ko: str,
        selectors: HtmlListSelectors,
        institution_id: UUID | None = None,
        http_client: httpx.AsyncClient | None = None,
        fixture_path: Path | None = None,
    ) -> None:
        if is_disallowed_url(source_url_ko):
            raise ValueError(f"refusing disallowed URL (English mirror or non-ac.kr): {source_url_ko}")
        self.source_id = source_id
        self.source_url_ko = source_url_ko
        self.institution_id = institution_id
        self._selectors = selectors
        self._http = http_client
        self._fixture_path = fixture_path

    async def list_recent_posts(self, since: datetime) -> list[Announcement]:
        html = await self._load_list_html()
        soup = BeautifulSoup(html, "lxml")
        rows = soup.select(self._selectors.row)

        announcements: list[Announcement] = []
        for row in rows:
            title_el = row.select_one(self._selectors.title)
            link_el = row.select_one(self._selectors.link)
            if title_el is None or link_el is None:
                continue
            title_ko = title_el.get_text(strip=True)
            href = link_el.get("href") or ""
            url_ko = self._absolutize(href)

            posted_at = self._extract_posted_at(row)
            if posted_at is not None and posted_at < since:
                continue

            # Boards like Hanyang put the onclick on the row <li>, not on
            # an inner <a>. Concatenate both haystacks so the regex finds
            # a hit regardless of which element carries the JS handler.
            row_onclick = row.get("onclick", "") if hasattr(row, "get") else ""
            link_onclick = link_el.get("onclick", "") if link_el else ""
            external_post_id = self._extract_external_id(
                url_ko, f"{link_onclick} {row_onclick}".strip()
            )
            if external_post_id is None:
                # Boards without stable IDs hash the URL — not ideal but stable.
                external_post_id = "h" + hashlib.sha256(url_ko.encode()).hexdigest()[:12]

            attachment_filenames: list[str] = []
            attachments: list[Attachment] = []
            # When attachments are encoded in the list row (rare), the
            # selectors dataclass would say so; until then we leave them
            # empty and let fetch_post_detail() fill them in.

            if not matches_admission_signal(title_ko, attachment_filenames):
                # Title alone may be enough on boards where attachments
                # aren't in the row; we re-check after fetch_post_detail().
                # For Phase 0 we keep the row only if the title clearly hits.
                pass

            announcements.append(
                Announcement(
                    external_post_id=external_post_id,
                    title_ko=title_ko,
                    url_ko=url_ko,
                    posted_at=posted_at,
                    attachments=attachments,
                )
            )

        return announcements

    async def fetch_post_detail(self, external_post_id: str) -> PostDetail:
        if not settings.live_crawl:
            # In fixture mode we don't follow detail links; the fixture is
            # just the list page.
            return PostDetail(
                announcement=Announcement(
                    external_post_id=external_post_id,
                    title_ko="<fixture>",
                    url_ko=self.source_url_ko,
                    posted_at=None,
                ),
                body_html=None,
                body_text=None,
            )
        if self._http is None:  # pragma: no cover — not exercised in Phase 0
            raise RuntimeError("live_crawl=True but no http_client provided")
        # Real implementation: derive the detail URL from the list page's
        # selectors. Per-university subclasses provide that mapping. The
        # base class returns a stub so the loop can run end-to-end.
        return PostDetail(
            announcement=Announcement(
                external_post_id=external_post_id,
                title_ko="<live not implemented in base>",
                url_ko=self.source_url_ko,
                posted_at=None,
            ),
            body_html=None,
            body_text=None,
        )

    async def fetch_attachment(self, attachment_url: str) -> AttachmentBlob:
        if not settings.live_crawl:
            # Fixture mode: read tests/fixtures/<basename>
            fixture_name = attachment_url.rsplit("/", 1)[-1]
            fixture_root = self._fixture_path or Path("tests/fixtures")
            blob_path = fixture_root / fixture_name
            if not blob_path.exists():
                raise FileNotFoundError(
                    f"fixture attachment missing: {blob_path}. "
                    "Add the fixture or enable UNI_DB_LIVE_CRAWL."
                )
            data = blob_path.read_bytes()
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

    # ------------------------------------------------------------------ helpers

    async def _load_list_html(self) -> str:
        if not settings.live_crawl:
            if self._fixture_path is None:
                raise RuntimeError(
                    "live_crawl=False and no fixture_path supplied; cannot run discovery."
                )
            return self._fixture_path.read_text(encoding="utf-8")
        if self._http is None:  # pragma: no cover — Phase 0 keeps live calls out
            raise RuntimeError("live_crawl=True but no http_client provided")
        resp = await self._http.get(
            self.source_url_ko,
            headers={"User-Agent": settings.http_user_agent},
            timeout=settings.http_request_timeout_sec,
        )
        resp.raise_for_status()
        return resp.text

    def _absolutize(self, href: str) -> str:
        if href.startswith(("http://", "https://")):
            return href
        from urllib.parse import urljoin
        return urljoin(self.source_url_ko, href)

    def _extract_posted_at(self, row: object) -> datetime | None:
        sel = self._selectors.posted_at
        if sel is None:
            return None
        cell = row.select_one(sel) if hasattr(row, "select_one") else None  # type: ignore[union-attr]
        if cell is None:
            return None
        text = cell.get_text(strip=True)  # type: ignore[union-attr]

        # Optional regex pre-extraction for cells with surrounding chrome
        # like Korean prefix + view count.
        if self._selectors.posted_at_regex:
            m = re.search(self._selectors.posted_at_regex, text)
            if not m:
                return None
            text = m.group(1)

        try:
            return datetime.strptime(text, self._selectors.posted_at_format).replace(
                tzinfo=timezone.utc
            )
        except ValueError:
            return None

    def _extract_external_id(self, url: str, onclick: str) -> str | None:
        for haystack in (url, onclick):
            m = re.search(self._selectors.external_id_regex, haystack)
            if m:
                return m.group(1)
        return None
