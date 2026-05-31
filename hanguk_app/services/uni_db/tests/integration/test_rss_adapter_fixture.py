"""RSS adapter against the synthetic fixture feed."""

from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import pytest

from uni_db.discovery.adapters.rss_adapter import RssAdapter
from uni_db.discovery.keywords_ko import is_correction_notice


@pytest.fixture
def adapter(rss_fixture: Path) -> RssAdapter:
    return RssAdapter(
        source_id=uuid4(),
        source_url_ko="https://example.ac.kr/admission/rss",
        fixture_path=rss_fixture,
    )


@pytest.mark.asyncio
async def test_admission_relevant_entries_pass_through(adapter: RssAdapter) -> None:
    posts = await adapter.list_recent_posts(
        since=datetime(2026, 1, 1, tzinfo=timezone.utc)
    )
    titles = [p.title_ko for p in posts]
    # Library entry is dropped by matches_admission_signal at the adapter
    # boundary; only the two admission-relevant items remain.
    assert any("외국인전형" in t for t in titles)
    assert any(is_correction_notice(t) for t in titles)
    assert all("도서관 운영 시간" not in t for t in titles)


@pytest.mark.asyncio
async def test_attachment_links_carried(adapter: RssAdapter) -> None:
    posts = await adapter.list_recent_posts(
        since=datetime(2026, 1, 1, tzinfo=timezone.utc)
    )
    for p in posts:
        assert any(a.url.endswith(".pdf") for a in p.attachments)
