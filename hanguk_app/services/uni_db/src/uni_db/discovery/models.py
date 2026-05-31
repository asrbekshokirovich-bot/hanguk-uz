"""Dataclass models shared across discovery adapters."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID


@dataclass(frozen=True, slots=True)
class Attachment:
    filename: str
    url: str
    size_bytes: int | None = None
    mime: str | None = None
    sha256: str | None = None


@dataclass(frozen=True, slots=True)
class Announcement:
    """Surfaced from a SourceAdapter.list_recent_posts() call.

    Mirrors the `announcements` table shape (plan §C.11) but is not yet
    persisted; the discovery worker writes to Postgres after dedup +
    classification.
    """

    external_post_id: str
    title_ko: str
    url_ko: str
    posted_at: datetime | None
    attachments: list[Attachment] = field(default_factory=list)
    raw_payload: dict[str, object] | None = None


@dataclass(frozen=True, slots=True)
class PostDetail:
    announcement: Announcement
    body_html: str | None
    body_text: str | None


@dataclass(frozen=True, slots=True)
class AttachmentBlob:
    attachment: Attachment
    bytes_: bytes
    sha256: str
    http_etag: str | None = None
    http_last_modified: str | None = None


@dataclass(frozen=True, slots=True)
class CrawlRunSummary:
    source_id: UUID
    started_at: datetime
    ended_at: datetime
    status: str  # running|succeeded|failed|partial
    http_status_code: int | None
    error_text: str | None
    records_seen: int
    records_new: int
    records_changed: int
