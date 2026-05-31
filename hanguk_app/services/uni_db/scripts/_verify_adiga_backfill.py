"""Read-only verification of the Adiga 2026 backfill in staging."""

from __future__ import annotations

import asyncio
import sys

import asyncpg

from uni_db.config import settings

# Force UTF-8 stdout so Korean event names render on the Windows cp1251 console.
sys.stdout.reconfigure(encoding="utf-8", errors="replace")


async def main() -> int:
    if not settings.supabase_db_url:
        print("FATAL: SUPABASE_DB_URL not set")
        return 1
    conn = await asyncpg.connect(settings.supabase_db_url)
    try:
        total = await conn.fetchval(
            "select count(*) from public.adiga_calendar_events"
        )
        print(f"Total rows in public.adiga_calendar_events: {total}")

        by_type = await conn.fetch(
            "select schedule_type, count(*) c from public.adiga_calendar_events "
            "group by schedule_type order by schedule_type"
        )
        print("\nBy schedule_type:")
        labels = {"01": "수시 (early)", "02": "정시 (regular)"}
        for r in by_type:
            print(f"  {r['schedule_type']} ({labels.get(r['schedule_type'], '?')}): {r['c']} rows")

        by_track = await conn.fetch(
            "select track_ko, count(*) c from public.adiga_calendar_events "
            "group by track_ko order by c desc"
        )
        print("\nBy track_ko:")
        for r in by_track:
            print(f"  {r['track_ko'] or '<null>'}: {r['c']}")

        span = await conn.fetchrow(
            "select min(begin_date) lo, max(end_date) hi "
            "from public.adiga_calendar_events"
        )
        print(f"\nDate span: {span['lo']} .. {span['hi']}")

        print("\nFirst 5 chronological events:")
        first = await conn.fetch(
            "select begin_date, end_date, schedule_type, track_ko, event_name_ko "
            "from public.adiga_calendar_events "
            "order by begin_date, end_date limit 5"
        )
        for r in first:
            print(
                f"  {r['begin_date']} → {r['end_date']}  "
                f"[{r['schedule_type']}]{r['track_ko'] or ''}  {r['event_name_ko']}"
            )

        print("\nLast 5 chronological events:")
        last = await conn.fetch(
            "select begin_date, end_date, schedule_type, track_ko, event_name_ko "
            "from public.adiga_calendar_events "
            "order by begin_date desc, end_date desc limit 5"
        )
        for r in last:
            print(
                f"  {r['begin_date']} → {r['end_date']}  "
                f"[{r['schedule_type']}]{r['track_ko'] or ''}  {r['event_name_ko']}"
            )

        susi_window = await conn.fetchval(
            "select count(*) from public.adiga_calendar_events "
            "where begin_date between '2026-09-01' and '2026-12-31' "
            "and schedule_type = '01'"
        )
        print(f"\n수시 events in Sep-Dec 2026 (2027학년도 early cycle): {susi_window}")

        jeongsi_window = await conn.fetchval(
            "select count(*) from public.adiga_calendar_events "
            "where begin_date between '2026-01-01' and '2026-02-28' "
            "and schedule_type = '02'"
        )
        print(f"정시 events in Jan-Feb 2026 (2026학년도 regular leftover): {jeongsi_window}")
    finally:
        await conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
