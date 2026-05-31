"""Adiga (어디가) admissions-calendar fetch worker.

Fetches the KCUE/Adiga admissions calendar via `scheduleAjax.do`, snapshots
each year's events to disk as JSON, and optionally upserts into
`public.adiga_calendar_events` (when --ingest is passed).

Production wiring
-----------------
  systemd timer (Sun 03:00 local) →
    runs `python -m uni_db.workers.adiga_calendar_worker [--ingest]` →
    journald collects logs.

CLI
---
  python -m uni_db.workers.adiga_calendar_worker
    Snapshot only (default safe-mode). Targets current + next calendar year.
  python -m uni_db.workers.adiga_calendar_worker --year 2026
    Fetch ONLY calendar year 2026. Useful for backfills.
  python -m uni_db.workers.adiga_calendar_worker --year 2026 --ingest
    Fetch 2026 AND upsert into public.adiga_calendar_events.
  python -m uni_db.workers.adiga_calendar_worker --year 2026 --ingest --dry-run
    Same as above but ROLLBACK the transaction at the end (preview).

Exit codes
----------
  0 — at least one year resolved cleanly (fetched OR "not yet published")
  1 — unexpected error (network down, DB connection refused, permission denied)
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import httpx

from ..upstream.adiga import (
    ADIGA_SCHEDULE_AJAX_URL,
    AdigaCalendarRow,
    fetch_schedule_year,
)

log = logging.getLogger("uni_db.workers.adiga_calendar")

# Cache root mirrors the discovery worker's pattern. Override via env in tests.
CACHE_ROOT = Path(os.environ.get("UNI_DB_CACHE_ROOT", "/var/cache/uni_db"))
ADIGA_CACHE_DIR = CACHE_ROOT / "adiga"


def _target_years(now: datetime | None = None) -> list[int]:
    """**Calendar** years to fetch on each run (NOT academic years).

    Adiga's `calYear` form param is the calendar year of the event, not the
    학년도 (academic-year-of-entrance). A single Korean admissions cycle
    (e.g. for the 2027학년도 entrance class) spans **two** calendar years:
      * cal 2026 Sep–Dec → 수시 (early admission)
      * cal 2027 Jan–Feb → 정시 (regular admission)

    Fetching [current calendar year, current+1] covers the immediately-upcoming
    cycle plus the next one, which is what the weekly worker should keep fresh.
    Older cycles are historical and don't change; backfill is a separate task.
    """
    now = now or datetime.now(tz=timezone.utc)
    return [now.year, now.year + 1]


def _row_to_json(r: AdigaCalendarRow) -> dict:
    return {
        "subject_ko": r.subject_ko,
        "track_ko": r.track_ko,
        "event_name_ko": r.event_name_ko,
        "schedule_type": r.schedule_type,
        "begin_date": r.begin_date.isoformat(),
        "end_date": r.end_date.isoformat(),
        "gubun": r.gubun,
        "institution_name_ko": r.institution_name_ko,
        "remarks_ko": r.remarks_ko,
    }


async def fetch_one_year(client: httpx.AsyncClient, year: int) -> tuple[str, list[AdigaCalendarRow]]:
    """Fetch and snapshot one calendar year's events.

    Returns (status, rows):
      status ∈ {"fetched", "not_yet_published", "error:<detail>"}
      rows is non-empty iff status == "fetched"
    """
    try:
        rows = await fetch_schedule_year(year, http_client=client)
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 404:
            return ("not_yet_published", [])
        return (f"error:HTTP {exc.response.status_code}", [])
    except httpx.RequestError as exc:
        return (f"error:network {exc!s}", [])
    except Exception as exc:  # pragma: no cover — guard against decode/etc.
        return (f"error:unexpected {exc!s}", [])

    if not rows:
        return ("not_yet_published", [])

    ADIGA_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now(tz=timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    snapshot = ADIGA_CACHE_DIR / f"admission_calendar_{year}_{ts}.json"
    snapshot.write_text(
        json.dumps([_row_to_json(r) for r in rows], ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    log.info("adiga calendar %d fetched: %d events, snapshot=%s", year, len(rows), snapshot)
    return ("fetched", rows)


class _DryRunRollback(Exception):
    """Raised inside the transaction to force a rollback in --dry-run mode."""


async def _resolve_institution_id(conn, name_ko: str):
    """Look up institution by exact name_ko match. Returns UUID or None.

    Fuzzy matching is a future enhancement; Adiga's national events all have
    `institution_name_ko=None` today, so this path is rarely hit.
    """
    row = await conn.fetchrow(
        "select id from public.institutions where name_ko = $1",
        name_ko,
    )
    return row["id"] if row else None


async def ingest_rows_into_db(
    rows: list[AdigaCalendarRow],
    *,
    dry_run: bool = False,
) -> int:
    """Upsert Adiga events into `public.adiga_calendar_events`.

    Idempotent on `(subject_ko, begin_date, end_date)`. If `institution_name_ko`
    is set, exact-match against `institutions.name_ko`; on miss, write the raw
    name into `institution_name_ko_raw` and log a warning.

    Returns the number of rows upserted (i.e., len(rows) when the transaction
    commits successfully). In --dry-run mode, the transaction is rolled back
    but the count of *would-have-been-written* rows is still returned.

    Raises:
        RuntimeError: if SUPABASE_DB_URL is not configured.
        asyncpg.PostgresError: bubbled up on DB-side failures (caller should catch).
    """
    import asyncpg

    from ..config import settings

    db_url = settings.supabase_db_url
    if not db_url:
        raise RuntimeError(
            "SUPABASE_DB_URL not set in services/uni_db/.env; "
            "cannot --ingest. Set it (service-role) and retry."
        )

    conn = await asyncpg.connect(db_url)
    try:
        try:
            async with conn.transaction():
                for r in rows:
                    institution_id = None
                    institution_name_raw = None
                    if r.institution_name_ko:
                        institution_id = await _resolve_institution_id(conn, r.institution_name_ko)
                        if institution_id is None:
                            institution_name_raw = r.institution_name_ko
                            log.warning(
                                "adiga ingest: institution name %r not in institutions.name_ko; "
                                "stored as institution_name_ko_raw",
                                r.institution_name_ko,
                            )

                    await conn.execute(
                        """
                        insert into public.adiga_calendar_events (
                          subject_ko, track_ko, event_name_ko, schedule_type,
                          begin_date, end_date, gubun,
                          institution_id, institution_name_ko_raw, remarks_ko
                        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                        on conflict (subject_ko, begin_date, end_date) do update set
                          track_ko                = excluded.track_ko,
                          event_name_ko           = excluded.event_name_ko,
                          schedule_type           = excluded.schedule_type,
                          gubun                   = excluded.gubun,
                          institution_id          = excluded.institution_id,
                          institution_name_ko_raw = excluded.institution_name_ko_raw,
                          remarks_ko              = excluded.remarks_ko,
                          fetched_at              = now()
                        """,
                        r.subject_ko, r.track_ko, r.event_name_ko, r.schedule_type,
                        r.begin_date, r.end_date, r.gubun,
                        institution_id, institution_name_raw, r.remarks_ko,
                    )

                if dry_run:
                    raise _DryRunRollback
        except _DryRunRollback:
            log.info("adiga ingest dry-run: would have upserted %d rows (rolled back)", len(rows))
            return len(rows)
        log.info("adiga ingest: upserted %d rows", len(rows))
        return len(rows)
    finally:
        await conn.close()


async def run(
    *,
    year: int | None = None,
    ingest: bool = False,
    dry_run: bool = False,
) -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    log.info(
        "adiga calendar worker start (endpoint=%s, year=%s, ingest=%s, dry_run=%s)",
        ADIGA_SCHEDULE_AJAX_URL,
        year or "default",
        ingest,
        dry_run,
    )
    years = [year] if year else _target_years()
    any_clean = False
    all_rows: list[AdigaCalendarRow] = []
    async with httpx.AsyncClient() as client:
        for y in years:
            status, rows = await fetch_one_year(client, y)
            if status in ("fetched", "not_yet_published"):
                any_clean = True
            log.info("year=%d status=%s events=%d", y, status, len(rows))
            all_rows.extend(rows)

    if ingest and all_rows:
        try:
            ingest_count = await ingest_rows_into_db(all_rows, dry_run=dry_run)
            log.info("adiga calendar worker: ingest_count=%d", ingest_count)
        except Exception as exc:
            log.error("adiga calendar worker: ingest failed: %s", exc)
            any_clean = False

    log.info("adiga calendar worker end (any_clean=%s, events_total=%d)", any_clean, len(all_rows))
    return 0 if any_clean else 1


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="uni_db.workers.adiga_calendar_worker",
        description="Fetch Adiga admissions-calendar events; optionally ingest.",
    )
    parser.add_argument(
        "--year",
        type=int,
        default=None,
        help="Override default (current+next calendar year); fetch ONLY this year",
    )
    parser.add_argument(
        "--ingest",
        action="store_true",
        help="Upsert fetched events into public.adiga_calendar_events (requires SUPABASE_DB_URL)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="With --ingest, plan the upserts but ROLLBACK at the end (preview mode)",
    )
    args = parser.parse_args(argv)
    return asyncio.run(run(year=args.year, ingest=args.ingest, dry_run=args.dry_run))


if __name__ == "__main__":
    sys.exit(main())
