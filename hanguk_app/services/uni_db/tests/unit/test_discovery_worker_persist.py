"""write_run_to_db must persist the real classifier verdict, not 'unknown'.

Regression guard for the bug where every announcement was written with
classifier_label='unknown', leaving the fetch stage no signal for which
posts are admission guidelines.
"""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

import pytest

from uni_db.discovery.change_detection import detect_change
from uni_db.discovery.models import Announcement, Attachment, CrawlRunSummary
from uni_db.discovery.registry import RegistrySource
from uni_db.workers.discovery_worker import DiscoveryRun, write_run_to_db


class _FakeConn:
    """Records execute/fetchval calls; returns a uuid for fetchval."""

    def __init__(self) -> None:
        self.calls: list[tuple[str, tuple]] = []

    async def execute(self, sql: str, *args: object) -> str:
        self.calls.append((sql, args))
        return "OK"

    async def fetchval(self, sql: str, *args: object) -> UUID:
        self.calls.append((sql, args))
        return uuid4()


def _run_with(ann: Announcement) -> DiscoveryRun:
    source = RegistrySource(
        id=uuid4(),
        institution_id=uuid4(),
        source_type="university_admission_board",
        url_ko="https://admission.example.ac.kr/notice",
        status="live",
        cron_high_season_minutes=360,
        cron_off_season_minutes=1440,
        consecutive_fails=0,
    )
    now = datetime.now(tz=timezone.utc)
    summary = CrawlRunSummary(
        source_id=source.id, started_at=now, ended_at=now, status="succeeded",
        http_status_code=200, error_text=None,
        records_seen=1, records_new=1, records_changed=0,
    )
    finding = detect_change(ann, None)  # no prior -> new_post
    return DiscoveryRun(source=source, summary=summary, findings=[(ann, finding)])


def _announcement_insert_args(conn: _FakeConn) -> tuple:
    for sql, args in conn.calls:
        if "insert into public.announcements" in sql:
            return args
    raise AssertionError("no announcements insert recorded")


@pytest.mark.asyncio
async def test_persists_admission_label_not_unknown() -> None:
    ann = Announcement(
        external_post_id="p1",
        title_ko="2027학년도 외국인 신입학 안내",
        url_ko="https://admission.example.ac.kr/notice/1",
        posted_at=datetime(2026, 5, 1, tzinfo=timezone.utc),
        # A "모집요강" attachment makes classify() return admission_announcement.
        attachments=[Attachment(filename="2027_모집요강.pdf", url="https://x/g.pdf")],
    )
    conn = _FakeConn()
    await write_run_to_db(conn, _run_with(ann))

    args = _announcement_insert_args(conn)
    # positional args end with (..., classifier_label, classifier_confidence)
    assert args[-2] == "admission_announcement"
    assert args[-1] == pytest.approx(0.88)


@pytest.mark.asyncio
async def test_unknown_when_no_rule_fires() -> None:
    ann = Announcement(
        external_post_id="p2",
        title_ko="학생식당 5월 메뉴 안내",  # not admission-related, no attachment
        url_ko="https://admission.example.ac.kr/notice/2",
        posted_at=datetime(2026, 5, 1, tzinfo=timezone.utc),
        attachments=[],
    )
    conn = _FakeConn()
    await write_run_to_db(conn, _run_with(ann))
    args = _announcement_insert_args(conn)
    assert args[-2] == "unknown"
    assert args[-1] == pytest.approx(0.0)
