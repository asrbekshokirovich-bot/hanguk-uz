"""retry_failed_worker re-runs failed extraction jobs from stored blobs.

DB and blob storage are faked. Covers: grouping failed jobs per document,
re-parsing ONLY the failed field groups, the content-hash guard (a stored
blob that no longer matches guideline_documents.file_hash_sha256 is skipped,
never re-extracted), and batch error isolation. The transient-failure retry
POLICY itself (backoff schedule, Retry-After, retryable-vs-not) is covered in
test_retry.py — here we only check the worker wires a transient blob-fetch
failure through to a retry, and that a hash mismatch is never retried.
"""

from __future__ import annotations

import hashlib
from uuid import UUID, uuid4

import httpx

from uni_db import retry as retry_policy
from uni_db.watchdog import watchdog
from uni_db.workers import retry_failed_worker as rf


class _Conn:
    """Fake connection that mirrors _FETCH_FAILED_SQL's two bound parameters.

    The skip filter really lives in SQL (`not (field_group = any($2))`); this
    reproduces it so the worker's behaviour around it is testable without a
    database, and records the args so a test can catch the worker forgetting to
    bind them at all.
    """

    def __init__(self, records: list[dict]) -> None:
        self._records = records
        self.last_args: tuple[object, ...] = ()

    async def fetch(self, sql: str, *args: object) -> list[dict]:
        self.last_args = args
        limit = args[0]
        skip = set(args[1]) if len(args) > 1 else set()  # type: ignore[arg-type]
        rows = [r for r in self._records if r["field_group"] not in skip]
        return rows[: int(limit)]  # type: ignore[arg-type]


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


async def test_transient_blob_fetch_error_is_retried_then_succeeds(monkeypatch) -> None:
    sleeps: list[float] = []

    async def _fake_sleep(sec: float) -> None:
        sleeps.append(sec)

    monkeypatch.setattr(retry_policy.asyncio, "sleep", _fake_sleep)

    gd = uuid4()
    data = b"%PDF-fake"
    conn = _Conn([_rec(gd, "calendar", data)])
    attempts = {"n": 0}

    def fetch_blob(path: str) -> bytes:
        attempts["n"] += 1
        if attempts["n"] == 1:
            raise httpx.ReadTimeout("timed out")
        return data

    async def run_parse(c, gd_id, blob, groups):
        pass

    run = await rf.retry_failed(
        conn, limit=10, fetch_blob=fetch_blob, run_parse_groups=run_parse,
    )
    assert run.retried == 1 and run.errors == 0
    assert attempts["n"] == 2
    assert len(sleeps) == 1


async def test_non_retryable_error_fails_immediately_without_sleep(monkeypatch) -> None:
    async def _fake_sleep(sec: float) -> None:
        raise AssertionError("must not sleep/retry a non-transient failure")

    monkeypatch.setattr(retry_policy.asyncio, "sleep", _fake_sleep)

    gd = uuid4()
    data = b"%PDF-fake"
    conn = _Conn([_rec(gd, "calendar", data)])

    async def run_parse(c, gd_id, blob, groups):
        raise RuntimeError("schema validation failed")

    run = await rf.retry_failed(
        conn, limit=10, fetch_blob=lambda path: data, run_parse_groups=run_parse,
    )
    assert run.errors == 1 and run.retried == 0


async def test_hash_mismatch_is_not_retried(monkeypatch) -> None:
    async def _fake_sleep(sec: float) -> None:
        raise AssertionError("a hash mismatch is not a transient failure")

    monkeypatch.setattr(retry_policy.asyncio, "sleep", _fake_sleep)

    gd = uuid4()
    conn = _Conn([_rec(gd, "tuition", hash_override="deadbeef" * 8)])
    attempts = {"n": 0}

    def fetch_blob(path: str) -> bytes:
        attempts["n"] += 1
        return b"%PDF-other"

    async def run_parse(c, gd_id, blob, groups):  # pragma: no cover — must not run
        pass

    run = await rf.retry_failed(
        conn, limit=10, fetch_blob=fetch_blob, run_parse_groups=run_parse,
    )
    assert run.hash_mismatch == 1
    assert attempts["n"] == 1


async def test_skipped_group_is_never_fetched_or_extracted() -> None:
    # One serialized ~4-minute model call per group: a group no screen renders
    # is wall-clock spent on nothing. Skipping must drop it from the candidate
    # set entirely, not extract it and discard the result.
    gd = uuid4()
    data = b"%PDF-fake"
    conn = _Conn([_rec(gd, "scholarships", data), _rec(gd, "calendar", data)])
    calls: list[tuple[UUID, tuple[str, ...]]] = []

    async def run_parse(c, gd_id, blob, groups):
        calls.append((gd_id, groups))

    run = await rf.retry_failed(
        conn, limit=10, skip_groups=("scholarships",),
        fetch_blob=lambda path: data, run_parse_groups=run_parse,
    )

    assert run.jobs_seen == 1
    assert calls == [(gd, ("calendar",))]


