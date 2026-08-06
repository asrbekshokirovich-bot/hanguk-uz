"""guideline_finder_worker discovers each university's current 모집요강 PDF.

Heavy steps (Naver search, HTTP→PDF resolve, storage, parse) are injected, so
these cover the worker's own logic: keyword construction, on-domain candidate
ranking, the new-vs-already-seen decision (URL match / hash match), the skip
paths, and batch error isolation across the institution sweep. No live HTTP,
LLM, or DB.
"""

from __future__ import annotations

import hashlib
from uuid import uuid4

from uni_db.discovery.models import Announcement
from uni_db.workers import guideline_finder_worker as gfw

PDF = b"%PDF-1.4 a real guideline"
PDF_SHA = hashlib.sha256(PDF).hexdigest()


def _ann(url: str, title: str) -> Announcement:
    return Announcement(external_post_id="x", title_ko=title, url_ko=url, posted_at=None)


class _Conn:
    """Fake asyncpg connection with configurable already-known URLs/hashes."""

    def __init__(
        self,
        *,
        known_urls: set[str] | None = None,
        known_hashes: set[str] | None = None,
        institutions: list[dict] | None = None,
    ) -> None:
        self.known_urls = known_urls or set()
        self.known_hashes = known_hashes or set()
        self.institutions = institutions or []
        self.executed: list[str] = []

    async def fetchrow(self, sql: str, *args: object):
        s = " ".join(sql.split())
        if "source_url_ko = $1" in s and "parse_status" in s:
            return {"one": 1} if args[0] in self.known_urls else None
        if "file_hash_sha256 = $1" in s and "parse_status" in s:
            return {"one": 1} if args[0] in self.known_hashes else None
        if s.startswith("select id from public.guideline_documents where file_hash_sha256"):
            return {"id": uuid4()}
        return None

    async def execute(self, sql: str, *args: object) -> str:
        self.executed.append(" ".join(sql.split()))
        return "OK"

    async def fetch(self, sql: str, *args: object) -> list:
        return self.institutions


class _Stored:
    storage_path = "guideline-blobs/deadbeef.pdf"


def _store(data: bytes, *, sha256: str, mime: str) -> _Stored:
    return _Stored()


def _row(domain: str = "inha.ac.kr", name: str = "인하대학교") -> dict:
    return {
        "id": uuid4(),
        "name_ko": name,
        "name_ko_short": None,
        "name_en": None,
        "primary_domain": domain,
    }


def _search_returning(*anns: Announcement) -> gfw.SearchSiteFn:
    async def search(_domain: str, _keyword: str) -> list[Announcement]:
        return list(anns)

    return search


# --------------------------------------------------------------------------- #
# keyword construction
# --------------------------------------------------------------------------- #


class TestKeywords:
    def test_year_tagged_first_then_bare_no_dupes(self) -> None:
        kws = gfw.build_search_keywords(2027)
        assert kws[0] == "2027학년도 외국인전형 모집요강"
        assert "모집요강" in kws                       # bare fallback present
        assert len(kws) == len(set(kws))              # deduped
        # every base keyword appears both year-tagged and bare
        assert "2027학년도 모집요강" in kws


# --------------------------------------------------------------------------- #
# candidate ranking + on-domain filtering
# --------------------------------------------------------------------------- #


