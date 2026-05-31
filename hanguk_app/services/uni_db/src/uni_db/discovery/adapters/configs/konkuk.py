"""Konkuk University (건국대) — 재외국민 (overseas Korean) notice board.

Source: http://enter.konkuk.ac.kr/submenu.do?menuurl=k8b%2fCUaWlntKYwhT%2fh%2bKUA%3d%3d&
CMS:    Custom JSP. Rendered via JS bootstrap; static fetch with
        wait_until="domcontentloaded" + 3s settle works reliably.
        wait_until="networkidle" never settles on this site.

The menuurl `k8b%2fCUaWlntKYwhT%2fh%2bKUA%3d%3d` is the encoded section
key for 재외국민 공지사항 (the other two encoded keys are 수시 and 정시).

Row structure (verified live 2026-05-15, 11 rows):
    <li>
      <a href="javascript:" onclick="pop_pass_open('288344','N');">
        <span class="number">
          <span class="fix">공지</span>  <!-- or number text -->
        </span>
        <span class="cate">재외국민</span>
        <p class="bbsTitle"><text>{title}</text></p>
        <div class="dateHit">
          <span class="date">2025.12.17</span>
          <span class="hit">4831</span>
        </div>
      </a>
    </li>

External post id is the first argument to pop_pass_open() (same pattern as JBNU).
"""

from __future__ import annotations

from uuid import UUID

import httpx

from ..html_list_adapter import HtmlListSelectors
from ..playwright_list_adapter import PlaywrightListAdapter, PlaywrightRenderOptions

KONKUK_SELECTORS = HtmlListSelectors(
    row="ul.list li",
    title="p.bbsTitle",
    link="a[onclick*='pop_pass_open']",
    posted_at="span.date",
    posted_at_regex=r"(\d{4}\.\d{2}\.\d{2})",
    posted_at_format="%Y.%m.%d",
    attachments_in_detail=True,
    external_id_regex=r"pop_pass_open\(['\"](\d+)['\"]",
)

_RENDER = PlaywrightRenderOptions(
    # Konkuk's enter.konkuk.ac.kr appears to bot-filter on User-Agent.
    # The default Chrome-shape UA loads in ~3s; HangukUniDBBot hangs
    # indefinitely. Override only for this site — keep the polite bot
    # UA as the global default everywhere else.
    user_agent=(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    ),
    wait_for_selector="ul.list li a[onclick*='pop_pass_open']",
    wait_until="domcontentloaded",
    timeout_ms=30_000,
)


def make_konkuk_adapter(
    source_id: UUID,
    institution_id: UUID | None,
    source_url_ko: str,
    http_client: httpx.AsyncClient,
):
    return PlaywrightListAdapter(
        source_id=source_id,
        source_url_ko=source_url_ko,
        selectors=KONKUK_SELECTORS,
        render_options=_RENDER,
        institution_id=institution_id,
        http_client=http_client,
    )
