"""Unit tests for the per-source PDF resolvers.

The resolvers translate an announcement's stored attachment URL (which
for KU is the HTML detail page, not the PDF) into the real download URL
the parse orchestrator can `httpx.get`. These tests run against a real
detail-page HTML fixture captured from `oku.korea.ac.kr` on 2026-05-17.

Network calls are intercepted by ``respx`` — no live HTTP and no live
LLM. The fixtures are checked into the repo so re-runs are stable.
"""

from __future__ import annotations

from pathlib import Path

import httpx
import pytest
import respx

from uni_db.parse.pdf_resolvers import (
    ResolvedPdf,
    get_resolver_for_url,
    resolve_pdf,
)
from uni_db.parse.pdf_resolvers import generic_attachment as generic
from uni_db.parse.pdf_resolvers import kaist as kaist_resolver
from uni_db.parse.pdf_resolvers import korea_univ as ku_resolver
from uni_db.parse.pdf_resolvers import yonsei as yonsei_resolver


class TestGenericAttachmentLinkDetection:
    """Phase 3: Korean boards link the guide as text '…모집요강' (no .pdf) or as
    .hwp — broadened detection must catch those, not just literal .pdf."""

    def test_direct_pdf_href(self) -> None:
        out = generic._extract_pdf_link(
            '<a href="/files/2026_guide.pdf">2026 모집요강</a>', "https://x.ac.kr/n/1")
        assert out is not None and out[0].endswith("/files/2026_guide.pdf")

    def test_download_endpoint_with_korean_guide_text_no_pdf(self) -> None:
        # the common case the old resolver MISSED
        out = generic._extract_pdf_link(
            '<a href="/board/fileDown.do?fileId=abc">2026학년도 외국인전형 모집요강</a>',
            "https://x.ac.kr/n/1")
        assert out is not None and "fileDown.do" in out[0]

    def test_prefers_pdf_over_hwp(self) -> None:
        out = generic._extract_pdf_link(
            '<a href="/d/guide.hwp">모집요강 서식</a><a href="/d/guide.pdf">모집요강</a>',
            "https://x.ac.kr/")
        assert out is not None and out[0].endswith("guide.pdf")

    def test_accepts_hwp_when_only_option(self) -> None:
        out = generic._extract_pdf_link(
            '<a href="/d/2026_foreign_moejip.hwp">붙임. 모집요강</a>', "https://x.ac.kr/")
        assert out is not None and out[0].endswith(".hwp")

    def test_ignores_navigation_and_js(self) -> None:
        html = ('<a href="#">top</a><a href="javascript:void(0)">x</a>'
                '<a href="/about">학교소개</a>')
        assert generic._extract_pdf_link(html, "https://x.ac.kr/") is None

    def test_plain_attachment_without_guide_signal_ignored(self) -> None:
        # download link with no guideline keyword and no file ext → skip (avoid
        # grabbing unrelated forms); reviewer-found misses are acceptable
        assert generic._extract_pdf_link(
            '<a href="/board/fileDown.do?id=1">첨부파일</a>', "https://x.ac.kr/") is None

    def test_prefers_newest_cycle_year(self) -> None:
        # A board listing two cycles side by side must yield the newest one, so
        # ingest stops grabbing last year's 모집요강. Years are relative to today
        # so the test stays evergreen.
        from datetime import date

        cy = date.today().year
        html = (f'<a href="/files/{cy - 1}_guide.pdf">{cy - 1}학년도 모집요강</a>'
                f'<a href="/files/{cy}_guide.pdf">{cy}학년도 모집요강</a>')
        out = generic._extract_pdf_link(html, "https://x.ac.kr/")
        assert out is not None and out[0].endswith(f"/files/{cy}_guide.pdf")

FIXTURES = Path(__file__).resolve().parent.parent / "fixtures"

KU_DETAIL_URL = (
    "https://oku.korea.ac.kr/oku/cms/FR_BBS_CON/BoardView.do"
    "?MENU_ID=1700&BBS_SEQ=1791&SITE_NO=2&BOARD_SEQ=5"
)

YONSEI_DETAIL_URL = (
    "https://admission.yonsei.ac.kr/seoul/admission/html/international/"
    "noticeView.asp?BBS_NO=3417"
)

KAIST_DETAIL_URL = (
    "https://admission.kaist.ac.kr/intl-undergraduate/notice/?bbs_id=42"
)