class TestGatherCandidates:
    async def test_prefers_pdf_guideline_and_drops_offdomain(self) -> None:
        search = _search_returning(
            _ann("https://admission.inha.ac.kr/board?seq=9", "인하대 외국인전형 안내"),
            _ann("https://admission.inha.ac.kr/2027_모집요강.pdf", "2027 외국인전형 모집요강"),
            _ann("https://other.ac.kr/2027_모집요강.pdf", "다른대 모집요강"),  # off-domain
        )
        cands = await gfw.gather_candidates(
            search, domain="inha.ac.kr", keywords=["모집요강"], year=2027
        )
        urls = [c.url for c in cands]
        assert "https://other.ac.kr/2027_모집요강.pdf" not in urls   # off-domain dropped
        assert urls[0].endswith("2027_모집요강.pdf")                 # best-ranked first

    async def test_procurement_noise_ranked_last(self) -> None:
        search = _search_returning(
            _ann("https://inha.ac.kr/a.pdf", "외국인 모집요강 제작업체 선정입찰"),  # tender
            _ann("https://inha.ac.kr/b.pdf", "2027 외국인전형 모집요강"),
        )
        cands = await gfw.gather_candidates(
            search, domain="inha.ac.kr", keywords=["모집요강"], year=2027
        )
        assert cands[0].url.endswith("b.pdf")
        assert cands[-1].url.endswith("a.pdf")

    async def test_keyword_error_is_isolated(self) -> None:
        async def search(_domain: str, keyword: str) -> list[Announcement]:
            if keyword == "boom":
                raise RuntimeError("naver 429")
            return [_ann("https://inha.ac.kr/g.pdf", "모집요강")]

        cands = await gfw.gather_candidates(
            search, domain="inha.ac.kr", keywords=["boom", "모집요강"], year=2027
        )
        assert [c.url for c in cands] == ["https://inha.ac.kr/g.pdf"]


# --------------------------------------------------------------------------- #
# per-institution new-vs-seen decision
# --------------------------------------------------------------------------- #


async def _process(conn, row, *, search, resolve, run_parse):
    return await gfw.process_one_institution(
        conn, row,
        keywords=["모집요강"], year=2027, per_institution=3,
        search_site=search, resolve=resolve,
        store_blob=_store, run_parse=run_parse,
    )


async def test_ingests_new_guideline() -> None:
    conn = _Conn()
    parsed: list = []

    async def parse(c, gd, d):
        parsed.append(gd)

    async def resolve(url: str):
        return PDF, "application/pdf"

    outcome, note, seen = await _process(
        conn, _row(),
        search=_search_returning(_ann("https://inha.ac.kr/2027_모집요강.pdf", "2027 모집요강")),
        resolve=resolve, run_parse=parse,
    )
    assert outcome == "ingested"
    assert note.endswith("2027_모집요강.pdf")
    assert len(parsed) == 1                                   # paid parse ran once
    assert any("insert into public.guideline_documents" in e for e in conn.executed)


async def test_known_hash_skips_before_identity_and_parse() -> None:
    # Freshness is content-based: a PDF we already hold (by hash) is skipped
    # BEFORE paying for the identity check or the parse.
    conn = _Conn(known_hashes={PDF_SHA})
    parsed: list = []
    identity_calls: list = []

    async def resolve(u: str):
        return PDF, "application/pdf"

    async def parse(c, gd, d):
        parsed.append(gd)

    def identity(data, row):
        identity_calls.append(1)   # must NOT run for a hash we already hold
        return True

    outcome, _note, _seen = await gfw.process_one_institution(
        conn, _row(), keywords=["모집요강"], year=2027, per_institution=3,
        search_site=_search_returning(_ann("https://inha.ac.kr/new-url.pdf", "2027 모집요강")),
        resolve=resolve, store_blob=_store, run_parse=parse, identity_check=identity,
    )
    assert outcome == "unchanged"
    assert identity_calls == []
    assert parsed == []


async def test_one_bad_candidate_does_not_abort_others() -> None:
    # The first-ranked candidate raises; the institution's next candidate must
    # still be tried (one bad PDF can't stall the whole school).
    conn = _Conn()
    parsed: list = []

    async def resolve(u: str):
        if "bad" in u:
            raise RuntimeError("network boom")
        return PDF, "application/pdf"

    async def parse(c, gd, d):
        parsed.append(gd)

    search = _search_returning(
        _ann("https://inha.ac.kr/bad_2027_모집요강.pdf", "2027 모집요강"),   # shorter URL → ranked first
        _ann("https://inha.ac.kr/good_2027_모집요강.pdf", "2027 모집요강"),
    )
    outcome, _note, _seen = await gfw.process_one_institution(
        conn, _row(), keywords=["모집요강"], year=2027, per_institution=3,
        search_site=search, resolve=resolve, store_blob=_store, run_parse=parse,
    )
    assert outcome == "ingested"
    assert len(parsed) == 1


