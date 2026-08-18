"""reparse_worker re-extracts stored documents (heavy steps injected)."""

from __future__ import annotations

from uuid import uuid4

from uni_db.watchdog import watchdog
from uni_db.workers import reparse_worker


class _FakeConn:
    def __init__(self, rows: list[dict]) -> None:
        self._rows = rows

    async def fetch(self, sql: str, *args: object) -> list[dict]:
        return self._rows


async def test_reparses_each_document() -> None:
    rows = [{"id": uuid4(), "storage_path": "a.pdf"},
            {"id": uuid4(), "storage_path": "b.pdf"}]
    parsed: list = []

    async def fake_parse(conn, gd_id, data) -> None:
        parsed.append((gd_id, data))

    ok, fail = await reparse_worker.reparse_pending(
        _FakeConn(rows), limit=10,
        fetch_blob=lambda p: b"%PDF-" + p.encode(),
        run_parse=fake_parse,
    )
    assert (ok, fail) == (2, 0)
    assert {gd for gd, _ in parsed} == {r["id"] for r in rows}


async def test_one_bad_document_does_not_abort_batch() -> None:
    rows = [{"id": uuid4(), "storage_path": "good.pdf"},
            {"id": uuid4(), "storage_path": "bad.pdf"}]

    def fetch_blob(path: str) -> bytes:
        if path == "bad.pdf":
            raise RuntimeError("storage download failed")
        return b"%PDF-ok"

    async def fake_parse(conn, gd_id, data) -> None:
        return None

    ok, fail = await reparse_worker.reparse_pending(
        _FakeConn(rows), limit=10, fetch_blob=fetch_blob, run_parse=fake_parse,
    )
    assert (ok, fail) == (1, 1)


async def test_parse_failure_counted() -> None:
    rows = [{"id": uuid4(), "storage_path": "x.pdf"}]

    async def failing_parse(conn, gd_id, data) -> None:
        raise ValueError("no text extracted from PDF")

    ok, fail = await reparse_worker.reparse_pending(
        _FakeConn(rows), limit=10, fetch_blob=lambda p: b"%PDF", run_parse=failing_parse,
    )
    assert (ok, fail) == (0, 1)


class _RecordingConn:
    """Fake conn that also records execute() calls (for the pending-only path)."""

    def __init__(self, rows: list[dict]) -> None:
        self._rows = rows
        self.executed: list[tuple] = []

    async def fetch(self, sql: str, *args: object) -> list[dict]:
        return self._rows

    async def execute(self, sql: str, *args: object) -> str:
        self.executed.append((sql, args))
        return "OK"


async def test_pending_only_marks_failure_failed() -> None:
    # A broken upload must be flipped to 'failed' so it isn't re-billed next run.
    gid = uuid4()
    conn = _RecordingConn([{"id": gid, "storage_path": "bad.pdf"}])

    async def failing_parse(_conn, _gid, _data) -> None:
        raise ValueError("no text extracted")

    ok, fail = await reparse_worker.reparse_pending(
        conn, limit=10, pending_only=True,
        fetch_blob=lambda p: b"%PDF", run_parse=failing_parse,
    )
    assert (ok, fail) == (0, 1)
    assert any("parse_status='failed'" in sql and args == (gid,)
               for sql, args in conn.executed)


async def test_pending_only_success_does_not_touch_status() -> None:
    gid = uuid4()
    conn = _RecordingConn([{"id": gid, "storage_path": "ok.pdf"}])

    async def ok_parse(_conn, _gid, _data) -> None:
        return None

    ok, fail = await reparse_worker.reparse_pending(
        conn, limit=10, pending_only=True,
        fetch_blob=lambda p: b"%PDF", run_parse=ok_parse,
    )
    assert (ok, fail) == (1, 0)
    assert conn.executed == []


async def test_a_rejected_key_stops_the_batch() -> None:
    watchdog.reset()
    rows = [{"id": uuid4(), "storage_path": f"{i}.pdf"} for i in range(8)]
    seen: list = []

    async def fake_parse(conn, gd_id, data) -> None:
        seen.append(gd_id)
        watchdog.record_llm_error("AuthenticationError: Error code: 401")

    try:
        ok, fail = await reparse_worker.reparse_pending(
            _FakeConn(rows), limit=10, fetch_blob=lambda p: b"%PDF",
            run_parse=fake_parse,
        )
    finally:
        watchdog.reset()
    assert len(seen) == 1 and (ok, fail) == (1, 0)


async def test_a_rejected_key_never_marks_an_upload_permanently_failed() -> None:
    """pending_only flips a document that fails to parse_status='failed', and
    nothing retries that state. On a dead credential the document is fine and
    the key is not — marking it would quietly lose a good upload."""
    watchdog.reset()
    rows = [{"id": uuid4(), "storage_path": "a.pdf"},
            {"id": uuid4(), "storage_path": "b.pdf"}]
    conn = _RecordingConn(rows)

    async def failing_parse(c, gd_id, data) -> None:
        raise RuntimeError(
            "AuthenticationError: Error code: 401 - invalid x-api-key"
        )

    try:
        await reparse_worker.reparse_pending(
            conn, limit=10, pending_only=True, fetch_blob=lambda p: b"%PDF",
            run_parse=failing_parse,
        )
    finally:
        watchdog.reset()

    assert conn.executed == [], "marked a good upload failed on a bad key"


