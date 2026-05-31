"""Chung-Ang University (중앙대) — 외국인입학 공지 (oia.cau.ac.kr bbs).

Source (verified via browser probe 2026-05-24): a static gnuboard-style
board at `oia.cau.ac.kr/bbs/board.php?tbl=bbs61`. Rows live under a
`div.cobody` table; the title link is a plain GET to `...&mode=VIEW&num=<id>`,
so the announcement url_ko IS the detail page and the generic_attachment
resolver fetches its `download.php?...` PDF link.

Row (probe):
    <tr><td class="responsive03">
      <a href="/bbs/board.php?tbl=bbs61&mode=VIEW&num=287&...">title</a>
      <p class="tablet_regist_date">2026-05-15</p>
    </td>...</tr>
"""

from __future__ import annotations

from ..html_list_adapter import HtmlListSelectors

CAU_SELECTORS = HtmlListSelectors(
    row="div.cobody table tbody tr",
    title="td.responsive03 a",
    link='td.responsive03 a[href*="mode=VIEW"]',
    posted_at="td.responsive03 p.tablet_regist_date",
    posted_at_regex=r"(\d{4}-\d{2}-\d{2})",
    posted_at_format="%Y-%m-%d",
    external_id_regex=r"num=([0-9]+)",
)
