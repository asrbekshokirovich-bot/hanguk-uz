"""retry_failed_worker re-runs failed extraction jobs from stored blobs.

DB and blob storage are faked. Covers: grouping failed jobs per document,
re-parsing ONLY the failed field groups, the content-hash guard (a stored
blob that no longer matches guideline_documents.file_hash_sha256 is skipped,
never re-extracted), and batch error isolation.
"""

from __future__ import annotations

import hashlib
from uuid import UUID, uuid4

from uni_db.workers import retry_failed_worker as rf


class _Conn:
    def __init__(self, records: list[dict]) -> None:
        self._records = records

    async def fetch(self, sql: str, *args: object) -> list[dict]:
        limit = args[0]
        return self._records[: int(limit)]  # type: ignore[arg-type]


def _rec(gd_id: UUID, group: str, data: bytes = b"%PDF-fake",
         hash_override: str | None = None) -> dict:
    return {
        "guideline_document_id": gd_id,
        "field_group": group,
        "storage_path": f"guideline-blobs/{gd_id}.pdf",
        "file_hash_sha256": hash_override
        if hash_override is not None else hashlib.sha256(data).hexdigest(),
    }


async def test_groups_failed_jobs_per_document_and_retries_only_those() -> None:
    gd = uuid4()
    data = b"%PDF-fake"
    conn = _Conn([_rec(gd, "documents_required", data), _rec(gd, "calendar", data)])
    calls: list[tuple[UUID, tuple[str, ...]]] = []

    async def run_parse(c, gd_id, blob, groups):
        assert blob == data
        calls.append((gd_id, groups))

    run = await rf.retry_failed(
        conn, limit=10, fetch_blob=lambda path: data, run_parse_groups=run_parse,
    )
    assert run.jobs_seen == 2 and run.documents == 1 and run.retried == 1
    assert calls == [(gd, ("documents_required", "calendar"))]


async def test_hash_mismatch_is_skipped_without_parsing() -> None:
    gd = uuid4()
    conn = _Conn([_rec(gd, "tuition", hash_override="deadbeef" * 8)])
    parsed: list[UUID] = []

    async def run_parse(c, gd_id, blob, groups):  # pragma: no cover — must not run
        parsed.append(gd_id)

    run = await rf.retry_failed(
        conn, limit=10, fetch_blob=lambda path: b"%PDF-other",
        run_parse_groups=run_parse,
    )
    assert run.hash_mismatch == 1 and run.retried == 0
    assert parsed == []


async def test_missing_recorded_hash_still_retries() -> None:
    # Legacy rows without a recorded hash must not be starved of retries.
    gd = uuid4()
    conn = _Conn([_rec(gd, "tuition", hash_override="")])
    calls: list[UUID] = []

    async def run_parse(c, gd_id, blob, groups):
        calls.append(gd_id)

    run = await rf.retry_failed(
        conn, limit=10, fetch_blob=lambda path: b"%PDF-x", run_parse_groups=run_parse,
    )
    assert run.retried == 1 and calls == [gd]


async def test_one_bad_document_does_not_abort_batch() -> None:
    good, bad = uuid4(), uuid4()
    data = b"%PDF-fake"
    conn = _Conn([_rec(bad, "calendar", data), _rec(good, "tuition", data)])

    async def run_parse(c, gd_id, blob, groups):
        if gd_id == bad:
            raise RuntimeError("boom")

    run = await rf.retry_failed(
        conn, limit=10, fetch_blob=lambda path: data, run_parse_groups=run_parse,
    )
    assert run.retried == 1 and run.errors == 1


async def test_limit_bounds_jobs_picked_up() -> None:
    data = b"%PDF-fake"
    records = [_rec(uuid4(), "tuition", data) for _ in range(5)]
    conn = _Conn(records)

    async def run_parse(c, gd_id, blob, groups):
        pass

    run = await rf.retry_failed(
        conn, limit=2, fetch_blob=lambda path: data, run_parse_groups=run_parse,
    )
    assert run.jobs_seen == 2 and run.documents == 2
