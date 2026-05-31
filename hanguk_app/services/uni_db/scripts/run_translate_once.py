#!/usr/bin/env python3
"""One-shot translation run for all enabled target languages.

Walks `institutions.name_ko` (and other translatable Korean fields) and
generates translations for each enabled language that doesn't yet have
one. Writes to `public.translations` via the existing translate_worker.

Usage:
    UNI_DB_LIVE_APIS=true \
      .venv/bin/python scripts/run_translate_once.py [--limit 50] [--langs en,vi,mn]

Default langs are taken from pipeline.enabled_languages() (en/uz/vi/mn
unless overridden via UNI_DB_TRANSLATION_LANGUAGES).
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys

import asyncpg

from uni_db.config import settings
from uni_db.translate.pipeline import enabled_languages
from uni_db.workers.translate_worker import (
    fetch_pending_jobs,
    load_glossary,
    run_jobs,
)


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger("run_translate_once")


async def main(args: argparse.Namespace) -> int:
    log.info(
        "live_apis=%s anthropic_key_set=%s papago_set=%s deepl_set=%s",
        settings.live_apis,
        bool(settings.anthropic_api_key),
        bool(settings.naver_papago_client_id),
        bool(settings.deepl_api_key),
    )

    if args.langs:
        langs = [s.strip() for s in args.langs.split(",") if s.strip()]
    else:
        langs = sorted(enabled_languages())
    log.info("Target langs: %s", langs)

    conn = await asyncpg.connect(settings.supabase_db_url)
    try:
        total_written = 0
        for lang in langs:
            glossary = await load_glossary(conn, target_lang=lang)
            jobs = await fetch_pending_jobs(conn, target_lang=lang, limit=args.limit)
            log.info("lang=%s pending=%d", lang, len(jobs))
            if not jobs:
                continue
            try:
                n = await run_jobs(conn, jobs, glossary=glossary)
                total_written += n
                log.info("lang=%s wrote=%d", lang, n)
            except Exception as exc:  # noqa: BLE001
                log.exception("lang=%s failed: %s", lang, exc)
    finally:
        await conn.close()

    log.info("Done. Total translations written=%d", total_written)
    return 0


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--limit", type=int, default=50, help="Max rows per language per run")
    p.add_argument("--langs", default=None, help="Comma-separated lang codes (default: enabled set)")
    args = p.parse_args()
    sys.exit(asyncio.run(main(args)))