def _load_fixture_bytes(name: str) -> bytes:
    path = FIXTURES / name
    if not path.exists():
        pytest.skip(f"fixture missing: {path}")
    return path.read_bytes()


# ---------------------------------------------------------------------------
# Registry / dispatch
# ---------------------------------------------------------------------------


class TestRegistryDispatch:
    def test_get_resolver_picks_korea_univ_by_host(self) -> None:
        assert get_resolver_for_url(KU_DETAIL_URL) is ku_resolver.resolve

    def test_unknown_host_returns_none(self) -> None:
        assert get_resolver_for_url("https://example.com/some/page") is None

    def test_get_resolver_is_case_insensitive_on_host(self) -> None:
        upper_host = KU_DETAIL_URL.replace("oku.korea.ac.kr", "OKU.KOREA.AC.KR")
        assert get_resolver_for_url(upper_host) is ku_resolver.resolve

    def test_get_resolver_picks_yonsei_by_host(self) -> None:
        assert get_resolver_for_url(YONSEI_DETAIL_URL) is yonsei_resolver.resolve

    def test_get_resolver_picks_kaist_by_host(self) -> None:
        assert get_resolver_for_url(KAIST_DETAIL_URL) is kaist_resolver.resolve


# ---------------------------------------------------------------------------
# Korea University resolver
# ---------------------------------------------------------------------------


class TestKoreaUnivResolver:
    @pytest.fixture
    def detail_html(self) -> bytes:
        return _load_fixture_bytes("korea_univ_detail.html")

    @respx.mock
    async def test_happy_path_resolves_real_pdf_link(self, detail_html: bytes) -> None:
        respx.get(KU_DETAIL_URL).mock(
            return_value=httpx.Response(200, content=detail_html),
        )
        async with httpx.AsyncClient() as client:
            resolved = await ku_resolver.resolve(KU_DETAIL_URL, client, None)

        assert resolved is not None
        assert isinstance(resolved, ResolvedPdf)
        # The fixture's only fileDown anchor is BBS_SEQ=1791, FILE_SEQ=2
        # rendered as "2028학년도_고려대(서울)_입학전형시행계획(2026.04.).pdf".
        assert resolved.url == (
            "https://oku.korea.ac.kr/ajaxfile/FR_SVC/FileDown.do"
            "?GBN=X01&BOARD_SEQ=5&SITE_NO=2&BBS_SEQ=1791&FILE_SEQ=2"
        )
        assert resolved.filename.endswith(".pdf")
        assert "입학전형" in resolved.filename
        # Referer header must point at the detail page so the OKU
        # anti-leech check passes.
        assert resolved.headers.get("Referer") == KU_DETAIL_URL

    @respx.mock
    async def test_returns_none_when_html_has_no_filedown_anchor(self) -> None:
        no_file_html = (
            b"<html><body><a href='#;'>no download here</a></body></html>"
        )
        respx.get(KU_DETAIL_URL).mock(
            return_value=httpx.Response(200, content=no_file_html),
        )
        async with httpx.AsyncClient() as client:
            resolved = await ku_resolver.resolve(KU_DETAIL_URL, client, None)
        assert resolved is None

    @respx.mock
    async def test_returns_none_on_http_error(self) -> None:
        respx.get(KU_DETAIL_URL).mock(return_value=httpx.Response(500))
        async with httpx.AsyncClient() as client:
            resolved = await ku_resolver.resolve(KU_DETAIL_URL, client, None)
        assert resolved is None

    @respx.mock
    async def test_top_level_dispatcher_routes_to_ku(self, detail_html: bytes) -> None:
        respx.get(KU_DETAIL_URL).mock(
            return_value=httpx.Response(200, content=detail_html),
        )
        async with httpx.AsyncClient() as client:
            resolved = await resolve_pdf(KU_DETAIL_URL, http_client=client)
        assert resolved is not None
        assert "FileDown.do" in resolved.url
        assert "GBN=X01" in resolved.url


# ---------------------------------------------------------------------------
# Yonsei resolver
# ---------------------------------------------------------------------------


