"""Kookmin University (국민대) — 재외국민/외국인 notice board.

Source (verified via browser probe 2026-05-24): a static board at
`admission.kookmin.ac.kr/foreigner/notice.php`. The title link is a relative
GET (`?ctype=view&...&no=<id>`), absolutized against the board URL, so the
announcement url_ko IS the detail page; the generic_attachment resolver
fetches its `/common/file_download.php?...` PDF link.

Row (probe):
    <tr><td class="ta_l">
      <a href="?ctype=view&s_key=&s_word=&page=&no=1064">title</a>
      <span class="date">작성일 : 2026-04-30</span>
    </td>...</tr>
"""

from __future__ import annotations

from ..html_list_adapter import HtmlListSelectors

KOOKMIN_SELECTORS = HtmlListSelectors(
    row="table.notice_table tbody tr",
    title="td.ta_l a",
    link='td.ta_l a[href*="ctype=view"]',
    posted_at="td.ta_l span.date",
    posted_at_regex=r"(\d{4}-\d{2}-\d{2})",
    posted_at_format="%Y-%m-%d",
    external_id_regex=r"[?&]no=([0-9]+)",
)
