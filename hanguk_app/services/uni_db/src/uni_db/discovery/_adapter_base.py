"""SourceAdapter — protocol every per-source crawler implements.

Plan §E.2. Concrete adapters live in `discovery/adapters/`.
"""

from __future__ import annotations

from datetime import datetime
from typing import Protocol, runtime_checkable
from uuid import UUID

from .models import Announcement, AttachmentBlob, PostDetail


@runtime_checkable
class SourceAdapter(Protocol):
    """Per-source crawl protocol.

    Implementations must:
      * be safe to instantiate without network access (so tests can stand
        them up against fixtures);
      * accept an `http_client` injected via constructor so tests can swap
        in respx mocks;
      * never invoke paid APIs without checking `settings.live_crawl`.
    """

    institution_id: UUID | None
    source_id: UUID
    source_url_ko: str

    async def list_recent_posts(self, since: datetime) -> list[Announcement]:
        """Return announcements posted after `since`.

        Adapters MUST filter to admission-signal posts using the
        `keywords_ko.matches_admission_signal()` helper before returning,
        so the worker doesn't re-classify everything.
        """
        ...

    async def fetch_post_detail(self, external_post_id: str) -> PostDetail:
        """Fetch the full post body for an announcement we already saw."""
        ...

    async def fetch_attachment(self, attachment_url: str) -> AttachmentBlob:
        """Download a single attachment, returning bytes + hash + caching headers."""
        ...
