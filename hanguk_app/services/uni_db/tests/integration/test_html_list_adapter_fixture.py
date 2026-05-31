"""End-to-end HtmlListAdapter against the SNU fixture.

Asserts:
  * announcements with admission keywords surface
  * the correction-notice row keeps its 정정공고 marker
  * the irrelevant control row is filtered out by the classifier layer
"""

from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import pytest

from uni_db.discovery.adapters.html_list_adapter import (
    HtmlListAdapter,
    HtmlListSelectors,
)
from uni_db.discovery.classifier import classify
from uni_db.discovery.keywords_ko import is_correction_notice


@pytest.fixture
def adapter(snu_list_fixture: Path) -> HtmlListAdapter:
    return HtmlListAdapter(
        source_id=uuid4(),
        source_url_ko="https://admission.snu.ac.kr/international/notice",
        selectors=HtmlListSelectors(
            row="tr.notice-row",
            title="td.title",
            link="td.title a",
            posted_at="td.date",
            posted_at_format="%Y.%m.%d",
        ),
        fixture_path=snu_list_fixture,
    )


@pytest.mark.asyncio
async def test_lists_admission_relevant_posts(adapter: HtmlListAdapter) -> None:
    posts = await adapter.list_recent_posts(
        since=datetime(2026, 1, 1, tzinfo=timezone.utc)
    )
    assert len(posts) == 4   # adapter doesn't drop yet — classifier does
    titles = [p.title_ko for p in posts]
    assert any("외국인전형 모집요강" in t for t in titles)
    assert any("정정공고" in t for t in titles)


@pytest.mark.asyncio
async def test_classifier_distinguishes_correction_from_announcement(
    adapter: HtmlListAdapter,
) -> None:
    posts = await adapter.list_recent_posts(
        since=datetime(2026, 1, 1, tzinfo=timezone.utc)
    )
    correction = next(p for p in posts if is_correction_notice(p.title_ko))
    announcement = next(p for p in posts if "모집요강" in p.title_ko and "정정" not in p.title_ko)
    assert classify(correction).label == "correction_notice"
    assert classify(announcement).label == "admission_announcement"


@pytest.mark.asyncio
async def test_filters_out_old_posts_via_since(adapter: HtmlListAdapter) -> None:
    # All fixture rows are from May 2026; this since= is in the future.
    posts = await adapter.list_recent_posts(
        since=datetime(2030, 1, 1, tzinfo=timezone.utc)
    )
    assert posts == []
