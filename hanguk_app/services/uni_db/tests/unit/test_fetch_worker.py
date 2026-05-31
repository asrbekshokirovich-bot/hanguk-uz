"""Unit tests for the fetch worker (announcement -> guideline_document).

Heavy steps (Supabase Storage, PyMuPDF extract, parse) are injected, so
these run without those deps. HTTP is intercepted by respx.
"""

from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

import httpx
import respx

from uni_db.workers import fetch_worker

_PDF_URL = "https://example.ac.kr/file/g.pdf"


# --- pure helpers ----------------------------------------------------------

class TestPickPdfAttachment:
    def test_prefers_pdf_url(self) -> None:
        atts = [{"url": "https://x/a.hwp"}, {"url": "https://x/b.pdf"}]
        assert fetch_worker.pick_pdf_attachment(atts)["url"].endswith("b.pdf")

    def test_falls_back_to_first(self) -> None:
        atts = [{"url": "https://x/a.zip", "filename": "a.zip"}]
        assert fetch_worker.pick_pdf_attachment(atts)["url"].endswith("a.zip")

    def test_empty_is_none(self) -> None:
        assert fetch_worker.pick_pdf_attachment([]) is None


class TestDecideMime:
    def test_magic_bytes_win(self) -> None:
        assert fetch_worker.decide_mime(b"%PDF-1.7 ...", "text/html") == ("application/pdf", None)

    def test_octet_stream_without_magic_kept(self) -> None:
        mime, err = fetch_worker.decide_mime(b"\x00\x01\x02\x03", "application/octet-stream")
        assert mime == "application/octet-stream" and err is None

    def test_html_rejected(self) -> None:
        mime, err = fetch_worker.decide_mime(b"<html>", "text/html")
        assert mime is None and "non-PDF" in err

    def test_missing_mime_rejected(self) -> None:
        mime, err = fetch_worker.decide_mime(b"abcd", "")
        assert mime is None and err is not None


class TestCandidateHostRegex:
    def test_includes_kaist_and_resolver_hosts(self) -> None:
        rx = fetch_worker.candidate_host_regex()
        # The KAIST resolver (added with the resolver registry change) must be
        # in the fetch filter, not just KU/Yonsei/Inha.
        assert "kaist\\.ac\\.kr" in rx
        assert "korea\\.ac\\.kr" in rx
        assert "yonsei\\.ac\\.kr" in rx
        assert "inha\\.ac\\.kr" in rx


# --- process_one wiring ----------------------------------------------------

class _FakeConn:
    def __init__(self) -> None:
        self.calls: list[tuple[str, tuple]] = []
        self.gd_id = uuid4()

    async def execute(self, sql: str, *args: object) -> str:
        self.calls.append((sql, args))
        return "OK"

    async def fetchrow(self, sql: str, *args: object) -> dict:
        self.calls.append((sql, args))
        return {"id": self.gd_id}


def _row() -> dict:
    return {
        "announcement_id": uuid4(),
        "title_ko": "2027 모집요강",
        "url_ko": "https://example.ac.kr/notice/1",
        "attachments_json": f'[{{"url": "{_PDF_URL}", "filename": "g.pdf"}}]',
        "classifier_label": "admission_announcement",
        "source_id": uuid4(),
        "institution_id": uuid4(),
        "source_url_ko": "https://example.ac.kr/notice",
    }


@respx.mock
async def test_process_one_happy_path() -> None:
    respx.get(_PDF_URL).mock(return_value=httpx.Response(200, content=b"%PDF-1.7\nbody"))
    conn = _FakeConn()
    parsed: list = []

    def fake_store(data: bytes, *, sha256: str, mime: str):
        return SimpleNamespace(storage_path=f"guideline-blobs/{sha256[:8]}.pdf")

    async def fake_parse(c, gd_id, data) -> None:
        parsed.append((gd_id, len(data)))

    async with httpx.AsyncClient() as http:
        ok, note = await fetch_worker.process_one(
            conn, http, _row(), store_blob=fake_store, run_parse=fake_parse,
        )

    assert ok is True
    assert parsed and parsed[0][0] == conn.gd_id           # parse ran on the new gd
    assert any("guideline_documents" in sql for sql, _ in conn.calls)   # gd inserted
    assert any("update public.announcements set guideline_document_id" in sql
               for sql, _ in conn.calls)                    # announcement linked


@respx.mock
async def test_process_one_rejects_non_pdf() -> None:
    respx.get(_PDF_URL).mock(
        return_value=httpx.Response(200, content=b"<html>nope</html>",
                                    headers={"content-type": "text/html"}),
    )
    conn = _FakeConn()
    parsed: list = []

    async def fake_parse(c, gd_id, data) -> None:
        parsed.append(gd_id)

    async with httpx.AsyncClient() as http:
        ok, note = await fetch_worker.process_one(
            conn, http, _row(),
            store_blob=lambda *a, **k: SimpleNamespace(storage_path="x"),
            run_parse=fake_parse,
        )
    assert ok is False
    assert "non-PDF" in note
    assert not parsed                                       # never parsed
    assert not any("guideline_documents" in sql for sql, _ in conn.calls)  # nothing stored


@respx.mock
async def test_process_one_no_attachment_no_resolver() -> None:
    conn = _FakeConn()
    row = _row()
    row["attachments_json"] = "[]"          # no attachment
    row["url_ko"] = "https://unknown-host.example.com/post"  # no resolver
    async with httpx.AsyncClient() as http:
        ok, note = await fetch_worker.process_one(conn, http, row)
    assert ok is False
    assert "no usable attachment" in note
