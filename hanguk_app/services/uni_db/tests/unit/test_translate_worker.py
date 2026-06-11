"""run_jobs must isolate a failing row: one bad translation (provider error or a
bad DB write) cannot abort the rest of the batch."""

from __future__ import annotations

from uuid import uuid4

from uni_db.workers import translate_worker as tw
from uni_db.workers.translate_worker import TranslationJob


class _Conn:
    def __init__(self) -> None:
        self.executes: list[tuple] = []

    async def execute(self, sql: str, *args: object) -> str:
        self.executes.append(args)
        return "OK"


class _Result:
    text_value = "translated"
    provider = "mock"
    confidence = 0.9
    back_trans_distance = None


def _job(i: int) -> TranslationJob:
    return TranslationJob(
        entity_type="institutions",
        entity_id=uuid4(),
        field_name=f"f{i}",
        source_text_ko="한국어 텍스트",
        target_lang="en",
        is_label=True,
    )


async def test_run_jobs_isolates_a_failing_row(monkeypatch) -> None:
    jobs = [_job(1), _job(2), _job(3)]
    calls = {"n": 0}

    def fake_translate(**_kw: object) -> _Result:
        calls["n"] += 1
        if calls["n"] == 2:                       # the middle row blows up
            raise RuntimeError("provider boom")
        return _Result()

    monkeypatch.setattr(tw, "translate", fake_translate)
    monkeypatch.setattr(tw, "is_suspect_translation", lambda *_a, **_k: False)

    conn = _Conn()
    written = await tw.run_jobs(conn, jobs, glossary={})

    assert written == 2                            # rows 1 and 3 still persisted
    assert len(conn.executes) == 2
