"""backfill_review_worker recovers succeeded extraction_jobs that never got a
review_queue row (the historical pre-require_approval gap — 184 orphaned
rows found live in production 2026-08).

DB is faked (records in, inserts captured), matching the convention in
test_publish_worker.py / test_guideline_finder_worker.py.
"""

from __future__ import annotations

from uuid import uuid4

from uni_db.workers import backfill_review_worker as brw


class _Conn:
    def __init__(self, orphaned: list[dict]) -> None:
        self._orphaned = orphaned
        self.executed: list[tuple[str, tuple]] = []

    async def fetch(self, sql: str, *args: object) -> list[dict]:
        return self._orphaned

    async def execute(self, sql: str, *args: object) -> str:
        self.executed.append((" ".join(sql.split()), args))
        return "OK"


def _job(field_group: str = "tuition") -> dict:
    return {"extraction_job_id": uuid4(), "field_group": field_group}


async def test_inserts_one_review_row_per_orphaned_job() -> None:
    jobs = [_job("tuition"), _job("scholarships")]
    conn = _Conn(jobs)
    run = await brw.backfill_missing_review(conn, limit=500)
    assert run.found == 2
    assert run.inserted == 2
    inserts = [a for sql, a in conn.executed if "insert into public.review_queue" in sql]
    assert len(inserts) == 2
    assert {a[0] for a in inserts} == {j["extraction_job_id"] for j in jobs}


async def test_backfilled_row_is_open_not_approved() -> None:
    # Queued 'open' (not 'approved') so a human confirms before months-old
    # data publishes straight into the app with nobody having looked at it.
    conn = _Conn([_job()])
    await brw.backfill_missing_review(conn, limit=500)
    sql, _args = conn.executed[0]
    assert "'open'" in sql
    assert "'approved'" not in sql


async def test_nothing_to_backfill_is_a_no_op() -> None:
    conn = _Conn([])
    run = await brw.backfill_missing_review(conn, limit=500)
    assert run == brw.BackfillRun(found=0, inserted=0)
    assert conn.executed == []
