"""Discovery worker — full loop against the SNU fixture WITHOUT a DB.

Asserts the change-detection layer wires correctly with the adapter
output and that crawl_runs/findings would be populated.
"""

from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import pytest

from uni_db.discovery.adapters.html_list_adapter import (
    HtmlListAdapter,
    HtmlListSelectors,
)
from uni_db.discovery.change_detection import PriorAnnouncementSnapshot
from uni_db.discovery.registry import RegistrySource
from uni_db.workers.discovery_worker import run_one_source


@pytest.mark.asyncio
async def test_full_loop_classifies_and_diffs(snu_list_fixture: Path) -> None:
    source = RegistrySource(
        id=uuid4(),
        institution_id=None,
        source_type="university_admission_board",
        url_ko="https://admission.snu.ac.kr/international/notice",
        status="live",
        cron_high_season_minutes=360,
        cron_off_season_minutes=1440,
        consecutive_fails=0,
    )
    adapter = HtmlListAdapter(
        source_id=source.id,
        source_url_ko=source.url_ko,
        selectors=HtmlListSelectors(
            row="tr.notice-row",
            title="td.title",
            link="td.title a",
            posted_at="td.date",
            posted_at_format="%Y.%m.%d",
        ),
        fixture_path=snu_list_fixture,
    )

    # First crawl — no priors, every relevant row is "new_post".
    # Override `since` so all 4 fixture rows fall in-window regardless of
    # when the test happens to run (default is now-1day).
    backstop = datetime(2026, 1, 1, tzinfo=timezone.utc)
    run = await run_one_source(
        source=source, adapter=adapter, prior_snapshots={}, since=backstop,
    )
    assert run.summary.status == "succeeded"
    assert run.summary.records_seen == 4
    assert run.summary.records_new >= 1
    finding_types = {f.finding_type for _, f in run.findings}
    assert "new_post" in finding_types

    # Second crawl — every row has a prior matching itself; expect noop diffs.
    priors = {
        ann.external_post_id: PriorAnnouncementSnapshot(
            title_ko=ann.title_ko,
            attachment_hashes=tuple(),
            seen_at=datetime(2026, 5, 1, tzinfo=timezone.utc),
        )
        for ann, _ in run.findings
    }
    run2 = await run_one_source(
        source=source, adapter=adapter, prior_snapshots=priors, since=backstop,
    )
    assert run2.summary.records_new == 0