class TestOpenCardsMode:
    """Re-do what the reviewer is looking at, not the least-parsed backlog.

    These are genuinely different sets. The default order is
    `parsed_version asc`, so a document whose card is open — often parsed
    several times already — sorts LAST and a bounded backlog run never
    reaches it. Asking for "re-analyse the review section" and getting the
    backlog instead is a silent wrong answer.
    """

    class _SqlConn:
        def __init__(self) -> None:
            self.sql = ""

        async def fetch(self, sql: str, *args: object) -> list[dict]:
            self.sql = sql
            return []

    async def test_filters_on_open_cards(self) -> None:
        conn = self._SqlConn()
        await reparse_worker.fetch_documents(conn, limit=5, open_cards_only=True)
        assert "review_queue" in conn.sql
        assert "rq.status = 'open'" in conn.sql

    async def test_covers_both_card_shapes(self) -> None:
        # A field-group card points at an extraction job; a document-level
        # flag points at the document itself. Missing either would leave part
        # of the queue silently un-refreshed — and 11 of the 35 open cards are
        # document-level flags.
        conn = self._SqlConn()
        await reparse_worker.fetch_documents(conn, limit=5, open_cards_only=True)
        assert "extraction_jobs" in conn.sql
        assert "'guideline_documents'" in conn.sql

    async def test_off_by_default(self) -> None:
        conn = self._SqlConn()
        await reparse_worker.fetch_documents(conn, limit=5)
        assert "review_queue" not in conn.sql

    async def test_composes_with_institution(self) -> None:
        conn = self._SqlConn()
        await reparse_worker.fetch_documents(
            conn, limit=5, open_cards_only=True, institution_id=uuid4(),
        )
        assert "review_queue" in conn.sql and "institution_id" in conn.sql


class TestFailedDocsSelector:
    """`--failed-docs` targets documents stuck at parse_status='failed'.

    Nothing else reaches them. `retry-failed` works from extraction jobs, and
    the 2026-08 dead-key rows that marked many of these documents failed have
    since been archived — so the documents now have no job rows to be found
    through at all. The backlog order does not save them either: it sorts by
    `parsed_version asc`, and a document that failed after hundreds of
    attempts sorts last, which is why the order is flipped for this selector.
    """

    class _SqlConn:
        def __init__(self) -> None:
            self.sql = ""

        async def fetch(self, sql: str, *args: object) -> list[dict]:
            self.sql = sql
            return []

    async def test_filters_on_failed_status(self) -> None:
        conn = self._SqlConn()
        await reparse_worker.fetch_documents(conn, limit=5, failed_only=True)
        assert "parse_status = 'failed'" in conn.sql

    async def test_orders_most_attempted_first(self) -> None:
        conn = self._SqlConn()
        await reparse_worker.fetch_documents(conn, limit=5, failed_only=True)
        assert "order by parsed_version desc" in conn.sql

    async def test_backlog_order_is_unchanged(self) -> None:
        # The default must keep sorting least-parsed first; flipping it for
        # everyone would turn the backlog drain into a re-run of the documents
        # that have already had the most money spent on them.
        conn = self._SqlConn()
        await reparse_worker.fetch_documents(conn, limit=5)
        assert "order by parsed_version asc" in conn.sql
        assert "parse_status = 'failed'" not in conn.sql

    async def test_does_not_collide_with_pending(self) -> None:
        # 'pending' and 'failed' are mutually exclusive statuses: a selector
        # that emitted both predicates would always return nothing.
        conn = self._SqlConn()
        await reparse_worker.fetch_documents(conn, limit=5, pending_only=True)
        assert "parse_status = 'pending'" in conn.sql
        assert "parse_status = 'failed'" not in conn.sql

    async def test_skips_superseded_documents(self) -> None:
        # A superseded document has already been replaced by a newer version.
        # Nothing else in the service reads `superseded_by_id`, so without
        # this predicate the old version re-extracts like a current one and
        # its cards reach the review queue looking current — 8 of the 41
        # failed documents are in that state.
        conn = self._SqlConn()
        await reparse_worker.fetch_documents(conn, limit=5, failed_only=True)
        assert "superseded_by_id is null" in conn.sql

    async def test_other_selectors_unchanged(self) -> None:
        # Whether the backlog and open-cards paths should skip superseded
        # documents is a separate question; this flag must not answer it.
        for kwargs in ({}, {"open_cards_only": True}, {"pending_only": True}):
            conn = self._SqlConn()
            await reparse_worker.fetch_documents(conn, limit=5, **kwargs)
            assert "superseded_by_id" not in conn.sql, kwargs

    async def test_composes_with_institution(self) -> None:
        conn = self._SqlConn()
        await reparse_worker.fetch_documents(
            conn, limit=5, failed_only=True, institution_id=uuid4(),
        )
        assert "parse_status = 'failed'" in conn.sql
        assert "institution_id" in conn.sql
