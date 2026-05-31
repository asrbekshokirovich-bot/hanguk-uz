"""Loader for the `announcement_sources` registry.

Plan §E.1, §E.4. The discovery worker pulls due rows; this module wraps
the SQL so workers can call `due_sources()` without knowing the schema.

Phase 0 keeps every DB call at the SQL layer (no ORM) — the migrations
own the truth.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Literal
from uuid import UUID

import asyncpg

SourceStatus = Literal["discovered", "pending_review", "live", "deprecated", "blocked"]


@dataclass(frozen=True, slots=True)
class RegistrySource:
    id: UUID
    institution_id: UUID | None
    source_type: str
    url_ko: str
    status: SourceStatus
    cron_high_season_minutes: int
    cron_off_season_minutes: int
    consecutive_fails: int


_DUE_SQL = """
select id, institution_id, source_type, url_ko, status,
       cron_high_season_minutes, cron_off_season_minutes, consecutive_fails
  from public.announcement_sources
 where status = 'live'
   and (next_poll_at is null or next_poll_at <= now())
 order by coalesce(next_poll_at, '-infinity'::timestamptz)
 limit $1
"""

_RESCHEDULE_SQL = """
update public.announcement_sources
   set last_polled_at = now(),
       next_poll_at   = now() + ($2::int * interval '1 minute'),
       consecutive_fails = case
         when $3::bool then 0
         else consecutive_fails + 1
       end
 where id = $1
"""


async def due_sources(conn: asyncpg.Connection, *, limit: int = 25) -> list[RegistrySource]:
    rows = await conn.fetch(_DUE_SQL, limit)
    return [RegistrySource(**dict(r)) for r in rows]


async def reschedule(
    conn: asyncpg.Connection,
    *,
    source_id: UUID,
    next_in_minutes: int,
    succeeded: bool,
) -> None:
    await conn.execute(_RESCHEDULE_SQL, source_id, next_in_minutes, succeeded)


def is_high_season(now: datetime | None = None) -> bool:
    """Audit §6.7 / plan §E.4 — Korean admissions seasonality."""
    moment = now or datetime.now(tz=timezone.utc)
    return moment.month not in (6, 7, 8)


def next_interval_minutes(src: RegistrySource, *, now: datetime | None = None) -> int:
    """Apply seasonal cadence + back-off on consecutive failures."""
    base = (
        src.cron_high_season_minutes if is_high_season(now) else src.cron_off_season_minutes
    )
    if src.consecutive_fails > 0:
        # Exponential back-off capped at 24h (audit §6.7 polite jitter rule).
        backoff = min(60 * 24, base * (2**min(src.consecutive_fails, 4)))
        return backoff
    return base


def jittered_next_poll_at(
    minutes: int,
    *,
    jitter_minutes: int,
    now: datetime | None = None,
    rand: float = 0.0,
) -> datetime:
    """Deterministic when `rand` is supplied; tests pass rand=0.5 etc."""
    now = now or datetime.now(tz=timezone.utc)
    offset = int(jitter_minutes * (rand - 0.5) * 2)
    return now + timedelta(minutes=minutes + offset)
