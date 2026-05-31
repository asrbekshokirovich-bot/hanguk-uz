#!/usr/bin/env python3
"""One-shot fetch+parse run (thin wrapper over workers.fetch_worker).

Walks unlinked announcements that carry a usable admission PDF (an
attachment, or a url_ko on a host with a registered resolver), downloads +
stores each, inserts a guideline_documents row, links the announcement, and
runs the parse pipeline (extract field groups → review_queue).

The logic lives in `uni_db.workers.fetch_worker` so it is shared with the
`uni-db run-pipeline` command and unit-tested; this script just wires the DB
connection + HTTP client.

Usage:
    UNI_DB_LIVE_CRAWL=true UNI_DB_LIVE_APIS=true \
      .venv/bin/python scripts/run_parse_once.py --limit 25
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys

import asyncpg
import httpx

from uni_db.config import settings
from uni_db.workers import fetch_worker

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger("run_parse_once")


async def main(args: argparse.Namespace) -> int:
    log.info("live_crawl=%s live_apis=%s", settings.live_crawl, settings.live_apis)
    conn = await asyncpg.connect(settings.supabase_db_url)
    try:
        async with httpx.AsyncClient(
            headers={"User-Agent": settings.http_user_agent},
            follow_redirects=True,
            timeout=settings.http_request_timeout_sec,
        ) as http:
            ok, fail = await fetch_worker.fetch_pending(conn, http, limit=args.limit)
    finally:
        await conn.close()
    log.info("Done. ok=%d failed=%d", ok, fail)
    # A completed run is success even with 0 fetched (notices without PDFs,
    # or a temporarily unreachable host). Per-item failures are logged, not
    # fatal — so a scheduled run doesn't go red on a normal empty crawl.
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--limit", type=int, default=25,
                        help="Max announcements to fetch+parse this run")
    args = parser.parse_args()
    sys.exit(asyncio.run(main(args)))
