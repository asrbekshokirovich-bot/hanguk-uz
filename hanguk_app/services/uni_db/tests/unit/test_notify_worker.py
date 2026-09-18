"""The notifier's two jobs: say it once, and say it clearly.

No database and no network here — notify_worker takes both as parameters
precisely so the dedupe contract and the message text can be pinned down in
plain unit tests.
"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest

from uni_db.workers import notify_worker
from uni_db.workers.notify_worker import NewGuideline


class FakeConn:
    """Records the SQL it is handed and replays canned rows."""

    def __init__(self, rows: list[dict] | None = None) -> None:
        self.rows = rows or []
        self.fetches: list[tuple] = []
        self.executes: list[tuple] = []

    async def fetch(self, sql: str, *args):
        self.fetches.append((sql, args))
        return self.rows

    async def execute(self, sql: str, *args):
        self.executes.append((sql, args))
        return "INSERT 0 1"


def _row(**over) -> dict:
    base = {
        "document_id": "11111111-1111-1111-1111-111111111111",
        "institution_name": "Yonsei University",
        "institution_name_ko": "연세대학교",
        "source_url": "https://admission.yonsei.ac.kr/2027.pdf",
        "academic_year": 2027,
        "semester": "spring",
        "fetched_at": datetime(2026, 9, 18, 3, 0, tzinfo=timezone.utc),
    }
    base.update(over)
    return base


def _item(**over) -> NewGuideline:
    r = _row(**over)
    return NewGuideline(
        document_id=r["document_id"],
        institution_name=r["institution_name"],
        institution_name_ko=r["institution_name_ko"],
        source_url=r["source_url"],
        academic_year=r["academic_year"],
        semester=r["semester"],
        fetched_at=r["fetched_at"],
    )


# --- selection -------------------------------------------------------------


async def test_selection_is_bounded_by_the_age_window():
    """The 263 documents that predate the ledger must never be announceable.
    The age window is the guard, so it has to reach the query."""
    conn = FakeConn([])
    await notify_worker.fetch_unannounced(conn, limit=50, max_age_hours=48)

    sql, args = conn.fetches[0]
    assert args == (48, 50)
    assert "guideline_notifications" in sql
    assert "make_interval" in sql


async def test_superseded_documents_are_not_announced():
    """A replaced guideline is not news — the query filters it out rather than
    the caller, so every entry point inherits the rule."""
    conn = FakeConn([])
    await notify_worker.fetch_unannounced(conn)
    sql, _ = conn.fetches[0]
    assert "superseded_by_id IS NULL" in sql


# --- send-then-mark ordering ----------------------------------------------


async def test_marks_only_after_a_successful_send():
    conn = FakeConn([_row()])
    sent: list[str] = []

    async def send(text: str) -> None:
        sent.append(text)

    run = await notify_worker.notify_new_guidelines(conn, send)

    assert run.found == 1 and run.sent == 1 and run.marked == 1
    assert len(sent) == 1
    assert conn.executes, "a successful send must write the ledger"


async def test_a_failed_send_leaves_the_ledger_untouched():
    """Otherwise the find is marked announced and the operator never hears it —
    the one failure mode worth designing around."""
    conn = FakeConn([_row()])

    async def send(_text: str) -> None:
        raise RuntimeError("telegram down")

    with pytest.raises(RuntimeError):
        await notify_worker.notify_new_guidelines(conn, send)

    assert conn.executes == [], "nothing may be marked when delivery failed"


async def test_no_channel_reports_but_never_marks():
    """Turning Telegram on later must still announce these documents."""
    conn = FakeConn([_row()])
    run = await notify_worker.notify_new_guidelines(conn, None)

    assert run.found == 1 and run.sent == 0 and run.marked == 0
    assert run.skipped_no_channel is True
    assert conn.executes == []


async def test_dry_run_sends_nothing_and_marks_nothing():
    conn = FakeConn([_row()])

    async def send(_text: str) -> None:
        raise AssertionError("dry run must not send")

    run = await notify_worker.notify_new_guidelines(conn, send, dry_run=True)
    assert run.sent == 0 and run.marked == 0
    assert conn.executes == []


async def test_nothing_new_is_a_silent_no_op():
    """An hourly job that pings "no news" every hour gets muted by its reader."""
    conn = FakeConn([])

    async def send(_text: str) -> None:
        raise AssertionError("must not send when there is nothing new")

    run = await notify_worker.notify_new_guidelines(conn, send)
    assert run == notify_worker.NotifyRun(found=0, sent=0, marked=0)


async def test_mark_seen_ignores_the_age_window():
    """Seeding has to cover the whole backlog or the first real run still
    announces week-old documents."""
    conn = FakeConn([_row()])
    seeded = await notify_worker.mark_seen(conn)

    assert seeded == 1
    sql, args = conn.fetches[0]
    assert "make_interval" not in sql
    assert args == (10_000,)
    assert conn.executes[0][1][1] == "seed"


async def test_marking_nothing_touches_no_sql():
    conn = FakeConn()
    assert await notify_worker.mark_announced(conn, []) == 0
    assert conn.executes == []


# --- message ---------------------------------------------------------------


def test_message_leads_with_the_korean_name_and_the_source_link():
    text = notify_worker.format_message([_item()])

    assert "연세대학교" in text
    assert "Yonsei University" in text
    assert "https://admission.yonsei.ac.kr/2027.pdf" in text
    assert "2027 bahor" in text


def test_message_translates_the_term_codes_operators_do_not_read():
    assert "2027 kuz" in notify_worker.format_message([_item(semester="fall")])
    assert "2027 bahor" in notify_worker.format_message([_item(semester="전기")])
    # An unknown code degrades to the bare year rather than printing garbage.
    assert "📅 2027 qabuli" in notify_worker.format_message([_item(semester="???")])


def test_message_survives_a_missing_cycle_or_url():
    text = notify_worker.format_message(
        [_item(academic_year=None, semester=None, source_url=None)]
    )
    assert "연세대학교" in text
    assert "📅" not in text and "🔗" not in text


def test_message_escapes_html_so_a_source_title_cannot_break_it():
    """Institution names come from crawled pages; parse_mode=HTML makes an
    unescaped '<' a delivery failure for the whole batch."""
    text = notify_worker.format_message(
        [_item(institution_name_ko="A & B <uni>", institution_name="A & B <uni>")]
    )
    assert "&amp;" in text and "&lt;uni&gt;" in text
    assert "<uni>" not in text


def test_long_batches_are_truncated_with_a_count():
    items = [_item(document_id=f"id-{n}") for n in range(20)]
    text = notify_worker.format_message(items)

    assert "20 ta" in text
    assert "…va yana 5 ta" in text
    assert len(text) < 4096, "Telegram rejects anything longer"


def test_empty_batch_produces_no_message():
    assert notify_worker.format_message([]) == ""
