"""Onboarding batch 1 — Chung-Ang (CAU) + Kookmin adapters & resolver wiring.

Fixture-driven (no network): the list HTML mirrors the structures captured by
the browser probe (2026-05-24). Verifies the selectors discover posts with the
right detail url_ko + external_post_id, that the generic resolver finds the
download link on a detail page, and that the hosts are registered.
"""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from uni_db.discovery.adapters.configs import CAU_SELECTORS, KOOKMIN_SELECTORS
from uni_db.discovery.adapters.html_list_adapter import HtmlListAdapter
from uni_db.parse.pdf_resolvers import generic_attachment, get_resolver_for_url

_SINCE = datetime(2020, 1, 1, tzinfo=timezone.utc)

_CAU_LIST = """
<div class="cobody"><table><tbody>
  <tr><td class="responsive03">
    <a href="/bbs/board.php?tbl=bbs61&mode=VIEW&num=287&page=1">Admission Result for Fall 2026</a>
    <p class="tablet_regist_date">2026-05-15</p></td></tr>
  <tr><td class="responsive03">
    <a href="/bbs/board.php?tbl=bbs61&mode=VIEW&num=280&page=1">2026 후반기 순수외국인전형 모집요강</a>
    <p class="tablet_regist_date">2026-03-10</p></td></tr>
</tbody></table></div>
"""

_KOOKMIN_LIST = """
<table class="notice_table"><tbody>
  <tr><td class="ta_l">
    <a href="?ctype=view&s_key=&s_word=&page=&no=1064">2028학년도 국민대학교 대학입학전형계획</a>
    <span class="date">작성일 : 2026-04-30</span></td></tr>
  <tr><td class="ta_l">
    <a href="?ctype=view&no=1062">2026 외국인 모집요강 안내</a>
    <span class="date">작성일 : 2026-03-31</span></td></tr>
</tbody></table>
"""


async def _run(selectors, source_url, html, tmp_path):
    fixture = tmp_path / "list.html"
    fixture.write_text(html, encoding="utf-8")
    adapter = HtmlListAdapter(
        source_id=uuid4(), source_url_ko=source_url,
        selectors=selectors, fixture_path=fixture,
    )
    return await adapter.list_recent_posts(_SINCE)


class TestCauAdapter:
    async def test_discovers_posts(self, tmp_path) -> None:
        posts = await _run(CAU_SELECTORS, "https://oia.cau.ac.kr/bbs/board.php?tbl=bbs61",
                           _CAU_LIST, tmp_path)
        assert len(posts) == 2
        ids = {p.external_post_id for p in posts}
        assert ids == {"287", "280"}
        assert all("mode=VIEW" in p.url_ko for p in posts)
        assert any("모집요강" in p.title_ko for p in posts)


class TestKookminAdapter:
    async def test_discovers_posts(self, tmp_path) -> None:
        posts = await _run(KOOKMIN_SELECTORS, "https://admission.kookmin.ac.kr/foreigner/notice.php",
                           _KOOKMIN_LIST, tmp_path)
        assert len(posts) == 2
        ids = {p.external_post_id for p in posts}
        assert ids == {"1064", "1062"}
        assert all("ctype=view" in p.url_ko for p in posts)


class TestGenericResolver:
    def test_finds_cau_download_link(self) -> None:
        html = ('<a href="/bbs/download.php?tbl=bbs61&no=5230">'
                '2026 순수외국인전형 합격자 유의사항_KOR.pdf</a>')
        found = generic_attachment._extract_pdf_link(html, "https://oia.cau.ac.kr/bbs/board.php?num=287")
        assert found is not None
        url, name = found
        assert url == "https://oia.cau.ac.kr/bbs/download.php?tbl=bbs61&no=5230"
        assert name.endswith(".pdf")

    def test_finds_kookmin_download_link(self) -> None:
        html = ('<a href="/common/file_download.php?id=notice&no=2170">'
                '전형계획_주요사항.pdf (2.32Mb)</a>')
        found = generic_attachment._extract_pdf_link(html, "https://admission.kookmin.ac.kr/foreigner/notice.php?no=1064")
        assert found is not None
        assert "file_download.php" in found[0]

    def test_no_link_returns_none(self) -> None:
        assert generic_attachment._extract_pdf_link("<a href='/about'>info</a>", "https://x/y") is None


class TestRegistryWiring:
    def test_cau_host_uses_generic_resolver(self) -> None:
        assert get_resolver_for_url("https://oia.cau.ac.kr/bbs/board.php?tbl=bbs61&mode=VIEW&num=287") \
            is generic_attachment.resolve

    def test_kookmin_host_uses_generic_resolver(self) -> None:
        assert get_resolver_for_url("https://admission.kookmin.ac.kr/foreigner/notice.php?ctype=view&no=1064") \
            is generic_attachment.resolve