class TestYonseiResolver:
    @pytest.fixture
    def detail_html(self) -> bytes:
        return _load_fixture_bytes("yonsei_detail.html")

    @respx.mock
    async def test_happy_path_resolves_download_asp_url(
        self, detail_html: bytes
    ) -> None:
        # Yonsei's detail pages declare ``text/html; Charset=euc-kr``.
        # Mirror that in the mocked response so the resolver decodes the
        # body exactly as it would live.
        respx.get(YONSEI_DETAIL_URL).mock(
            return_value=httpx.Response(
                200,
                content=detail_html,
                headers={"content-type": "text/html; charset=euc-kr"},
            ),
        )
        async with httpx.AsyncClient() as client:
            resolved = await yonsei_resolver.resolve(
                YONSEI_DETAIL_URL, client, None
            )

        assert resolved is not None
        assert isinstance(resolved, ResolvedPdf)
        # The per-notice attachment on the fixture is a /download.asp URL
        # carrying the EUC-KR url-encoded filename. The resolver must
        # prefer it over the boilerplate www2.yonsei.ac.kr year-plan PDF.
        assert "/seoul/download.asp" in resolved.url
        assert "furl=bbs/" in resolved.url
        # The Referer header must point at the detail page so the
        # anti-leech check passes on the actual download GET.
        assert resolved.headers.get("Referer") == YONSEI_DETAIL_URL

    @respx.mock
    async def test_falls_back_to_year_plan_when_no_per_notice_attachment(
        self,
    ) -> None:
        boilerplate_only = (
            b'<html><body>'
            b'<a href="https://www2.yonsei.ac.kr/entrance/plan/2028_plan.pdf">'
            b'2028 plan</a>'
            b'</body></html>'
        )
        respx.get(YONSEI_DETAIL_URL).mock(
            return_value=httpx.Response(200, content=boilerplate_only),
        )
        async with httpx.AsyncClient() as client:
            resolved = await yonsei_resolver.resolve(
                YONSEI_DETAIL_URL, client, None
            )
        assert resolved is not None
        assert resolved.url.endswith("/2028_plan.pdf")

    @respx.mock
    async def test_returns_none_when_no_pdf_anchor(self) -> None:
        no_pdf_html = b"<html><body><p>text-only notice</p></body></html>"
        respx.get(YONSEI_DETAIL_URL).mock(
            return_value=httpx.Response(200, content=no_pdf_html),
        )
        async with httpx.AsyncClient() as client:
            resolved = await yonsei_resolver.resolve(
                YONSEI_DETAIL_URL, client, None
            )
        assert resolved is None

    @respx.mock
    async def test_returns_none_on_http_error(self) -> None:
        respx.get(YONSEI_DETAIL_URL).mock(return_value=httpx.Response(500))
        async with httpx.AsyncClient() as client:
            resolved = await yonsei_resolver.resolve(
                YONSEI_DETAIL_URL, client, None
            )
        assert resolved is None

    async def test_rejects_non_detail_urls(self) -> None:
        # The list page itself must NOT be resolved — guards against
        # accidental loops if a future change passes a list URL through.
        list_url = (
            "https://admission.yonsei.ac.kr/seoul/admission/html/"
            "international/notice.asp"
        )
        async with httpx.AsyncClient() as client:
            resolved = await yonsei_resolver.resolve(list_url, client, None)
        assert resolved is None


# ---------------------------------------------------------------------------
# KAIST resolver
# ---------------------------------------------------------------------------


class TestKaistResolver:
    @pytest.fixture
    def detail_html(self) -> bytes:
        return _load_fixture_bytes("kaist_detail.html")

    @respx.mock
    async def test_prefers_guide_pdf_over_other_attachments(self, detail_html: bytes) -> None:
        respx.get(KAIST_DETAIL_URL).mock(
            return_value=httpx.Response(200, content=detail_html),
        )
        async with httpx.AsyncClient() as client:
            resolved = await kaist_resolver.resolve(KAIST_DETAIL_URL, client, None)

        assert resolved is not None
        assert isinstance(resolved, ResolvedPdf)
        # The "Admissions Guide..." attachment beats campus_map.pdf and the
        # checklist on guide-keyword score, and the relative href is made
        # absolute against the detail host.
        assert resolved.url.startswith("https://admission.kaist.ac.kr/")
        assert resolved.url.endswith("Admissions Guide for 2027 admission.pdf")
        assert "Admissions Guide" in resolved.filename
        assert resolved.headers.get("Referer") == KAIST_DETAIL_URL

    @respx.mock
    async def test_returns_none_when_no_pdf(self) -> None:
        html = b"<html><body><a href='/intl-undergraduate/notice'>back</a></body></html>"
        respx.get(KAIST_DETAIL_URL).mock(return_value=httpx.Response(200, content=html))
        async with httpx.AsyncClient() as client:
            resolved = await kaist_resolver.resolve(KAIST_DETAIL_URL, client, None)
        assert resolved is None

    @respx.mock
    async def test_returns_none_on_http_error(self) -> None:
        respx.get(KAIST_DETAIL_URL).mock(return_value=httpx.Response(404))
        async with httpx.AsyncClient() as client:
            resolved = await kaist_resolver.resolve(KAIST_DETAIL_URL, client, None)
        assert resolved is None

    @respx.mock
    async def test_top_level_dispatcher_routes_to_kaist(self, detail_html: bytes) -> None:
        respx.get(KAIST_DETAIL_URL).mock(
            return_value=httpx.Response(200, content=detail_html),
        )
        async with httpx.AsyncClient() as client:
            resolved = await resolve_pdf(KAIST_DETAIL_URL, http_client=client)
        assert resolved is not None
        assert resolved.url.endswith(".pdf")