async def test_unchanged_when_hash_already_seen() -> None:
    conn = _Conn(known_hashes={PDF_SHA})
    parsed: list = []

    async def resolve(u: str):
        return PDF, "application/pdf"

    async def parse(c, gd, d):
        parsed.append(gd)

    outcome, _note, _seen = await _process(
        conn, _row(),
        search=_search_returning(_ann("https://inha.ac.kr/new-url.pdf", "2027 모집요강")),
        resolve=resolve, run_parse=parse,
    )
    assert outcome == "unchanged"                             # same PDF, new URL
    assert parsed == []                                       # not re-parsed


async def test_skipped_when_no_candidates() -> None:
    conn = _Conn()

    async def resolve(u: str):  # pragma: no cover - never called
        return PDF, "application/pdf"

    async def parse(c, gd, d):  # pragma: no cover - never called
        return None

    outcome, _note, seen = await _process(
        conn, _row(), search=_search_returning(), resolve=resolve, run_parse=parse,
    )
    assert outcome == "skipped"
    assert seen == 0


async def test_skipped_when_candidate_has_no_pdf() -> None:
    conn = _Conn()

    async def resolve(u: str):
        return None, "URL is not a direct PDF and no download link found on the page"

    async def parse(c, gd, d):  # pragma: no cover - never called
        return None

    outcome, note, _seen = await _process(
        conn, _row(),
        search=_search_returning(_ann("https://inha.ac.kr/board?seq=1", "모집요강")),
        resolve=resolve, run_parse=parse,
    )
    assert outcome == "skipped"
    assert "not a direct PDF" in note


# --------------------------------------------------------------------------- #
# full sweep: tally + error isolation
# --------------------------------------------------------------------------- #


async def test_find_new_guidelines_tallies_and_isolates_errors() -> None:
    good = _row("good.ac.kr", "굿대학교")
    bad = _row("bad.ac.kr", "배드대학교")
    conn = _Conn(institutions=[good, bad])

    async def search(domain: str, _kw: str) -> list[Announcement]:
        return [_ann(f"https://{domain}/2027_모집요강.pdf", "2027 모집요강")]

    async def resolve(url: str):
        if "bad.ac.kr" in url:
            raise RuntimeError("network boom")
        return PDF, "application/pdf"

    async def parse(c, gd, d):
        return None

    run = await gfw.find_new_guidelines(
        conn, http=None,  # type: ignore[arg-type]
        year=2027, limit=10,
        search_site=search, resolve=resolve, store_blob=_store, run_parse=parse,
    )
    assert run.institutions_seen == 2
    assert run.ingested == 1
    # The bad school's only candidate errored — isolated inside the candidate
    # loop, so the school is 'skipped', not a fatal institution-level error, and
    # the good school still ingested.
    assert run.skipped == 1
    assert run.errors == 0


# --------------------------------------------------------------------------- #
# Gate 0 — identity check
# --------------------------------------------------------------------------- #


async def test_identity_reject_skips_candidate() -> None:
    conn = _Conn()
    parsed: list = []

    async def resolve(u: str):
        return PDF, "application/pdf"

    async def parse(c, gd, d):
        parsed.append(gd)

    outcome, note, _seen = await gfw.process_one_institution(
        conn, _row(),
        keywords=["모집요강"], year=2027, per_institution=3,
        search_site=_search_returning(_ann("https://inha.ac.kr/2027_모집요강.pdf", "2027 모집요강")),
        resolve=resolve, store_blob=_store, run_parse=parse,
        identity_check=lambda data, row: False,        # Gate 0 rejects everything
    )
    assert outcome == "skipped"
    assert "identity" in note
    assert parsed == []                                 # never stored or parsed


