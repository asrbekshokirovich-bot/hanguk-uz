#!/usr/bin/env python3
"""One-shot discovery run against all live announcement sources.

Usage (on the Hetzner server):
    cd /opt/hanguk-uni-db/uni_db
    .venv/bin/python scripts/run_discovery_once.py

Options:
    --source-url URL   Only run this one source (by url_ko).
    --since DAYS       Look back N days (default: 1).
    --dry-run          Discover + print, but do not write to DB.

Requires:
    UNI_DB_LIVE_CRAWL=true   in .env (or exported in environment).
    UNI_DB_LIVE_APIS=true    if you also want to run parse/extract after.
    SUPABASE_DB_URL           Postgres pooler URL.
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys
from datetime import datetime, timedelta, timezone

import asyncpg
import httpx

from uni_db.config import settings
from uni_db.discovery.registry import due_sources, RegistrySource
from uni_db.discovery.adapters.configs import ADAPTER_REGISTRY
from uni_db.workers.discovery_worker import run_one_source, write_run_to_db

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger("run_discovery_once")


async def main(args: argparse.Namespace) -> int:
    if not settings.live_crawl:
        log.error(
            "UNI_DB_LIVE_CRAWL is not enabled. "
            "Set UNI_DB_LIVE_CRAWL=true in .env and retry."
        )
        return 1

    since = datetime.now(tz=timezone.utc) - timedelta(days=args.since)
    log.info("Discovery window: since %s (%d day(s) back)", since.isoformat(), args.since)

    conn = await asyncpg.connect(settings.supabase_db_url)
    try:
        sources = await due_sources(conn, limit=50)
        if args.source_url:
            sources = [s for s in sources if s.url_ko == args.source_url]
            if not sources:
                log.error("No live source found with url_ko=%r", args.source_url)
                return 1

        log.info("Running discovery on %d source(s)", len(sources))

        async with httpx.AsyncClient(
            headers={"User-Agent": settings.http_user_agent},
            follow_redirects=True,
            timeout=settings.http_request_timeout_sec,
        ) as http:
            total_new = 0
            total_changed = 0

            for source in sources:
                factory = ADAPTER_REGISTRY.get(source.url_ko)
                if factory is None:
                    log.warning(
                        "No adapter registered for %s — skipping. "
                        "Add a config to discovery/adapters/configs/.",
                        source.url_ko,
                    )
                    continue

                log.info("-> %s", source.url_ko)
                adapter = factory(
                    source_id=source.id,
                    institution_id=source.institution_id,
                    source_url_ko=source.url_ko,
                    http_client=http,
                )

                prior_snapshots = await _load_prior_snapshots(conn, source)

                run = await run_one_source(
                    source=source,
                    adapter=adapter,
                    prior_snapshots=prior_snapshots,
                    since=since,
                )

                total_new += run.summary.records_new
                total_changed += run.summary.records_changed

                log.info(
                    "  status=%-10s seen=%d new=%d changed=%d",
                    run.summary.status,
                    run.summary.records_seen,
                    run.summary.records_new,
                    run.summary.records_changed,
                )
                if run.summary.error_text:
                    log.error("  error: %s", run.summary.error_text)

                if not args.dry_run:
                    await write_run_to_db(conn, run)
                    log.info("  [OK] written to DB")
                else:
                    for ann, finding in run.findings:
                        log.info(
                            "  [DRY] %s | %s | %s",
                            finding.finding_type,
                            ann.posted_at,
                            ann.title_ko[:60],
                        )

    finally:
        await conn.close()

    log.info(
        "Done. Total new=%d changed=%d%s",
        total_new,
        total_changed,
        " [DRY RUN — nothing written]" if args.dry_run else "",
    )
    return 0


async def _load_prior_snapshots(conn: asyncpg.Connection, source: RegistrySource) -> dict:
    from uni_db.discovery.change_detection import PriorAnnouncementSnapshot
    from datetime import timezone

    rows = await conn.fetch(
        """
        select external_post_id, title_ko, detected_at,
               coalesce(attachments::text, '[]') as attachments_json
          from public.announcements
         where source_id = $1
        """,
        source.id,
    )
    import json
    result = {}
    for row in rows:
        try:
            atch = json.loads(row["attachments_json"] or "[]")
            hashes = tuple(sorted(a.get("sha256") or "" for a in atch))
        except Exception:
            hashes = ()
        seen_at = row["detected_at"]
        if seen_at and seen_at.tzinfo is None:
            seen_at = seen_at.replace(tzinfo=timezone.utc)
        result[row["external_post_id"]] = PriorAnnouncementSnapshot(
            title_ko=row["title_ko"],
            attachment_hashes=hashes,
            seen_at=seen_at or datetime.now(tz=timezone.utc),
        )
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--source-url", metavar="URL", help="Only crawl this source URL")
    parser.add_argument("--since", type=int, default=1, metavar="DAYS", help="Look-back window in days (default: 1)")
    parser.add_argument("--dry-run", action="store_true", help="Print findings without writing to DB")
    args = parser.parse_args()
    sys.exit(asyncio.run(main(args)))