# ---------------------------------------------------------------------------
# Phase 4 per-site board resolvers (daedong / dongguk WISE / ikw / sangji /
# mokwon). Markup snippets mirror the live boards captured 2026-07.
# ---------------------------------------------------------------------------


DAEDONG_DETAIL_URL = (
    "https://www.daedong.ac.kr/ipsi/CMS/Board/Board.do"
    "?mCode=MN086&mode=view&board_seq=51521"
)
DONGGUK_DETAIL_URL = "https://ipsi.dongguk.ac.kr/article/notice/detail/341"
IKW_FILE_URL = "https://www.ikw.ac.kr/jfile/readFile.tc?fileId=JF00000076991&fileSeq=1"
SANGJI_DETAIL_URL = "https://www.sangji.ac.kr/ipsi/board/view.do?seq=100"
MOKWON_DETAIL_URL = "https://enter.mokwon.ac.kr/board/notice/view?id=77"

DAEDONG_HTML = """
<ul class="fileList">
  <li><a href="/ipsi/ajx_json/UploadMgr/downloadRun.do?qcode=Qm9hcmQsMzc1MTAsWQ==" title="내려받기">
    <span>사실증명 발급 열람 신청 위임장(부모 및 학생용).hwp (30KB)</span></a></li>
  <li><a href="/ipsi/ajx_json/UploadMgr/downloadRun.do?qcode=Qm9hcmQsMzc1MTEsWQ==" title="내려받기">
    <span>2027학년도 외국인 특별전형 모집요강.hwp (2MB)</span></a></li>
</ul>
"""

DONGGUK_HTML = """
<ul><li class='files1' data-name="file">
  <a href="/cmmn/fileDown.do?fileSeq=151">
    2027 재외국민 및 외국인 특별전형 모집요강.hwp</a></li></ul>
"""

SANGJI_HTML = """
<div class="file"><a href="/cmm/fms/FileDown.do?atchFileId=FILE_000000076838Mf1&fileSn=0">
  2027학년도 외국인전형 모집요강.hwp</a></div>
"""

MOKWON_HTML = """
<a href="/_prog/download/?file_id=kv11sdl3yh63j1gu9wq05d7fh90oja">
  2027학년도 목원대학교 외국인 특별전형 모집요강.hwp</a>
"""


