"""Seoul National University — international admissions notice board.

Source: https://admission.snu.ac.kr/international/notice
Archetype: A (top national, clean HTML table, SNU-pattern egov board)

Verified 2026-05-14 against live page.
Row HTML:
  <tr>
    <td class="col-title [file]"><a href="/international/notice?md=v&bbsidx=NNN">
      <span class="clip"><span class="txt">제목</span></span></a></td>
    <td class="col-date">2026. 4. 30.</td>
  </tr>
"""

from ..html_list_adapter import HtmlListSelectors

SNU_SELECTORS = HtmlListSelectors(
    row="div.board-list table tbody tr",
    title="td.col-title span.txt",
    link="td.col-title a",
    posted_at="td.col-date",
    posted_at_format="%Y. %m. %d.",
    attachments_in_detail=True,
    external_id_regex=r"bbsidx=([0-9]+)",
)
