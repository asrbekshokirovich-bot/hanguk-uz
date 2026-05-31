"""publish_worker normalizes approved review items into the public tables.

The DB is faked (records in, inserts captured), so these cover the worker's
logic: payload selection (reviewer edit > raw), the per-field-group mapping,
cycle get-or-create for cycle-scoped tables, the document-name fallback,
skip/idempotency, and batch error isolation.
"""

from __future__ import annotations

from datetime import date
from uuid import uuid4

from uni_db.workers import publish_worker as pw


class _Conn:
    def __init__(self, records: list[dict]) -> None:
        self._records = records
        self.executes: list[tuple[str, tuple]] = []
        self.fetchvals = 0
        self.cycle_tracks: list[str | None] = []
        self._cycle_ids: dict[tuple, object] = {}

    async def fetch(self, sql: str, *args: object) -> list[dict]:
        return self._records

    async def fetchval(self, sql: str, *args: object):
        # get_or_create_cycle(institution, year, term, track, category, gd)
        self.fetchvals += 1
        track = args[3] if len(args) > 3 else None
        self.cycle_tracks.append(track)
        return self._cycle_ids.setdefault((track, args[4] if len(args) > 4 else None), uuid4())

    async def execute(self, sql: str, *args: object) -> str:
        self.executes.append((" ".join(sql.split()), args))
        return "OK"

    def inserts_into(self, table: str) -> list[tuple]:
        key = f"insert into public.{table} "
        return [args for sql, args in self.executes if key in sql]

    @property
    def marked_published(self) -> int:
        return sum(1 for sql, _ in self.executes
                   if "update public.review_queue set published_at" in sql)


def _rec(field_group: str, parsed_output: dict, reviewer_decision=None,
         source_url_ko=None) -> dict:
    return {
        "queue_id": uuid4(), "reviewer_decision": reviewer_decision,
        "field_group": field_group, "parsed_output": parsed_output,
        "accuracy_self_score": 0.9, "guideline_document_id": uuid4(),
        "institution_id": uuid4(), "source_url_ko": source_url_ko,
    }


# --------------------------------------------------------------------------- #
# pure helpers


class TestHelpers:
    def test_infer_year_from_payload(self) -> None:
        assert pw.infer_year({"rows": [{"source_text_ko": "2027학년도 모집"}]},
                             default=2099) == 2027

    def test_infer_year_default_when_absent(self) -> None:
        assert pw.infer_year({"rows": [{"x": "no year"}]}, default=2027) == 2027

    def test_infer_term_fall_vs_spring(self) -> None:
        assert pw.infer_term({"rows": [{"source_text_ko": "2026 후기 9월 모집"}]}) == "fall"
        assert pw.infer_term({"rows": [{"source_text_ko": "전기 모집"}]}) == "spring"

    def test_first_doc_name_fallback(self) -> None:
        assert pw.first_doc_name({"document_name_ko": "졸업증명서"}) == "졸업증명서"
        assert pw.first_doc_name({"name_ko": "여권"}) == "여권"
        assert pw.first_doc_name({"nothing": 1}) == "서류"

    def test_as_date(self) -> None:
        assert pw._as_date("2026-09-01") == date(2026, 9, 1)
        assert pw._as_date("2026-09-01T09:00:00Z") == date(2026, 9, 1)
        assert pw._as_date(None) is None
        assert pw._as_date("nope") is None

    def test_payload_prefers_reviewer_edit(self) -> None:
        rec = {"reviewer_decision": {"rows": [{"e": 1}]}, "parsed_output": {"rows": [{"r": 1}]}}
        assert pw._payload(rec) == {"rows": [{"e": 1}]}
        rec2 = {"reviewer_decision": None, "parsed_output": {"rows": [{"r": 1}]}}
        assert pw._payload(rec2) == {"rows": [{"r": 1}]}


class TestCycleResolution:
    def test_track_from_audience(self) -> None:
        assert pw.track_for("foreign", "외국인전형") == "foreign"
        assert pw.track_for("overseas_korean", None) == "overseas_korean_full"

    def test_track_from_category_text_when_no_audience(self) -> None:
        assert pw.track_for(None, "재외국민 특별전형") == "overseas_korean_full"
        assert pw.track_for(None, "편입학 모집") == "transfer"
        assert pw.track_for(None, "대학원 외국인전형") == "grad_foreign"
        assert pw.track_for(None, "외국인전형") == "foreign"
        assert pw.track_for(None, None) == "foreign"

    def test_category_for(self) -> None:
        assert pw.category_for({"applicant_category": "재외국민전형"}) == "재외국민전형"
        assert pw.category_for({}) == "외국인전형"


