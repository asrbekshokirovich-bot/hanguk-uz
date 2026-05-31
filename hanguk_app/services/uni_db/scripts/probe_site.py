#!/usr/bin/env python3
"""Probe a university notice board to discover its scrape selectors.

The dev sandbox can't reach *.ac.kr (bot-filtered / JS-rendered), but the
GitHub Actions runner can. This script renders a board with a real-browser
Playwright profile (a Chrome UA bypasses the common UA bot-filters), then
tries a battery of candidate row selectors and reports which one yields a
clean list of (title, link, date) rows — plus a ready-to-paste
``HtmlListSelectors(...)`` snippet to drop into ``configs/<uni>.py``.

Usage (via the `uni-db-probe` GitHub Action, or locally where ac.kr is
reachable):

    python scripts/probe_site.py "https://admission.example.ac.kr/notice"

The analysis core (`analyze_html`) is pure and unit-tested; only
`render_with_browser` needs Playwright (lazy-imported).
"""

from __future__ import annotations

import re
import sys
from dataclasses import dataclass, field

from bs4 import BeautifulSoup

_DATE_RE = re.compile(r"\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}")
_ID_RE = re.compile(
    r"(?:nttId|articleNo|seq|bbsSeq|BBS_NO|idx|nttSn|boardSeq|bbs_no)=(\d+)", re.I
)
_ONCLICK_ID_RE = re.compile(r"[a-zA-Z_]+\(['\"]?(\d{2,})['\"]?")

# Common Korean university notice-board row containers, most-specific first.
_ROW_CANDIDATES: tuple[str, ...] = (
    "table.board_list tbody tr",
    "table.bbs_list tbody tr",
    "table.tbl_board tbody tr",
    "table.p-table tbody tr",
    "table.board-list tbody tr",
    "ul.board_list li",
    "ul.bbs_list li",
    "ul.list li",
    "ul.board-list li",
    "div.board_list li",
    ".board_list tr",
    ".bbsList tr",
    "table tbody tr",
    "tbody tr",
)


@dataclass
class Candidate:
    selector: str
    good_rows: int
    title_sel: str
    link_sel: str
    date_sel: str | None
    id_source: str
    samples: list[dict] = field(default_factory=list)


def _date_bearing_class(row) -> str | None:
    """Return a CSS selector for the element in `row` holding a date."""
    for el in row.find_all(True):
        text = el.get_text(" ", strip=True)
        if _DATE_RE.search(text) and len(text) < 40:
            cls = el.get("class")
            if cls:
                return f"{el.name}.{cls[0]}"
            return el.name
    return None


def _row_link(row):
    for a in row.find_all("a"):
        href = a.get("href") or ""
        onclick = a.get("onclick") or ""
        if href and not href.strip().startswith("#"):
            return a, href
        if "javascript" in href.lower() and onclick:
            return a, onclick
        if onclick:
            return a, onclick
    a = row.find("a")
    return (a, (a.get("href") or a.get("onclick") or "")) if a else (None, "")


def _id_regex_for(link_value: str) -> str:
    if _ID_RE.search(link_value):
        key = _ID_RE.search(link_value).group(0).split("=")[0]
        return rf"{key}=([0-9]+)"
    if _ONCLICK_ID_RE.search(link_value):
        return r"[a-zA-Z_]+\(['\"]?(\d+)"
    return r"(?:nttId|articleNo|seq|bbsSeq|BBS_NO)=([0-9]+)"


def analyze_html(html: str) -> list[Candidate]:
    """Rank candidate row selectors by how many clean (title+link+date) rows
    each yields. Pure — no IO."""
    soup = BeautifulSoup(html, "lxml")
    results: list[Candidate] = []
    for sel in _ROW_CANDIDATES:
        rows = soup.select(sel)
        good = 0
        samples: list[dict] = []
        title_sel = link_sel = "a"
        date_sel: str | None = None
        id_source = ""
        for row in rows:
            a, link_value = _row_link(row)
            if a is None:
                continue
            title = a.get_text(" ", strip=True)
            row_text = row.get_text(" ", strip=True)
            date_match = _DATE_RE.search(row_text)
            if title and len(title) > 4 and date_match is not None:
                good += 1
                if len(samples) < 3:
                    date_sel = date_sel or _date_bearing_class(row)
                    id_source = id_source or _id_regex_for(link_value)
                    a_cls = a.get("class")
                    link_sel = f"a.{a_cls[0]}" if a_cls else "a"
                    title_sel = link_sel
                    samples.append({
                        "title": title[:70],
                        "link": link_value[:90],
                        "date": date_match.group(0),
                    })
        if good >= 3:
            results.append(Candidate(
                selector=sel, good_rows=good, title_sel=title_sel,
                link_sel=link_sel, date_sel=date_sel, id_source=id_source,
                samples=samples,
            ))
    results.sort(key=lambda c: c.good_rows, reverse=True)
    return results


def render_report(candidates: list[Candidate]) -> str:
    if not candidates:
        return (
            "NO USABLE LIST FOUND.\n"
            "The page may be JS-rendered without a static list, or the board "
            "uses an unusual structure. Check the uploaded HTML artifact, or "
            "the board may need a JSON-API adapter instead.\n"
        )
    lines = ["=== Candidate row structures (best first) ===", ""]
    best = candidates[0]
    for c in candidates[:4]:
        lines.append(f"[{c.good_rows} rows]  row = {c.selector!r}")
        for s in c.samples:
            lines.append(f"      • {s['title']}  ({s['date']})  -> {s['link']}")
        lines.append("")
    lines += [
        "=== Suggested HtmlListSelectors (verify against samples above) ===",
        "HtmlListSelectors(",
        f"    row={best.selector!r},",
        f"    title={best.title_sel!r},",
        f"    link={best.link_sel!r},",
        f"    posted_at={best.date_sel!r},",
        '    posted_at_regex=r"(\\d{4}[.\\-/]\\d{1,2}[.\\-/]\\d{1,2})",',
        f"    external_id_regex=r{best.id_source!r},",
        ")",
    ]
    return "\n".join(lines)


def render_with_browser(url: str) -> str:  # pragma: no cover — needs Playwright + network
    """Render `url` with a real-browser Chrome profile and return the HTML."""
    from playwright.sync_api import sync_playwright

    ua = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    )
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_context(user_agent=ua).new_page()
        page.goto(url, wait_until="domcontentloaded", timeout=45_000)
        page.wait_for_timeout(3500)  # let JS bootstrap settle
        html = page.content()
        browser.close()
    return html


def main(argv: list[str]) -> int:  # pragma: no cover
    if len(argv) < 2:
        print("usage: probe_site.py <url>", file=sys.stderr)
        return 2
    url = argv[1]
    print(f"# Probing {url}\n")
    html = render_with_browser(url)
    print(f"(rendered {len(html)} bytes)\n")
    candidates = analyze_html(html)
    print(render_report(candidates))
    # Dump HTML for the artifact upload / deeper inspection.
    out = "probe_output.html"
    with open(out, "w", encoding="utf-8") as fh:
        fh.write(html)
    print(f"\n(full rendered HTML written to {out})")
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main(sys.argv))
