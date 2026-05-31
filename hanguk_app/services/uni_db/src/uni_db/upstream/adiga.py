"""Adiga (어디가) upstream adapter — KCUE admissions calendar.

Adiga (https://www.adiga.kr/) is the Ministry of Education's official
admissions information portal, operated by KCUE (한국대학교육협의회).
It publishes a unified admissions calendar covering ~330 four-year
universities and ~130 junior colleges (수시, 정시 가/나/다군, 재외국민,
외국인 cycles).

Integration path
----------------
Adiga does NOT publish a per-year CSV. The unified calendar is backed by
a JS widget at `/uct/cas/scheduleView.do` that calls `/uct/cas/scheduleAjax.do`
(POST) once per displayed month. Each response is HTML, but the per-day
event arrays are embedded as **HTML-encoded JSON** inside calendar-cell
click handlers. We mine those JSON blobs directly — they carry structured
fields (`sj`, `beginDe`, `endDe`, `scheduleType`, `unvNm`, `rmrkCn`, `gubun`)
which are far friendlier to parse than rendered HTML.

The endpoint needs a CSRF token (UUID, per-session) scraped from
`scheduleView.do` plus a JSESSIONID cookie. Both come for free from a
single `httpx.AsyncClient` instance.

Public touchpoints
------------------
* Web UI calendar: https://www.adiga.kr/uct/cas/scheduleView.do?menuId=PCUCTCAS1000
* Reference materials (자료실): https://www.adiga.kr/uct/ces/archiveView.do?menuId=PCUCTCES1000
  Out of scope for this adapter; covered by future per-PDF discovery.

NB: `ADIGA_APP_KEY` in .env is currently unused. Keep it set for the day
KCUE exposes a partner-only REST endpoint (per their 2026 roadmap).
"""

from __future__ import annotations

import html
import json
import logging
import re
from dataclasses import dataclass
from datetime import date
from typing import Any

import httpx

from ..config import settings

log = logging.getLogger(__name__)

ADIGA_SCHEDULE_VIEW_URL = "https://www.adiga.kr/uct/cas/scheduleView.do?menuId=PCUCTCAS1000"
ADIGA_SCHEDULE_AJAX_URL = "https://www.adiga.kr/uct/cas/scheduleAjax.do"

# CSRF token in scheduleView.do is a UUID hidden input on <form id="frm">.
_CSRF_RE = re.compile(r'name="_csrf"\s+value="([^"]+)"')

# Each event is a flat single-level JSON object embedded inside HTML attributes.
# The HTML keeps it as `{&quot;k&quot;:&quot;v&quot;,…}`. Negating `{}` is safe
# because event objects never contain nested objects (all values are str|int|null).
_EVENT_OBJECT_RE = re.compile(
    r"\{[^{}]*?&quot;beginDe&quot;:&quot;\d{4}-\d{2}-\d{2}&quot;[^{}]*?\}"
)

# Bracket prefix like "[정시]" / "[수시]" / "[재외국민]" / "[외국인]".
_BRACKET_TRACK_RE = re.compile(r"^\[([^\]]+)\]\s*(.*)$")


@dataclass(frozen=True, slots=True)
class AdigaCalendarRow:
    """One admissions-calendar event parsed from Adiga scheduleAjax.do."""

    subject_ko: str            # full label, e.g. "[정시]가군모집"
    track_ko: str | None       # parsed prefix, e.g. "정시" / "수시"
    event_name_ko: str         # subject without bracket prefix
    schedule_type: str         # "01"=수시, "02"=정시 (raw KCUE code)
    begin_date: date           # beginDe
    end_date: date             # endDe (== begin_date for single-day events)
    gubun: str | None          # KCUE classification (FTR, etc.)
    institution_name_ko: str | None  # unvNm — None in aggregated national view
    remarks_ko: str | None     # rmrkCn


async def fetch_csrf_token(client: httpx.AsyncClient) -> str:
    """Scrape the CSRF token from scheduleView.do (also seeds JSESSIONID).

    Side effect: the AsyncClient now holds the session cookie required by
    every subsequent scheduleAjax.do POST.
    """
    resp = await client.get(
        ADIGA_SCHEDULE_VIEW_URL,
        timeout=settings.http_request_timeout_sec,
    )
    resp.raise_for_status()
    m = _CSRF_RE.search(resp.text)
    if not m:
        raise RuntimeError(
            f"adiga scheduleView.do: _csrf hidden input not found "
            f"(body length {len(resp.text)})"
        )
    token = m.group(1)
    log.debug("adiga: csrf=%s... session seeded", token[:8])
    return token