async def test_identity_accept_ingests() -> None:
    conn = _Conn()
    parsed: list = []

    async def resolve(u: str):
        return PDF, "application/pdf"

    async def parse(c, gd, d):
        parsed.append(gd)

    outcome, _note, _seen = await gfw.process_one_institution(
        conn, _row(),
        keywords=["모집요강"], year=2027, per_institution=3,
        search_site=_search_returning(_ann("https://inha.ac.kr/2027_모집요강.pdf", "2027 모집요강")),
        resolve=resolve, store_blob=_store, run_parse=parse,
        identity_check=lambda data, row: True,
    )
    assert outcome == "ingested"
    assert len(parsed) == 1


def test_pdf_head_text_on_non_pdf_is_empty() -> None:
    assert gfw.pdf_head_text(b"this is not a pdf") == ""


# --------------------------------------------------------------------------- #
# target cycle from the CRM intakes table
# --------------------------------------------------------------------------- #


async def test_fetch_target_cycle_reads_default_intake() -> None:
    class _IntakeConn:
        async def fetchrow(self, sql: str, *a: object):
            assert "public.intakes" in sql
            return {"season": "fall", "year": 2027}

    assert await gfw.fetch_target_cycle(_IntakeConn()) == (2027, "fall")


async def test_fetch_target_cycle_missing_table_returns_none() -> None:
    class _NoTableConn:
        async def fetchrow(self, sql: str, *a: object):
            raise RuntimeError('relation "public.intakes" does not exist')

    assert await gfw.fetch_target_cycle(_NoTableConn()) is None


# --- ingest_one_url: single caller-supplied URL (no search backend) -----------

async def _resolve_ok(_url: str):
    return PDF, "application/pdf"


async def _resolve_none(_url: str):
    return None, "not a pdf"


def _make_parse(sink: list):
    async def parse(_conn, gd_id, _data) -> None:
        sink.append(gd_id)
    return parse


async def test_ingest_url_ingests_new_pdf() -> None:
    parsed: list = []
    conn = _Conn()
    outcome, note = await gfw.ingest_one_url(
        conn, _row(), "https://inha.ac.kr/guide.pdf",
        resolve=_resolve_ok, store_blob=_store, run_parse=_make_parse(parsed),
    )
    assert outcome == "ingested"
    assert len(parsed) == 1  # the parse gauntlet ran on the new doc


async def test_ingest_url_dedups_by_content_hash() -> None:
    parsed: list = []
    conn = _Conn(known_hashes={PDF_SHA})
    outcome, _ = await gfw.ingest_one_url(
        conn, _row(), "https://inha.ac.kr/guide.pdf",
        resolve=_resolve_ok, store_blob=_store, run_parse=_make_parse(parsed),
    )
    assert outcome == "unchanged"
    assert parsed == []  # already-seen content: no re-parse


async def test_ingest_url_identity_reject_skips() -> None:
    parsed: list = []
    conn = _Conn()
    outcome, _ = await gfw.ingest_one_url(
        conn, _row(), "https://inha.ac.kr/wrong.pdf",
        resolve=_resolve_ok, store_blob=_store, run_parse=_make_parse(parsed),
        identity_check=lambda _data, _row: False,
    )
    assert outcome == "skipped"
    assert parsed == []
    # A single caller-supplied URL that fails identity is worth a human look —
    # unlike process_one_institution's multi-candidate loop, there's no next
    # candidate to fall back to, so this must not vanish silently.
    assert any("insert into public.proposed_sources" in e for e in conn.executed)


async def test_ingest_url_resolve_none_skips() -> None:
    conn = _Conn()
    outcome, note = await gfw.ingest_one_url(
        conn, _row(), "https://inha.ac.kr/page.html",
        resolve=_resolve_none, store_blob=_store, run_parse=_make_parse([]),
    )
    assert outcome == "skipped"
    assert note == "not a pdf"
    assert any("insert into public.proposed_sources" in e for e in conn.executed)


