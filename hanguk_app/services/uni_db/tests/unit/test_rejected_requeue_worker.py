"""rejected_requeue_worker sends rejected sections back through review.

DB and blob storage are faked. Covers: grouping rejected cards per document,
re-extracting ONLY the rejected field groups, the content-hash guard (a stored
blob that no longer matches guideline_documents.file_hash_sha256 is skipped),
the retry cap being passed down to the query, and batch error isolation.

The lane split itself (which reasons re-extract vs. re-fetch) lives in
public.v_rejected_awaiting_requeue and fn_reject_reason_lane; here we assert
the Python mirror of it stays in step with what the worker claims to fix.
"""

from __future__ import annotations

import hashlib
from uuid import UUID, uuid4

from uni_db.workers import rejected_requeue_worker as rr


class _Conn:
    def __init__(self, records: list[dict]) -> None:
        self._records = records
        self.calls: list[tuple[object, ...]] = []

    async def fetch(self, sql: str, *args: object) -> list[dict]:
        self.calls.append(args)
        limit, max_rejects = args[0], args[1]
        keep = [r for r in self._records if r.get("reject_count", 1) <= int(max_rejects)]
        return keep[: int(limit)]


def _rec(gd_id: UUID, group: str, data: bytes = b"%PDF-fake",
         hash_override: str | None = None, reject_count: int = 1,
         reason: str = "hallucinated_field") -> dict:
    return {
        "queue_id": uuid4(),
        "guideline_document_id": gd_id,
        "field_group": group,
        "reason": reason,
        "storage_path": f"guideline-blobs/{gd_id}.pdf",
        "file_hash_sha256": hash_override
        if hash_override is not None else hashlib.sha256(data).hexdigest(),
        "reject_count": reject_count,
    }


async def test_groups_rejected_cards_per_document_and_requeues_only_those() -> None:
    gd = uuid4()
    data = b"%PDF-fake"
    conn = _Conn([_rec(gd, "requirements", data), _rec(gd, "tuition", data)])
    calls: list[tuple[UUID, tuple[str, ...]]] = []

    async def run_parse(c, gd_id, blob, groups):
        assert blob == data
        calls.append((gd_id, groups))

    run = await rr.requeue_rejected(
        conn, limit=10, fetch_blob=lambda _p: data, run_parse_groups=run_parse
    )

    # One PDF fetched once, both rejected sections re-extracted together, and
    # nothing else in the document is re-billed.
    assert calls == [(gd, ("requirements", "tuition"))]
    assert (run.cards_seen, run.documents, run.requeued) == (2, 1, 1)
    assert (run.hash_mismatch, run.errors) == (0, 0)


async def test_skips_blob_whose_hash_no_longer_matches() -> None:
    gd = uuid4()
    conn = _Conn([_rec(gd, "requirements", hash_override="deadbeef")])
    calls: list[object] = []

    async def run_parse(c, gd_id, blob, groups):
        calls.append(gd_id)

    run = await rr.requeue_rejected(
        conn, limit=10, fetch_blob=lambda _p: b"%PDF-other",
        run_parse_groups=run_parse,
    )

    assert calls == []            # never spend LLM budget on a swapped blob
    assert run.hash_mismatch == 1
    assert run.requeued == 0


async def test_one_failing_document_does_not_abort_the_batch() -> None:
    good, bad = uuid4(), uuid4()
    data = b"%PDF-fake"
    conn = _Conn([_rec(bad, "calendar", data), _rec(good, "requirements", data)])
    done: list[UUID] = []

    async def run_parse(c, gd_id, blob, groups):
        if gd_id == bad:
            raise RuntimeError("extraction blew up")
        done.append(gd_id)

    run = await rr.requeue_rejected(
        conn, limit=10, fetch_blob=lambda _p: data, run_parse_groups=run_parse
    )

    assert done == [good]
    assert (run.errors, run.requeued, run.documents) == (1, 1, 2)


async def test_retry_cap_is_passed_to_the_query_and_bounds_the_loop() -> None:
    gd_fresh, gd_exhausted = uuid4(), uuid4()
    data = b"%PDF-fake"
    conn = _Conn([
        _rec(gd_fresh, "requirements", data, reject_count=1),
        _rec(gd_exhausted, "requirements", data, reject_count=5),
    ])
    seen: list[UUID] = []

    async def run_parse(c, gd_id, blob, groups):
        seen.append(gd_id)

    run = await rr.requeue_rejected(
        conn, limit=10, max_rejects=2,
        fetch_blob=lambda _p: data, run_parse_groups=run_parse,
    )

    # A section the model keeps getting wrong stops costing money.
    assert seen == [gd_fresh]
    assert run.cards_seen == 1
    assert conn.calls[0] == (10, 2)


async def test_default_cap_is_used_when_caller_does_not_override() -> None:
    conn = _Conn([])

    await rr.requeue_rejected(
        conn, limit=5, fetch_blob=lambda _p: b"", run_parse_groups=None
    )

    assert conn.calls[0] == (5, rr.MAX_REJECTS)


def test_lane_reasons_are_disjoint_and_cover_every_reject_reason() -> None:
    # fn_review_reject's CHECK constraint accepts exactly these six.
    accepted = {
        "wrong_year", "wrong_archetype", "hallucinated_field",
        "ocr_garbled", "source_404", "other",
    }
    assert accepted == (rr.EXTRACTION_LANE_REASONS | rr.SOURCE_LANE_REASONS)
    assert not (rr.EXTRACTION_LANE_REASONS & rr.SOURCE_LANE_REASONS)

    # Re-reading the same bytes cannot fix a wrong document, so those two
    # reasons must never land in the re-extraction lane.
    assert "wrong_year" not in rr.EXTRACTION_LANE_REASONS
    assert "source_404" not in rr.EXTRACTION_LANE_REASONS
