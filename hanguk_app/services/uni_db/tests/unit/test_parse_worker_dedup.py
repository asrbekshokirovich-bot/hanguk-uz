"""persist_outcome must supersede a prior open review item for the same
(guideline document, field group) before inserting the fresh one, and must
never enqueue an empty/failed extraction (Phase 1 dedup + guard)."""

from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

from uni_db.extract.llm_anthropic import ExtractionResult
from uni_db.workers.parse_worker import ParseOutcome, persist_outcome


class _FakeConn:
    def __init__(self) -> None:
        self.sql: list[str] = []

    async def execute(self, sql: str, *args: object) -> str:
        self.sql.append(" ".join(sql.split()))  # normalize whitespace
        return "OK"


def _result(field_group: str, parsed_output: dict) -> ExtractionResult:
    return ExtractionResult(
        field_group=field_group, parsed_output=parsed_output, raw_output="{}",
        llm_provider="anthropic", llm_model="m",
        input_tokens=0, output_tokens=0, cost_usd=0.0, latency_ms=0,
        accuracy_self_score=0.8,
    )


def _outcome(results, entries) -> ParseOutcome:
    return ParseOutcome(
        guideline_document_id=uuid4(),
        archetype=SimpleNamespace(label="A"),
        degree=SimpleNamespace(is_combined=False),
        extraction_results=results,
        review_queue_entries=entries,
    )


async def test_supersedes_then_inserts() -> None:
    result = _result("requirements", {"rows": [{"applicant_category": "외국인전형"}]})
    entry = {"entity_type": "extraction_jobs", "entity_id": None,
             "reason": "high_difficulty_field", "priority": 3,
             "field_group": "requirements", "rationale": "r"}
    conn = _FakeConn()
    await persist_outcome(conn, _outcome([result], [entry]))

    supersede_idx = next(i for i, s in enumerate(conn.sql) if "set status = 'superseded'" in s)
    insert_idx = next(i for i, s in enumerate(conn.sql) if "insert into public.review_queue" in s)
    assert supersede_idx < insert_idx  # retire the old card before adding the new one


async def test_empty_extraction_not_enqueued() -> None:
    result = _result("tuition", {"rows": []})  # empty
    entry = {"entity_type": "extraction_jobs", "entity_id": None,
             "reason": "high_difficulty_field", "priority": 3,
             "field_group": "tuition", "rationale": "r"}
    conn = _FakeConn()
    await persist_outcome(conn, _outcome([result], [entry]))
    assert not any("insert into public.review_queue" in s for s in conn.sql)


async def test_failed_extraction_not_enqueued() -> None:
    result = _result("scholarships", {"_extraction_failed": "boom"})
    entry = {"entity_type": "extraction_jobs", "entity_id": None,
             "reason": "high_difficulty_field", "priority": 3,
             "field_group": "scholarships", "rationale": "r"}
    conn = _FakeConn()
    await persist_outcome(conn, _outcome([result], [entry]))
    assert not any("insert into public.review_queue" in s for s in conn.sql)


class _ArgConn:
    def __init__(self) -> None:
        self.calls: list[tuple[str, tuple]] = []

    async def execute(self, sql: str, *args: object) -> str:
        self.calls.append((" ".join(sql.split()), args))
        return "OK"


async def test_failed_job_records_error_text_not_raw_output() -> None:
    from uni_db.workers.parse_worker import _failed_result

    failed = _failed_result("requirements", "claude-sonnet-4-6",
                            violation="AnthropicResponseError: boom", latency_ms=123)
    assert failed.error_text == "AnthropicResponseError: boom"
    assert failed.raw_output == "{}"          # error not buried in raw_output
    assert failed.latency_ms == 123           # real elapsed, not 0

    conn = _ArgConn()
    await persist_outcome(conn, _outcome([failed], []))
    ins = next(args for sql, args in conn.calls if "insert into public.extraction_jobs" in sql)
    assert ins[-1] == "AnthropicResponseError: boom"   # error_text column ($17)
    assert "boom" not in ins[11]                        # raw_output ($12) is clean
