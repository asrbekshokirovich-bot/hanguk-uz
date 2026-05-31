"""Naver search adapter — fixture-only Phase 0 path."""

from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import pytest

from uni_db.discovery.adapters.naver_search_adapter import NaverSearchAdapter
from uni_db.discovery.keywords_ko import is_correction_notice


@pytest.mark.asyncio
async def test_naver_search_against_fixture(naver_search_fixture: Path) -> None:
    adapter = NaverSearchAdapter(
        source_id=uuid4(),
        keyword="외국인전형",
        fixture_path=naver_search_fixture,
    )
    posts = await adapter.list_recent_posts(
        since=datetime(2026, 1, 1, tzinfo=timezone.utc)
    )
    # Three items in the fixture; the irrelevant "교내 행사" is dropped.
    assert len(posts) == 2
    assert any("외국인전형" in p.title_ko for p in posts)
    assert any(is_correction_notice(p.title_ko) for p in posts)