async def test_document_whose_only_failure_is_skipped_is_not_opened() -> None:
    # Its PDF must not even be downloaded — that is the saving.
    gd = uuid4()
    fetched: list[str] = []

    def fetch_blob(path: str) -> bytes:
        fetched.append(path)
        return b"%PDF-fake"

    async def run_parse(c, gd_id, blob, groups):
        raise AssertionError("nothing should be extracted")

    run = await rf.retry_failed(
        _Conn([_rec(gd, "scholarships")]), limit=10,
        skip_groups=("scholarships",),
        fetch_blob=fetch_blob, run_parse_groups=run_parse,
    )

    assert run.jobs_seen == 0 and run.documents == 0 and run.retried == 0
    assert fetched == []


async def test_no_skip_list_leaves_the_backlog_untouched() -> None:
    gd = uuid4()
    conn = _Conn([_rec(gd, "scholarships"), _rec(gd, "calendar")])

    async def run_parse(c, gd_id, blob, groups):
        pass

    run = await rf.retry_failed(
        conn, limit=10, fetch_blob=lambda p: b"%PDF-fake",
        run_parse_groups=run_parse,
    )

    assert run.jobs_seen == 2
    # Bound as an empty array rather than omitted, so the one statement serves
    # both cases.
    assert conn.last_args[1] == []


async def test_skip_groups_reach_the_query() -> None:
    # Guards the wiring: a worker that accepted the argument and dropped it
    # would still pass the behaviour tests above if the fake defaulted to no
    # filtering.
    conn = _Conn([])

    async def run_parse(c, gd_id, blob, groups):
        pass

    await rf.retry_failed(
        conn, limit=5, skip_groups=("scholarships", "document_checklist"),
        fetch_blob=lambda p: b"", run_parse_groups=run_parse,
    )

    assert conn.last_args[0] == 5
    assert conn.last_args[1] == ["scholarships", "document_checklist"]


async def test_a_rejected_key_stops_the_batch_instead_of_burning_it() -> None:
    """The 2026-08-12 regression, in one test.

    An invalid API key fails every document identically, and each failure is
    written back as a job the NEXT run picks up — so a worker that keeps going
    grows the backlog it exists to drain. Here the first document trips the
    watchdog; the remaining nine must never be opened.
    """
    watchdog.reset()
    docs = [uuid4() for _ in range(10)]
    conn = _Conn([_rec(gd, "calendar") for gd in docs])
    seen: list[UUID] = []

    async def run_parse(c, gd_id, blob, groups):
        seen.append(gd_id)
        # What parse_worker does on an LLM exception, minus the database.
        watchdog.record_llm_error(
            "AuthenticationError: Error code: 401 - invalid x-api-key"
        )

    try:
        run = await rf.retry_failed(
            conn, limit=50, fetch_blob=lambda p: b"%PDF-fake",
            run_parse_groups=run_parse,
        )
    finally:
        watchdog.reset()

    assert len(seen) == 1, "kept calling on a dead credential"
    assert run.fatal == "api_auth_failure"
    assert run.jobs_seen == 10 and run.retried == 1


async def test_a_healthy_run_reports_no_fatal() -> None:
    watchdog.reset()
    docs = [uuid4() for _ in range(3)]
    conn = _Conn([_rec(gd, "calendar") for gd in docs])

    async def run_parse(c, gd_id, blob, groups):
        pass

    run = await rf.retry_failed(
        conn, limit=50, fetch_blob=lambda p: b"%PDF-fake",
        run_parse_groups=run_parse,
    )
    assert run.fatal is None and run.retried == 3


async def test_an_ordinary_document_failure_does_not_stop_the_batch() -> None:
    # The isolation the worker already had must survive the new break: a
    # broken PDF is one document's problem, not the run's.
    watchdog.reset()
    docs = [uuid4() for _ in range(4)]
    conn = _Conn([_rec(gd, "calendar") for gd in docs])
    seen: list[UUID] = []

    async def run_parse(c, gd_id, blob, groups):
        seen.append(gd_id)
        if len(seen) == 1:
            raise ValueError("no text extracted from stored PDF")

    run = await rf.retry_failed(
        conn, limit=50, fetch_blob=lambda p: b"%PDF-fake",
        run_parse_groups=run_parse,
    )
    assert len(seen) == 4
    assert run.errors == 1 and run.retried == 3 and run.fatal is None
