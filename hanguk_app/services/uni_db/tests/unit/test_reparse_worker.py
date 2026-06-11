"""reparse_worker re-extracts stored documents (heavy steps injected)."""

from __future__ import annotations

from uuid import uuid4

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
