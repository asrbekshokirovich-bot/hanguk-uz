"""Phase 6 freshness guard — flag (never withhold) index-page / obsolete-token /
undated sources so the D1/D2/D6 defect class surfaces automatically instead of
being caught by hand. Past-cycle data is already held by is_stale_cycle; these
signals only raise needs_attention."""

from __future__ import annotations

from uuid import uuid4

from uni_db.workers import publish_worker as pw


def _rec(field_group, parsed_output, reviewer_decision=None, source_url_ko=None):
    return {
        "queue_id": uuid4(), "reviewer_decision": reviewer_decision,
        "field_group": field_group, "parsed_output": parsed_output,
        "accuracy_self_score": 0.9, "guideline_document_id": uuid4(),
        "institution_id": uuid4(), "source_url_ko": source_url_ko,
    }


class _Conn:
    def __init__(self, records):
        self._records = records
        self.executes: list[tuple] = []

    async def fetch(self, sql, *a):
        return self._records

    async def fetchval(self, sql, *a):
        return uuid4()

    async def execute(self, sql, *a):
        self.executes.append((" ".join(sql.split()), a))
        return "OK"

    def inserts_into(self, table):
        key = f"insert into public.{table} "
        return [a for sql, a in self.executes if key in sql]


# --------------------------------------------------------------------------- #
# pure detectors


class TestIndexPageSource:
    def test_direct_pdf_is_not_index(self):
        assert not pw.is_index_page_source(
            "https://ajou.ac.kr/files/2027_foreign_guide.pdf")

    def test_notice_board_is_index(self):
        assert pw.is_index_page_source(
            "https://yonsei.ac.kr/admission/notice.asp?mode=view&articleNo=123")

    def test_opaque_handle_is_index(self):
        assert pw.is_index_page_source(
            "https://inha.ac.kr/kr/index.do?menu_id=1234&bn=5678")

    def test_none_or_blank_is_not_index(self):
        assert not pw.is_index_page_source(None)
        assert not pw.is_index_page_source("   ")

    def test_pdf_behind_handle_not_flagged(self):
        # a linked document wins even if the URL also carries an index-ish query
        assert not pw.is_index_page_source(
            "https://korea.ac.kr/download.do?file=guide_2027.pdf&menu_id=9")


class TestObsoleteTokens:
    def test_hojeok_detected(self):
        assert pw.obsolete_tokens({"rows": [{"document_type": "호적등본"}]}) == ("호적등본",)

    def test_clean_payload(self):
        assert pw.obsolete_tokens({"rows": [{"document_type": "가족관계증명서"}]}) == ()


class TestFreshnessFlags:
    def test_missing_year(self):
        assert pw.freshness_flags({"rows": [{"source_text_ko": "x"}]}, None) == ("missing_year",)

    def test_present_year_is_clean(self):
        assert pw.freshness_flags({"rows": [{"source_text_ko": "2027학년도"}]}, None) == ()

    def test_year_in_url_counts_as_present(self):
        assert pw.freshness_flags(
            {"rows": [{"source_text_ko": "no year"}]},
            "https://x.ac.kr/guide_2027.pdf") == ()

    def test_combines_all_three(self):
        flags = pw.freshness_flags(
            {"rows": [{"document_type": "호적등본", "source_text_ko": "no year"}]},
            "https://x.ac.kr/notice.asp?mode=view")
        assert set(flags) == {"missing_year", "index_page_source", "obsolete_token:호적등본"}


# --------------------------------------------------------------------------- #
# end-to-end: flag but still publish; and never touch a clean current source


async def test_publish_flags_index_page_but_still_publishes():
    rec = _rec("requirements",
               {"rows": [{"applicant_category": "외국인전형",
                          "source_text_ko": "2027학년도 모집"}]},
               source_url_ko="https://yonsei.ac.kr/dorm/notice.asp?mode=view&articleNo=9")
    conn = _Conn([rec])
    run = await pw.publish_pending(conn)
    assert run.published == 1 and run.held == 0 and run.flagged == 1
    args = conn.inserts_into("requirements")[0]
    assert args[-2] is True                       # needs_attention raised
    assert "index_page_source" in args[-1]        # reason recorded


async def test_publish_flags_missing_year_and_obsolete_token():
    rec = _rec("documents_required",
               {"rows": [{"document_name_ko": "호적등본", "source_text_ko": "no year here"}]})
    conn = _Conn([rec])
    run = await pw.publish_pending(conn)
    assert run.published == 1 and run.flagged == 1
    args = conn.inserts_into("documents_required")[0]
    assert args[-2] is True
    assert "missing_year" in args[-1] and "obsolete_token:호적등본" in args[-1]


async def test_clean_current_source_not_flagged():
    rec = _rec("requirements",
               {"rows": [{"applicant_category": "외국인전형",
                          "source_text_ko": "2027학년도 모집"}]},
               source_url_ko="https://ajou.ac.kr/files/2027_foreign_guide.pdf")
    conn = _Conn([rec])
    run = await pw.publish_pending(conn)
    assert run.flagged == 0
    args = conn.inserts_into("requirements")[0]
    assert args[-2] is False                      # freshness did NOT set needs_attention