class TestPhase4SiteResolvers:
    def test_registry_routes_all_five_hosts(self) -> None:
        assert get_resolver_for_url(DAEDONG_DETAIL_URL) is generic.resolve_daedong
        assert get_resolver_for_url(DONGGUK_DETAIL_URL) is generic.resolve_dongguk_wise
        assert get_resolver_for_url(IKW_FILE_URL) is generic.resolve_ikw
        assert get_resolver_for_url(SANGJI_DETAIL_URL) is generic.resolve_sangji
        assert get_resolver_for_url(MOKWON_DETAIL_URL) is generic.resolve_mokwon

    @respx.mock
    async def test_daedong_prefers_the_guideline_attachment(self) -> None:
        respx.get(DAEDONG_DETAIL_URL).mock(
            return_value=httpx.Response(200, content=DAEDONG_HTML.encode()),
        )
        async with httpx.AsyncClient() as client:
            resolved = await generic.resolve_daedong(DAEDONG_DETAIL_URL, client, None)
        assert resolved is not None
        # The 모집요강 anchor must beat the unrelated 위임장 form.
        assert "qcode=Qm9hcmQsMzc1MTEsWQ==" in resolved.url
        assert "모집요강" in resolved.filename
        assert resolved.headers.get("Referer") == DAEDONG_DETAIL_URL

    @respx.mock
    async def test_dongguk_wise_finds_filedown_endpoint(self) -> None:
        respx.get(DONGGUK_DETAIL_URL).mock(
            return_value=httpx.Response(200, content=DONGGUK_HTML.encode()),
        )
        async with httpx.AsyncClient() as client:
            resolved = await generic.resolve_dongguk_wise(DONGGUK_DETAIL_URL, client, None)
        assert resolved is not None
        assert resolved.url == "https://ipsi.dongguk.ac.kr/cmmn/fileDown.do?fileSeq=151"

    async def test_ikw_hands_back_a_direct_file_endpoint_with_referer(self) -> None:
        # The recorded URL is already the jfile endpoint; the resolver returns
        # it with a Referer (referer-less requests get an HTML alert page).
        async with httpx.AsyncClient() as client:
            resolved = await generic.resolve_ikw(IKW_FILE_URL, client, None)
        assert resolved is not None
        assert resolved.url == IKW_FILE_URL
        assert resolved.headers.get("Referer")

    @respx.mock
    async def test_sangji_finds_fms_filedown(self) -> None:
        respx.get(SANGJI_DETAIL_URL).mock(
            return_value=httpx.Response(200, content=SANGJI_HTML.encode()),
        )
        async with httpx.AsyncClient() as client:
            resolved = await generic.resolve_sangji(SANGJI_DETAIL_URL, client, None)
        assert resolved is not None
        assert "/cmm/fms/FileDown.do?atchFileId=" in resolved.url

    @respx.mock
    async def test_mokwon_finds_prog_download(self) -> None:
        respx.get(MOKWON_DETAIL_URL).mock(
            return_value=httpx.Response(200, content=MOKWON_HTML.encode()),
        )
        async with httpx.AsyncClient() as client:
            resolved = await generic.resolve_mokwon(MOKWON_DETAIL_URL, client, None)
        assert resolved is not None
        assert "/_prog/download/?file_id=" in resolved.url
        assert "모집요강" in resolved.filename

    @respx.mock
    async def test_site_resolver_falls_back_to_generic_extraction(self) -> None:
        # Board layout changed (no known endpoint) but a plain PDF anchor
        # exists → generic heuristics still find it.
        html = b'<a href="/files/2027_guide.pdf">2027 \xeb\xaa\xa8\xec\xa7\x91\xec\x9a\x94\xea\xb0\x95</a>'
        respx.get(DAEDONG_DETAIL_URL).mock(
            return_value=httpx.Response(200, content=html),
        )
        async with httpx.AsyncClient() as client:
            resolved = await generic.resolve_daedong(DAEDONG_DETAIL_URL, client, None)
        assert resolved is not None
        assert resolved.url.endswith("/files/2027_guide.pdf")

    @respx.mock
    async def test_site_resolver_returns_none_when_nothing_found(self) -> None:
        respx.get(DAEDONG_DETAIL_URL).mock(
            return_value=httpx.Response(200, content=b"<p>no attachments</p>"),
        )
        async with httpx.AsyncClient() as client:
            resolved = await generic.resolve_daedong(DAEDONG_DETAIL_URL, client, None)
        assert resolved is None

    @respx.mock
    async def test_site_resolver_returns_none_on_http_error(self) -> None:
        respx.get(SANGJI_DETAIL_URL).mock(return_value=httpx.Response(500))
        async with httpx.AsyncClient() as client:
            resolved = await generic.resolve_sangji(SANGJI_DETAIL_URL, client, None)
        assert resolved is None


# ---------------------------------------------------------------------------
# ResolvedPdf shape
# ---------------------------------------------------------------------------


class TestResolvedPdfShape:
    def test_resolved_pdf_is_frozen_dataclass(self) -> None:
        resolved = ResolvedPdf(url="https://x/y.pdf", filename="y.pdf")
        with pytest.raises((AttributeError, Exception)):
            resolved.url = "tampered"  # type: ignore[misc]

    def test_resolved_pdf_default_headers_is_empty(self) -> None:
        resolved = ResolvedPdf(url="https://x/y.pdf", filename="y.pdf")
        assert dict(resolved.headers) == {}

    async def test_resolve_pdf_unknown_host_returns_none(self) -> None:
        # An unregistered host must short-circuit to None *without*
        # touching the supplied client. We pass a real client (and close
        # it) so the test stays warning-free under pytest's
        # filterwarnings=error setting.
        async with httpx.AsyncClient() as client:
            resolved = await resolve_pdf(
                "https://no-such-host.example.com/page",
                http_client=client,
            )
        assert resolved is None
