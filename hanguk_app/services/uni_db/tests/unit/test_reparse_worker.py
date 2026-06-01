"""reparse_worker re-extracts stored documents (heavy steps injected)."""

from __future__ import annotations

from uuid import uuid4

from uni_db.workers import reparse_worker


class _FakeConn:
    def __init__(self, rows: list[dict]) -> None:
        self._rows = rows
        self.executed: list[tuple] = []

    async def fetch(self, sql: str, *args: object) -> list[dict]:
        return self._rows

    async def execute(self, sql: str, *args: object) -> None:
        self.executed.append((sql, args))


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


async def test_pending_only_marks_broken_doc_failed() -> None:
    """A pending doc that fails reparse must be flipped to 'failed' so the
    scheduled drain stops re-billing it every run."""
    gd_id = uuid4()
    conn = _FakeConn([{"id": gd_id, "storage_path": "broken.pdf"}])

    async def failing_parse(c, _gd_id, data) -> None:
        raise RuntimeError("archetype crash")

    ok, fail = await reparse_worker.reparse_pending(
        conn, limit=10, pending_only=True,
        fetch_blob=lambda p: b"%PDF", run_parse=failing_parse,
    )
    assert (ok, fail) == (0, 1)
    marks = [a for sql, a in conn.executed
             if "parse_status='failed'" in sql.replace(" ", "").replace("\n", "")
             or "parse_status = 'failed'" in sql]
    assert marks and marks[0][0] == gd_id


async def test_non_pending_failure_is_not_marked_failed() -> None:
    """Default (full) reparse must NOT mark failures, so a fix can retry them."""
    conn = _FakeConn([{"id": uuid4(), "storage_path": "x.pdf"}])

    async def failing_parse(c, gd_id, data) -> None:
        raise RuntimeError("boom")

    ok, fail = await reparse_worker.reparse_pending(
        conn, limit=10, fetch_blob=lambda p: b"%PDF", run_parse=failing_parse,
    )
    assert (ok, fail) == (0, 1)
    assert conn.executed == []