async def test_requirements_resolves_a_cycle_per_audience() -> None:
    rec = _rec("requirements", {"rows": [
        {"audience": "foreign", "applicant_category": "외국인전형", "source_text_ko": "x"},
        {"audience": "overseas_korean", "applicant_category": "재외국민전형", "source_text_ko": "y"},
    ]})
    conn = _Conn([rec])
    run = await pw.publish_pending(conn)
    assert run.rows_written == 2
    assert conn.fetchvals == 2                                   # one cycle per row
    assert set(conn.cycle_tracks) == {"foreign", "overseas_korean_full"}


# --------------------------------------------------------------------------- #
# publish_pending


async def test_publishes_tuition_and_marks_done() -> None:
    rec = _rec("tuition", {"rows": [{"faculty_group": "인문",
                                     "academic_year": date.today().year,
                                     "semester_number": 1, "amount_krw": 4800000,
                                     "source_text_ko": "x"}]})
    conn = _Conn([rec])
    run = await pw.publish_pending(conn)
    assert run.published == 1 and run.rows_written == 1
    assert len(conn.inserts_into("tuition")) == 1
    assert conn.marked_published == 1


async def test_requirements_creates_cycle_then_inserts() -> None:
    rec = _rec("requirements", {"rows": [{"applicant_category": "외국인전형",
                                          "topik_min_level": 3, "source_text_ko": "x"}]})
    conn = _Conn([rec])
    run = await pw.publish_pending(conn)
    assert conn.fetchvals == 1                      # cycle get-or-create
    assert len(conn.inserts_into("requirements")) == 1
    assert run.rows_written == 1


async def test_documents_uses_doc_name_fallback() -> None:
    rec = _rec("documents_required",
               {"rows": [{"document_name_ko": "졸업증명서", "source_text_ko": "x"}]})
    conn = _Conn([rec])
    await pw.publish_pending(conn)
    args = conn.inserts_into("documents_required")[0]
    assert "졸업증명서" in args                      # document_type filled from fallback


async def test_calendar_periods_to_admission_periods() -> None:
    cy = date.today().year
    rec = _rec("calendar", {"events": [], "periods": [
        {"program_level": "undergraduate", "application_start": f"{cy}-09-01",
         "application_end": f"{cy}-09-30", "result_announcement": f"{cy}-11-20"}]})
    conn = _Conn([rec])
    run = await pw.publish_pending(conn)
    assert len(conn.inserts_into("university_admission_periods")) == 1
    assert run.rows_written == 1


async def test_reviewer_edit_takes_precedence() -> None:
    rec = _rec("scholarships",
               {"rows": [{"scope": "university", "name_ko": "RAW",
                          "award_type": "tuition_waiver_pct", "source_text_ko": "x"}]},
               reviewer_decision={"rows": [{"scope": "university", "name_ko": "EDITED",
                                            "award_type": "tuition_waiver_pct",
                                            "source_text_ko": "x"}]})
    conn = _Conn([rec])
    await pw.publish_pending(conn)
    args = conn.inserts_into("scholarships")[0]
    assert "EDITED" in args and "RAW" not in args


async def test_skips_empty_payload_but_marks_published() -> None:
    rec = _rec("tuition", {"rows": []})
    conn = _Conn([rec])
    run = await pw.publish_pending(conn)
    assert run.skipped == 1 and run.published == 0
    assert conn.inserts_into("tuition") == []
    assert conn.marked_published == 1               # don't re-scan it next run


async def test_failed_extraction_skipped() -> None:
    rec = _rec("requirements", {"_extraction_failed": "boom"})
    conn = _Conn([rec])
    run = await pw.publish_pending(conn)
    assert run.skipped == 1
    assert conn.inserts_into("requirements") == []


async def test_one_bad_item_does_not_abort_batch() -> None:
    good = _rec("scholarships", {"rows": [{"scope": "university", "name_ko": "S",
                                           "award_type": "airfare", "source_text_ko": "x"}]})
    bad = _rec("tuition", {"rows": [{"amount_krw": 1}]})
    conn = _Conn([good, bad])

    real_execute = conn.execute

    async def execute(sql: str, *args: object):
        if "insert into public.tuition" in " ".join(sql.split()):
            raise RuntimeError("boom")
        return await real_execute(sql, *args)

    conn.execute = execute  # type: ignore[method-assign]
    run = await pw.publish_pending(conn)
    assert run.published == 1 and run.errors == 1


