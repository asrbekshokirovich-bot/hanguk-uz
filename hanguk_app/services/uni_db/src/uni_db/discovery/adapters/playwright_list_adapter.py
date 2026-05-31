"""Playwright list-page adapter for JS-rendered boards.

Many ROK university admissions boards (Yonsei, Konkuk, Inha, JBNU,
Kangwon, CBNU, Jeju...) render their announcement list via client-side
JavaScript — a static httpx GET returns either an empty body or a
loader shell. This adapter renders the page in headless Chromium before
handing the post-JS HTML to the existing HtmlListSelectors machinery.

Architecture:
  * Subclasses HtmlListAdapter, inherits the entire BeautifulSoup parsing
    pipeline (rows, title/link/posted_at extraction, external_id regex).
  * Overrides `_load_list_html()` to launch Playwright + Chromium,
    navigate to the source URL, optionally wait for a CSS selector or
    network-idle, then return `page.content()`.
  * Gated by `settings.live_crawl` (same contract as HtmlListAdapter):
    in fixture mode the adapter falls back to the fixture file and never
    touches Playwright.

Requires:
    pip install playwright
    playwright install chromium

If Playwright isn't installed at runtime, the adapter raises a clear
error pointing at the install command — it does NOT import playwright
at module-load time so the rest of the codebase keeps working.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from uuid import UUID

import httpx

from ...config import settings
from .html_list_adapter import HtmlListAdapter, HtmlListSelectors

log = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class PlaywrightRenderOptions:
    """Render-time options for the Playwright adapter.

    * `wait_for_selector` — CSS selector to await before grabbing HTML
      (more reliable than fixed timeouts for JS-heavy pages).
    * `wait_until` — Playwright page.goto wait condition. 'networkidle'
      is safest for SPAs; 'domcontentloaded' is faster for plain JS.
    * `timeout_ms` — hard cap on render time.
    * `user_agent` — override UA. Defaults to settings.http_user_agent.
    """

    wait_for_selector: str | None = None
    wait_until: str = "networkidle"
    timeout_ms: int = 30_000
    user_agent: str | None = None
    # Extra navigations the page may need before the list is ready —
    # e.g. tab clicks for the Korean board ('국문' tab on bilingual sites).
    pre_actions: tuple[tuple[str, str], ...] = field(default_factory=tuple)


class PlaywrightListAdapter(HtmlListAdapter):
    """SourceAdapter that renders the list page with Playwright."""

    def __init__(
        self,
        *,
        source_id: UUID,
        source_url_ko: str,
        selectors: HtmlListSelectors,
        render_options: PlaywrightRenderOptions | None = None,
        institution_id: UUID | None = None,
        http_client: httpx.AsyncClient | None = None,
        fixture_path: Path | None = None,
    ) -> None:
        super().__init__(
            source_id=source_id,
            source_url_ko=source_url_ko,
            selectors=selectors,
            institution_id=institution_id,
            http_client=http_client,
            fixture_path=fixture_path,
        )
        self._render_options = render_options or PlaywrightRenderOptions()

    async def _load_list_html(self) -> str:
        if not settings.live_crawl:
            # Fixture mode — defer to base class (reads fixture from disk).
            return await super()._load_list_html()

        try:
            from playwright.async_api import async_playwright
        except ImportError as exc:
            raise RuntimeError(
                "Playwright is not installed. Run:\n"
                "  .venv/bin/pip install playwright\n"
                "  .venv/bin/playwright install --with-deps chromium"
            ) from exc

        opts = self._render_options
        log.info(
            "playwright: rendering %s (wait=%s, until=%s, timeout=%dms)",
            self.source_url_ko, opts.wait_for_selector, opts.wait_until, opts.timeout_ms,
        )

        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=True)
            try:
                context = await browser.new_context(
                    user_agent=opts.user_agent or settings.http_user_agent,
                    locale="ko-KR",
                    viewport={"width": 1280, "height": 900},
                )
                page = await context.new_page()
                await page.goto(
                    self.source_url_ko,
                    wait_until=opts.wait_until,
                    timeout=opts.timeout_ms,
                )

                # Apply any pre-actions (click tabs, accept popups, etc.).
                for action, target in opts.pre_actions:
                    if action == "click":
                        try:
                            await page.click(target, timeout=5000)
                            log.info("playwright: clicked %s", target)
                        except Exception as e:
                            log.warning("playwright: pre_action click(%s) failed: %s", target, e)
                    elif action == "wait":
                        try:
                            await page.wait_for_selector(target, timeout=opts.timeout_ms)
                        except Exception as e:
                            log.warning("playwright: pre_action wait(%s) failed: %s", target, e)

                if opts.wait_for_selector:
                    try:
                        await page.wait_for_selector(
                            opts.wait_for_selector, timeout=opts.timeout_ms
                        )
                    except Exception as e:
                        log.warning(
                            "playwright: wait_for_selector(%s) timed out: %s",
                            opts.wait_for_selector, e,
                        )

                html = await page.content()
                log.info("playwright: got %d bytes of rendered HTML", len(html))
                return html
            finally:
                await browser.close()
