"""Tests for the notice-board selector-probe analysis core (scripts/probe_site.py).

Only `analyze_html` / `render_report` are tested — the Playwright render step
needs a browser + network and runs on the GitHub probe workflow.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))

import probe_site

_EGOV_TABLE = """
<table class="board_list"><tbody>
  <tr><td>1</td>
      <td class="subject"><a href="/kor/bbs/view.do?nttId=101">2027 외국인 신입학 모집요강 안내</a></td>
      <td class="date">2026.05.01</td></tr>
  <tr><td>2</td>
      <td class="subject"><a href="/kor/bbs/view.do?nttId=102">제출 서류 안내문</a></td>
      <td class="date">2026.04.20</td></tr>
  <tr><td>3</td>
      <td class="subject"><a href="/kor/bbs/view.do?nttId=103">전형 일정 변경 공지</a></td>
      <td class="date">2026.04.10</td></tr>
</tbody></table>
"""

_UL_BOARD = """
<ul class="list">
  <li><a href="javascript:" onclick="view_open('55012');"><p class="bbsTitle">외국인전형 모집요강</p>
      <span class="date">2026.03.04</span></a></li>
  <li><a href="javascript:" onclick="view_open('55013');"><p class="bbsTitle">합격자 발표 안내</p>
      <span class="date">2026.03.01</span></a></li>
  <li><a href="javascript:" onclick="view_open('55014');"><p class="bbsTitle">등록 안내</p>
      <span class="date">2026.02.20</span></a></li>
</ul>
"""


class TestAnalyzeHtml:
    def test_finds_egov_table(self) -> None:
        cands = probe_site.analyze_html(_EGOV_TABLE)
        assert cands, "expected at least one candidate"
        best = cands[0]
        assert best.good_rows == 3
        assert "tr" in best.selector
        assert any("모집요강" in s["title"] for s in best.samples)
        assert "nttId" in best.id_source
        assert best.samples[0]["date"] == "2026.05.01"

    def test_finds_ul_board_with_onclick_id(self) -> None:
        cands = probe_site.analyze_html(_UL_BOARD)
        assert cands
        best = cands[0]
        assert "li" in best.selector
        assert best.good_rows == 3
        # onclick view_open('55012') → an onclick-style id regex
        assert "(" in best.id_source

    def test_no_list_returns_empty(self) -> None:
        assert probe_site.analyze_html("<html><body><p>nothing</p></body></html>") == []

    def test_ignores_rows_without_date(self) -> None:
        html = '<table><tbody><tr><td><a href="/x?nttId=1">a title here</a></td></tr></tbody></table>'
        assert probe_site.analyze_html(html) == []


class TestRenderReport:
    def test_report_has_selectors_snippet(self) -> None:
        report = probe_site.render_report(probe_site.analyze_html(_EGOV_TABLE))
        assert "HtmlListSelectors(" in report
        assert "row=" in report

    def test_empty_report_is_friendly(self) -> None:
        report = probe_site.render_report([])
        assert "NO USABLE LIST FOUND" in report