# --------------------------------------------------------------------------- #
# staleness guard — never publish a past-cycle source as if it were current


class TestStaleness:
    def test_old_payload_year_is_stale(self) -> None:
        assert pw.is_stale_cycle({"rows": [{"source_text_ko": "2022학년도 모집"}]},
                                 None, floor=2026)

    def test_old_source_url_year_is_stale(self) -> None:
        # cdu's '...guidebook_20171...' concatenates year+term — the lenient URL
        # regex still reads 2017 out of it.
        assert pw.is_stale_cycle(
            {"rows": [{"source_text_ko": "no year here"}]},
            "https://cdu.ac.kr/cdu_doc_admission_guidebook_20171_for_sin.pdf",
            floor=2026)

    def test_current_year_is_not_stale(self) -> None:
        assert not pw.is_stale_cycle({"rows": [{"source_text_ko": "2027학년도"}]},
                                     None, floor=2026)

    def test_undated_is_not_stale(self) -> None:
        # no year anywhere → publish via the unverified-cycle path, not held
        assert not pw.is_stale_cycle({"rows": [{"source_text_ko": "x"}]}, None, floor=2026)

    def test_newest_year_decides(self) -> None:
        assert not pw.is_stale_cycle(
            {"rows": [{"source_text_ko": "갱신 전 2022 자료 → 2027학년도 모집"}]},
            None, floor=2026)


async def test_publish_holds_past_cycle_from_payload() -> None:
    rec = _rec("requirements",
               {"rows": [{"applicant_category": "외국인전형", "source_text_ko": "2017학년도 모집"}]})
    conn = _Conn([rec])
    run = await pw.publish_pending(conn)
    assert run.held == 1 and run.published == 0
    assert conn.inserts_into("requirements") == []
    assert conn.marked_published == 1               # processed; won't re-scan


async def test_publish_holds_past_cycle_from_source_url() -> None:
    rec = _rec("requirements",
               {"rows": [{"applicant_category": "외국인전형", "source_text_ko": "no year"}]},
               source_url_ko="https://cdu.ac.kr/admission/guidebook_20171_for_sin.pdf")
    conn = _Conn([rec])
    run = await pw.publish_pending(conn)
    assert run.held == 1
    assert conn.inserts_into("requirements") == []


async def test_publish_allows_undated_current_data() -> None:
    # gimcheon-style: real scholarship rows, no year stamp anywhere → must still
    # publish (don't withhold good undated data).
    rec = _rec("scholarships", {"rows": [{"scope": "university", "name_ko": "유학장학",
                                          "award_type": "tuition_waiver_pct", "award_value": 30,
                                          "source_text_ko": "토픽3급 수업료 30%"}]})
    conn = _Conn([rec])
    run = await pw.publish_pending(conn)
    assert run.held == 0 and run.published == 1
    assert len(conn.inserts_into("scholarships")) == 1


# --------------------------------------------------------------------------- #
# empty-card guard — don't publish a scholarship that carries no award info


class TestEmptyScholarship:
    def test_other_with_no_award_is_empty(self) -> None:
        assert pw._is_empty_scholarship(
            {"award_type": "other", "award_value": None,
             "topik_tier_table": None, "ielts_tier_table": None})

    def test_real_award_is_not_empty(self) -> None:
        assert not pw._is_empty_scholarship(
            {"award_type": "tuition_waiver_pct", "award_value": 50})
        assert not pw._is_empty_scholarship(
            {"award_type": "other", "award_value": None, "topik_tier_table": {"3": 30}})


async def test_skips_empty_scholarship_card() -> None:
    # hanseo: one phantom 'no scholarships here' row + one real award.
    rec = _rec("scholarships", {"rows": [
        {"scope": "university", "name_ko": "외국인 특별전형 입학", "award_type": "other",
         "award_value": None, "source_text_ko": "별도 장학금 조항 없음"},
        {"scope": "university", "name_ko": "성적우수장학", "award_type": "tuition_waiver_pct",
         "award_value": 50, "source_text_ko": "x"},
    ]})
    conn = _Conn([rec])
    run = await pw.publish_pending(conn)
    assert run.rows_written == 1                     # only the real scholarship
    assert len(conn.inserts_into("scholarships")) == 1