async def test_ingest_url_records_reject_note_with_custom_recorder() -> None:
    notes, record = _notes_sink()
    outcome, _ = await gfw.ingest_one_url(
        _Conn(), _row(), "https://inha.ac.kr/wrong.pdf",
        resolve=_resolve_ok, store_blob=_store, run_parse=_make_parse([]),
        identity_check=lambda _data, _row: False,
        record_note=record,
    )
    assert outcome == "skipped"
    assert len(notes) == 1
    assert "rejected" in notes[0][1]


async def test_ingest_url_records_resolve_failure_with_custom_recorder() -> None:
    notes, record = _notes_sink()
    outcome, note = await gfw.ingest_one_url(
        _Conn(), _row(), "https://inha.ac.kr/page.html",
        resolve=_resolve_none, store_blob=_store, run_parse=_make_parse([]),
        record_note=record,
    )
    assert outcome == "skipped"
    assert len(notes) == 1
    assert note in notes[0][1]


async def test_ingest_url_records_unexpected_error() -> None:
    notes, record = _notes_sink()

    def _boom_store(*_a, **_kw):
        raise RuntimeError("storage down")

    outcome, note = await gfw.ingest_one_url(
        _Conn(), _row(), "https://inha.ac.kr/guide.pdf",
        resolve=_resolve_ok, store_blob=_boom_store, run_parse=_make_parse([]),
        record_note=record,
    )
    assert outcome == "error"
    assert "storage down" in note
    assert len(notes) == 1 and "unexpected error" in notes[0][1]


# --------------------------------------------------------------------------- #
# Gate 0 fail-closed outcomes (correction plan, Phase 1c)
# --------------------------------------------------------------------------- #


def _notes_sink():
    notes: list[tuple[str, str]] = []

    async def record(_conn, url: str, _title, note: str, **_kw) -> None:
        notes.append((url, note))

    return notes, record


async def test_record_proposed_note_passes_through_source_type_and_proposed_by() -> None:
    calls: list[tuple] = []

    class _SpyConn:
        async def execute(self, sql: str, *args: object) -> str:
            calls.append((" ".join(sql.split()), args))
            return "OK"

    await gfw.record_proposed_note(
        _SpyConn(), "https://inha.ac.kr/blocked", "인하대학교",
        "인하대학교: PDF fetch failed — HTTP 503",
        source_type="university_admission_board", proposed_by="manual",
    )
    assert len(calls) == 1
    sql, args = calls[0]
    assert "insert into public.proposed_sources" in sql
    assert "proposed_at = now()" in sql  # repeat occurrences stay near the front
    assert args == (
        "https://inha.ac.kr/blocked", "인하대학교",
        "인하대학교: PDF fetch failed — HTTP 503",
        "university_admission_board", "manual",
    )


async def test_stale_cycle_records_not_yet_published_and_does_not_ingest() -> None:
    conn = _Conn()
    parsed: list = []
    notes, record = _notes_sink()

    async def resolve(u: str):
        return PDF, "application/pdf"

    async def parse(c, gd, d):  # pragma: no cover - must never run
        parsed.append(gd)

    outcome, note, _seen = await gfw.process_one_institution(
        conn, _row(), keywords=["모집요강"], year=2027, per_institution=3,
        search_site=_search_returning(_ann("https://inha.ac.kr/2026_모집요강.pdf", "2026 모집요강")),
        resolve=resolve, store_blob=_store, run_parse=parse,
        identity_check=lambda d, r: gfw.IdentityDecision(
            decision="stale", note="newest guideline is 2026 fall (target 2027 spring)",
        ),
        record_note=record,
    )
    assert outcome == "skipped"
    assert "not yet published" in note
    assert parsed == []
    assert not any("insert into public.guideline_documents" in e for e in conn.executed)
    assert len(notes) == 1 and "not yet published" in notes[0][1]


