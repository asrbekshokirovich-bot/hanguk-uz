"""direct_ingest_worker pulls guides from auto-discovered sources.

Heavy steps (HTTP, storage, parse, the generic resolver) are injected, so these
cover the worker's own logic: direct-PDF vs page→resolver paths, the skip path,
institution get-or-create, the Korean-name heuristic, and batch error isolation.
"""

from __future__ import annotations

from uuid import uuid4

from uni_db.parse.pdf_resolvers import ResolvedPdf
from uni_db.workers import direct_ingest_worker as diw


class _Resp:
    def __init__(self, content: bytes, ctype: str = "application/pdf") -> None:
        self.content = content
        self.headers = {"content-type": ctype}

    def raise_for_status(self) -> None:
        pass


class _HTTP:
    """Fake httpx client; `handler(url)` returns a _Resp or raises."""

    def __init__(self, handler) -> None:
        self.handler = handler
        self.gets: list[str] = []

    async def get(self, url: str, **_kw: object) -> _Resp:
        self.gets.append(url)
        return self.handler(url)


class _Conn:
    def __init__(self, *, institution_exists: bool = False, sources: list | None = None) -> None:
        self.institution_exists = institution_exists
        self.sources = sources or []
        self.created_institution = False
        self.executed: list[str] = []

    async def fetchrow(self, sql: str, *args: object):
        s = " ".join(sql.split())
        if "from public.institutions" in s:
            return {"id": uuid4()} if self.institution_exists else None
        if "from public.guideline_documents where file_hash_sha256" in s:
            return {"id": uuid4()}
        return None

    async def fetchval(self, sql: str, *args: object):
        if "insert into public.institutions" in " ".join(sql.split()):
            self.created_institution = True
            return uuid4()
        return None

    async def execute(self, sql: str, *args: object) -> str:
        self.executed.append(" ".join(sql.split()))
        return "OK"

    async def fetch(self, sql: str, *args: object) -> list:
        return self.sources


class _Stored:
    storage_path = "guideline-blobs/deadbeef.pdf"


def _store(data: bytes, *, sha256: str, mime: str) -> _Stored:
    return _Stored()


async def _noop_parse(conn: object, gd_id: object, data: bytes) -> None:
    return None


async def _resolve_found(url: str, http: object, referer: str | None) -> ResolvedPdf:
    return ResolvedPdf(url="https://x.inha.ac.kr/real.pdf", filename="g.pdf", headers={})


async def _resolve_none(url: str, http: object, referer: str | None) -> None:
    return None


# --------------------------------------------------------------------------- #


class TestKoreanName:
    def test_extracts_university_name(self) -> None:
        assert diw.korean_name_from_title("인하대학교 입학처 외국인 모집요강") == "인하대학교"

    def test_none_when_no_korean_name(self) -> None:
        assert diw.korean_name_from_title("Foreign Admission Guide") is None
        assert diw.korean_name_from_title(None) is None

    def test_rejects_generic_boilerplate_names(self) -> None:
        # the greedy regex used to grab these from title boilerplate (2026 audit)
        assert diw.korean_name_from_title("2026학년도 일반대학 모집요강") is None
        assert diw.korean_name_from_title("2026학년도대학원 외국인 모집") is None
        # real names sitting next to generic words still resolve
        assert diw.korean_name_from_title("군산대학교 신입학 안내") == "군산대학교"
        assert diw.korean_name_from_title("한양사이버대학교 2026") == "한양사이버대학교"


async def test_institution_created_hidden_when_missing() -> None:
    conn = _Conn(institution_exists=False)
    iid = await diw.get_or_create_institution(
        conn, domain="inha.ac.kr", title="인하대학교 외국인 모집요강"
    )
    assert conn.created_institution is True
    assert iid is not None


async def test_institution_reused_when_present() -> None:
    conn = _Conn(institution_exists=True)
    await diw.get_or_create_institution(conn, domain="inha.ac.kr", title=None)
    assert conn.created_institution is False


async def test_ingests_direct_pdf() -> None:
    conn = _Conn(institution_exists=True)
    http = _HTTP(lambda url: _Resp(b"%PDF-1.4 body"))
    parsed: list = []

    async def parse(c, gd, d):
        parsed.append(gd)

    row = {"id": uuid4(), "url_ko": "https://admission.inha.ac.kr/g.pdf",
           "candidate_title": "인하대학교 외국인 모집요강"}
    ok, _note = await diw.process_one_source(
        conn, http, row, store_blob=_store, run_parse=parse, generic_resolve=_resolve_none,
    )
    assert ok is True
    assert len(http.gets) == 1          # direct download, resolver not needed
    assert len(parsed) == 1


async def test_ingests_html_page_via_generic_resolver() -> None:
    conn = _Conn(institution_exists=True)
    # page first (html → not a direct PDF), then the resolved .pdf
    http = _HTTP(lambda url: _Resp(b"%PDF-1.5") if url.endswith(".pdf")
                 else _Resp(b"<html>board</html>", "text/html"))
    row = {"id": uuid4(), "url_ko": "https://admission.x.ac.kr/board?seq=1",
           "candidate_title": None}
    ok, _note = await diw.process_one_source(
        conn, http, row, store_blob=_store, run_parse=_noop_parse,
        generic_resolve=_resolve_found,
    )
    assert ok is True
    assert len(http.gets) == 2          # page + resolved pdf


async def test_skips_when_page_has_no_pdf() -> None:
    conn = _Conn(institution_exists=True)
    http = _HTTP(lambda url: _Resp(b"<html>no link</html>", "text/html"))
    row = {"id": uuid4(), "url_ko": "https://x.ac.kr/p", "candidate_title": None}
    ok, note = await diw.process_one_source(
        conn, http, row, store_blob=_store, run_parse=_noop_parse,
        generic_resolve=_resolve_none,
    )
    assert ok is False
    assert "no download link" in note or "not a direct PDF" in note


async def test_ingest_pending_isolates_errors() -> None:
    sources = [
        {"id": uuid4(), "url_ko": "https://good.ac.kr/g.pdf", "candidate_title": None},
        {"id": uuid4(), "url_ko": "https://bad.ac.kr/g.pdf", "candidate_title": None},
    ]
    conn = _Conn(institution_exists=True, sources=sources)

    def handler(url: str) -> _Resp:
        if "bad" in url:
            raise RuntimeError("network boom")
        return _Resp(b"%PDF-1.4")

    ok, fail = await diw.ingest_pending(
        conn, _HTTP(handler), limit=10,
        store_blob=_store, run_parse=_noop_parse, generic_resolve=_resolve_none,
    )
    assert (ok, fail) == (1, 1)