def _parse_subject(sj: str) -> tuple[str | None, str]:
    """Split '[정시]가군모집' -> ('정시', '가군모집')."""
    sj = sj.strip()
    m = _BRACKET_TRACK_RE.match(sj)
    if m:
        return (m.group(1).strip() or None), m.group(2).strip()
    return None, sj


def _coerce_row(raw: dict[str, Any]) -> AdigaCalendarRow | None:
    """Turn one raw scheduleAjax JSON object into a typed row, or None if malformed."""
    sj = (raw.get("sj") or "").strip()
    begin = raw.get("beginDe")
    end = raw.get("endDe") or begin
    schedule_type = (raw.get("scheduleType") or "").strip()
    if not sj or not begin:
        return None
    try:
        begin_date = date.fromisoformat(begin)
        end_date = date.fromisoformat(end) if end else begin_date
    except ValueError:
        return None
    track, name = _parse_subject(sj)
    rmrk = raw.get("rmrkCn")
    if isinstance(rmrk, str):
        rmrk = rmrk.strip() or None
    unv = raw.get("unvNm")
    if isinstance(unv, str):
        unv = unv.strip() or None
    return AdigaCalendarRow(
        subject_ko=sj,
        track_ko=track,
        event_name_ko=name,
        schedule_type=schedule_type,
        begin_date=begin_date,
        end_date=end_date,
        gubun=raw.get("gubun"),
        institution_name_ko=unv,
        remarks_ko=rmrk,
    )


def _extract_events_from_html(body: str) -> list[AdigaCalendarRow]:
    """Pull every embedded event JSON object out of one scheduleAjax response."""
    rows: list[AdigaCalendarRow] = []
    seen: set[tuple[str, str, str]] = set()
    for blob in _EVENT_OBJECT_RE.findall(body):
        decoded = html.unescape(blob)
        try:
            raw = json.loads(decoded)
        except json.JSONDecodeError:
            continue
        if not isinstance(raw, dict):
            continue
        row = _coerce_row(raw)
        if row is None:
            continue
        key = (row.subject_ko, row.begin_date.isoformat(), row.end_date.isoformat())
        if key in seen:
            continue
        seen.add(key)
        rows.append(row)
    return rows


async def fetch_schedule_month(
    client: httpx.AsyncClient,
    *,
    year: int,
    month: int,
    csrf: str,
    schedule_types: str = "01,02",
) -> list[AdigaCalendarRow]:
    """POST one month of scheduleAjax.do; return parsed, deduped events."""
    form = {
        "searchScheduleType": schedule_types,
        "searchGdfStdClsfRgnCn": "",
        "searchCefStdClsfRgnCn": "",
        "searchMoveMonth": "0",
        "calType": "0",
        "listType": "1",
        "calYear": str(year),
        "calMonth": str(month),
        "_csrf": csrf,
    }
    log.debug("adiga.scheduleAjax POST year=%d month=%d", year, month)
    resp = await client.post(
        ADIGA_SCHEDULE_AJAX_URL,
        data=form,
        timeout=settings.http_request_timeout_sec,
    )
    resp.raise_for_status()
    return _extract_events_from_html(resp.text)


async def fetch_schedule_year(
    year: int,
    *,
    http_client: httpx.AsyncClient,
    schedule_types: str = "01,02",
) -> list[AdigaCalendarRow]:
    """Fetch a full year (12 months) of admissions-calendar events.

    Deduplicates multi-day events that span multiple month buckets.

    Raises:
        httpx.HTTPStatusError: if csrf-fetch or any month-fetch returns 4xx/5xx.
        RuntimeError: if the CSRF token isn't found on scheduleView.do.
    """
    csrf = await fetch_csrf_token(http_client)
    all_rows: list[AdigaCalendarRow] = []
    seen: set[tuple[str, str, str]] = set()
    for month in range(1, 13):
        month_rows = await fetch_schedule_month(
            http_client,
            year=year,
            month=month,
            csrf=csrf,
            schedule_types=schedule_types,
        )
        for row in month_rows:
            key = (row.subject_ko, row.begin_date.isoformat(), row.end_date.isoformat())
            if key in seen:
                continue
            seen.add(key)
            all_rows.append(row)
        log.info("adiga.scheduleAjax year=%d month=%d events=%d", year, month, len(month_rows))
    log.info("adiga.scheduleAjax year=%d total_unique=%d", year, len(all_rows))
    return all_rows