async def test_identity_error_fails_closed_and_records_note() -> None:
    conn = _Conn()
    parsed: list = []
    notes, record = _notes_sink()

    async def resolve(u: str):
        return PDF, "application/pdf"

    async def parse(c, gd, d):  # pragma: no cover - must never run
        parsed.append(gd)

    outcome, note, _seen = await gfw.process_one_institution(
        conn, _row(), keywords=["모집요강"], year=2027, per_institution=3,
        search_site=_search_returning(_ann("https://inha.ac.kr/2027_모집요강.pdf", "2027 모집요강")),
        resolve=resolve, store_blob=_store, run_parse=parse,
        identity_check=lambda d, r: gfw.IdentityDecision(
            decision="error", note="identity verifier errored: RuntimeError",
        ),
        record_note=record,
    )
    assert outcome == "skipped"
    assert parsed == []                                # fail closed: no ingest
    assert len(notes) == 1 and "fail-closed" in notes[0][1]


async def test_unreadable_head_fails_closed() -> None:
    conn = _Conn()
    notes, record = _notes_sink()

    async def resolve(u: str):
        return PDF, "application/pdf"

    async def parse(c, gd, d):  # pragma: no cover - must never run
        raise AssertionError("must not parse")

    outcome, _note, _seen = await gfw.process_one_institution(
        conn, _row(), keywords=["모집요강"], year=2027, per_institution=3,
        search_site=_search_returning(_ann("https://inha.ac.kr/scan.pdf", "모집요강")),
        resolve=resolve, store_blob=_store, run_parse=parse,
        identity_check=lambda d, r: gfw.IdentityDecision(
            decision="unreadable", note="no readable text in the first pages",
        ),
        record_note=record,
    )
    assert outcome == "skipped"
    assert len(notes) == 1


async def test_accept_with_verdict_threads_cycle_into_insert() -> None:
    from uni_db.verify.models import IdentityVerdict

    class _CycleConn(_Conn):
        def __init__(self):
            super().__init__()
            self.insert_args: tuple | None = None

        async def execute(self, sql: str, *args: object) -> str:
            s = " ".join(sql.split())
            if "insert into public.guideline_documents" in s:
                self.insert_args = args
                assert "academic_year" in s and "semester" in s
            self.executed.append(s)
            return "OK"

    verdict = IdentityVerdict(
        document_kind="guideline", university_name_ko_in_doc="인하대학교",
        matches_target_university=True, academic_year_in_doc=2027,
        term_in_doc="spring", matches_target_cycle=True, audience="foreign",
        serves_foreign_applicants=True, is_old_or_superseded=False, confidence=0.9,
    )
    conn = _CycleConn()

    async def resolve(u: str):
        return PDF, "application/pdf"

    async def parse(c, gd, d):
        return None

    outcome, _note, _seen = await gfw.process_one_institution(
        conn, _row(), keywords=["모집요강"], year=2027, per_institution=3,
        search_site=_search_returning(_ann("https://inha.ac.kr/2027_모집요강.pdf", "2027 모집요강")),
        resolve=resolve, store_blob=_store, run_parse=parse,
        identity_check=lambda d, r: gfw.IdentityDecision(
            decision="accept", note="accepted", verdict=verdict,
        ),
    )
    assert outcome == "ingested"
    assert conn.insert_args is not None
    assert 2027 in conn.insert_args and "spring" in conn.insert_args


async def test_ingest_one_url_stale_records_and_skips() -> None:
    notes, record = _notes_sink()
    outcome, note = await gfw.ingest_one_url(
        _Conn(), _row(), "https://inha.ac.kr/old.pdf",
        resolve=_resolve_ok, store_blob=_store, run_parse=_make_parse([]),
        identity_check=lambda d, r: gfw.IdentityDecision(decision="stale", note="2026 doc"),
        record_note=record,
    )
    assert outcome == "skipped"
    assert note == "2026 doc"
    assert len(notes) == 1
