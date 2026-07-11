"""Admin CLI — `uni-db <subcommand>`.

Phase 0 commands:
  review-digest          Print HITL review queue as Markdown digest.
  crawl --source X       Run discovery against a fixture (no live HTTP).
  parse  --fixture NAME  Run extraction (mocked LLM) against a fixture PDF.
  schema-check           Verify migrations parse and that tables-of-record
                         are referenced by views.

The CLI never touches a live DB unless SUPABASE_DB_URL is set AND the
subcommand explicitly calls for it. Every paid integration is gated on
settings.live_apis.
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys
from pathlib import Path

from .config import settings


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="uni-db", description="Korean Universities DB admin")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_review = sub.add_parser("review-digest", help="Print HITL queue as markdown")
    p_review.add_argument("--limit", type=int, default=20)

    p_crawl = sub.add_parser("crawl", help="Run discovery against a source")
    p_crawl.add_argument("--source", required=True, help="e.g. snu | rss-fixture")
    p_crawl.add_argument("--fixture", action="store_true",
                         help="Read from tests/fixtures/<source>.html")

    p_parse = sub.add_parser("parse", help="Run extraction over a fixture PDF")
    p_parse.add_argument("--fixture", required=True,
                         help="basename in tests/fixtures (without extension)")

    p_pipeline = sub.add_parser(
        "run-pipeline",
        help="LIVE: fetch pending announcements → guideline_documents → extract → enqueue",
    )
    p_pipeline.add_argument("--limit", type=int, default=25,
                            help="Max announcements to fetch+parse this run")

    p_reparse = sub.add_parser(
        "reparse",
        help="LIVE: re-extract already-stored guideline documents (apply fixes to existing data)",
    )
    p_reparse.add_argument("--limit", type=int, default=25,
                           help="Max stored documents to re-extract this run")
    p_reparse.add_argument("--institution", default=None,
                           help="Limit to one institution by primary_domain (e.g. inha.ac.kr)")
    p_reparse.add_argument("--pending-only", action="store_true",
                           help="Only never-parsed (uploaded) docs; mark failures "
                                "'failed' so a broken PDF isn't re-billed each run")

    p_ingest = sub.add_parser(
        "ingest-direct",
        help="LIVE: fetch+extract guides from auto-discovered (promoted) sources "
             "that have no board adapter",
    )
    p_ingest.add_argument("--limit", type=int, default=60,
                          help="Max promoted sources to ingest this run")

    p_find = sub.add_parser(
        "find-guidelines",
        help="LIVE: search every institution's own domain for the target cycle's "
             "모집요강 PDF, ingest+parse only newly-published ones",
    )
    p_find.add_argument("--limit", type=int, default=400,
                        help="Max institutions to sweep this run (default 400 — "
                             "covers the whole ~300 list)")
    p_find.add_argument("--year", type=int, default=None,
                        help="Target academic year (학년도). Default: the CRM-selected "
                             "intake (public.intakes), else next year.")
    p_find.add_argument("--per-institution", type=int, default=3,
                        help="Best-N ranked candidates to attempt downloading per "
                             "school before giving up (default 3)")

    p_publish = sub.add_parser(
        "publish",
        help="Normalize approved review items into the public tables the app reads "
             "(requirements/tuition/scholarships/periods/documents). DB-only, no LLM.",
    )
    p_publish.add_argument("--limit", type=int, default=200,
                           help="Max approved-unpublished review items this run")

    p_propose = sub.add_parser(
        "propose-sources",
        help="LIVE: Naver-discover unknown ac.kr admission boards → proposed_sources (HITL review)",
    )
    p_propose.add_argument("--days", type=int, default=150,
                           help="broad mode: only consider posts from the last N days "
                                "(default 150 — universities post 모집요강 months ahead)")
    p_propose.add_argument("--mode", choices=["broad", "targeted"], default="broad",
                           help="broad: search all of .ac.kr for new boards; "
                                "targeted: search inside each known university domain "
                                "for its foreign-applicant (외국인/재외국민) page")

    sub.add_parser("schema-check", help="Lint the migrations directory")
    return parser


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=settings.log_level, stream=sys.stderr)
    parser = _build_parser()
    args = parser.parse_args(argv)

    if args.cmd == "review-digest":
        return asyncio.run(_review_digest(limit=args.limit))
    if args.cmd == "crawl":
        return asyncio.run(_crawl_fixture(source=args.source, fixture=args.fixture))
    if args.cmd == "parse":
        return asyncio.run(_parse_fixture(name=args.fixture))
    if args.cmd == "run-pipeline":
        return asyncio.run(_run_pipeline(limit=args.limit))
    if args.cmd == "reparse":
        return asyncio.run(_reparse(limit=args.limit, institution=args.institution,
                                    pending_only=args.pending_only))
    if args.cmd == "ingest-direct":
        return asyncio.run(_ingest_direct(limit=args.limit))
    if args.cmd == "find-guidelines":
        return asyncio.run(_find_guidelines(
            limit=args.limit, year=args.year, per_institution=args.per_institution,
        ))
    if args.cmd == "publish":
        return asyncio.run(_publish(limit=args.limit))
    if args.cmd == "propose-sources":
        return asyncio.run(_propose_sources(days=args.days, mode=args.mode))
    if args.cmd == "schema-check":
        return _schema_check()

    parser.error(f"unknown command: {args.cmd}")
    return 2


async def _review_digest(*, limit: int) -> int:
    """Phase 1 markdown digest: queue + overdue + per-archetype accuracy.

    Requires SUPABASE_DB_URL when invoked against a live database. Without
    one, prints a friendly stub explaining how to enable it.
    """
    from .hitl.digest import (
        ArchetypeAccuracy,
        OverdueRow,
        QueueRow,
        render_digest,
    )

    if not settings.supabase_db_url:
        empty = render_digest(queue=[], accuracy=[], overdue=[])
        print(empty)
        print(
            "> SUPABASE_DB_URL not set. The digest above is the empty-state "
            "shape; set the env in `services/uni_db/.env` to render against "
            "the live DB."
        )
        return 0

    from .db import acquire

    async with acquire() as conn:
        queue_rows = await conn.fetch(
            """
            select id, priority, reason, entity_type, entity_id,
                   name_ko, name_en, source_url_ko, created_at
              from public.v_review_queue_dashboard
             order by priority asc, created_at asc
             limit $1
            """,
            limit,
        )
        overdue_rows = await conn.fetch(
            """
            select id, priority, name_ko, name_en,
                   extract(epoch from age) / 3600.0 as age_hours
              from public.v_review_queue_overdue
             limit 50
            """
        )
        accuracy_rows = await conn.fetch(
            "select archetype, total_decided, approved_as_is, "
            "approved_with_edits, rejected, approved_as_is_pct "
            "from public.v_extraction_accuracy_by_archetype"
        )

    queue = [
        QueueRow(
            id=str(r["id"]),
            priority=r["priority"],
            reason=r["reason"],
            entity_type=r["entity_type"],
            entity_id=str(r["entity_id"]),
            name_ko=r["name_ko"],
            name_en=r["name_en"],
            source_url_ko=r["source_url_ko"],
            created_at=r["created_at"],
        )
        for r in queue_rows
    ]
    overdue = [
        OverdueRow(
            id=str(r["id"]),
            priority=r["priority"],
            age_hours=float(r["age_hours"]),
            name_ko=r["name_ko"],
            name_en=r["name_en"],
        )
        for r in overdue_rows
    ]
    accuracy = [
        ArchetypeAccuracy(
            archetype=r["archetype"] or "—",
            total_decided=r["total_decided"],
            approved_as_is=r["approved_as_is"],
            approved_with_edits=r["approved_with_edits"],
            rejected=r["rejected"],
            approved_as_is_pct=(
                float(r["approved_as_is_pct"])
                if r["approved_as_is_pct"] is not None
                else None
            ),
        )
        for r in accuracy_rows
    ]
    print(render_digest(queue=queue, accuracy=accuracy, overdue=overdue))
    return 0


async def _crawl_fixture(*, source: str, fixture: bool) -> int:
    if not fixture:
        print("Phase 0 only supports --fixture mode.", file=sys.stderr)
        return 2

    from uuid import uuid4

    from .discovery.adapters.html_list_adapter import HtmlListAdapter, HtmlListSelectors
    from .discovery.registry import RegistrySource
    from .workers.discovery_worker import run_one_source

    fixture_root = Path(__file__).parent.parent.parent / "tests" / "fixtures"
    candidate = fixture_root / f"{source}_list.html"
    if not candidate.exists():
        print(f"fixture {candidate} missing", file=sys.stderr)
        return 2

    adapter = HtmlListAdapter(
        source_id=uuid4(),
        source_url_ko="https://admission.snu.ac.kr/international/notice",
        selectors=HtmlListSelectors(
            row="tr.notice-row",
            title="td.title",
            link="td.title a",
            posted_at="td.date",
        ),
        fixture_path=candidate,
    )
    src = RegistrySource(
        id=adapter.source_id,
        institution_id=None,
        source_type="university_admission_board",
        url_ko=adapter.source_url_ko,
        status="live",
        cron_high_season_minutes=360,
        cron_off_season_minutes=1440,
        consecutive_fails=0,
    )
    run = await run_one_source(source=src, adapter=adapter, prior_snapshots={})
    print(f"# discovery run — {source}")
    print(f"  records_seen={run.summary.records_seen} new={run.summary.records_new} "
          f"changed={run.summary.records_changed} status={run.summary.status}")
    for ann, finding in run.findings:
        print(f"  - [{finding.finding_type}/P{finding.priority}] {ann.title_ko[:80]}")
    return 0


async def _parse_fixture(*, name: str) -> int:
    fixture_root = Path(__file__).parent.parent.parent / "tests" / "fixtures"
    candidate = fixture_root / f"{name}.pdf"
    if not candidate.exists():
        print(f"fixture {candidate} missing", file=sys.stderr)
        return 2

    from uuid import uuid4

    from .parse.pdf_text import extract_text_from_path
    from .workers.parse_worker import parse_one_document

    extracted = extract_text_from_path(candidate)
    outcome = parse_one_document(
        guideline_document_id=uuid4(),
        pdf_text_first_pages=extracted.text[:6000],
        pdf_text_full=extracted.text,
    )
    print(f"# parse — {name}")
    print(f"  archetype={outcome.archetype.label} ({outcome.archetype.confidence:.2f})")
    for r in outcome.extraction_results:
        print(f"  - {r.field_group}: {r.llm_provider}/{r.llm_model} "
              f"conf={r.accuracy_self_score:.2f}")
    if outcome.review_queue_entries:
        print(f"  review_queue: {len(outcome.review_queue_entries)} entries enqueued")
    return 0


async def _run_pipeline(*, limit: int) -> int:
    """LIVE fetch+parse stage: drain pending announcements into review.

    Gated on `UNI_DB_LIVE_CRAWL` + `UNI_DB_LIVE_APIS` (real HTTP + paid LLM)
    and `SUPABASE_DB_URL`. Refuses (exit 2) with guidance when any is unset,
    so it can't accidentally fire from a misconfigured scheduler.
    """
    if not (settings.live_crawl and settings.live_apis):
        print(
            "run-pipeline needs UNI_DB_LIVE_CRAWL=true and UNI_DB_LIVE_APIS=true "
            "(real ac.kr fetches + paid LLM). Refusing. See docs/credentials.md.",
            file=sys.stderr,
        )
        return 2
    if not settings.supabase_db_url:
        print("SUPABASE_DB_URL is not set; cannot run the live pipeline.", file=sys.stderr)
        return 2

    import asyncpg
    import httpx

    from .workers import fetch_worker

    conn = await asyncpg.connect(settings.supabase_db_url)
    try:
        async with httpx.AsyncClient(
            headers={"User-Agent": settings.http_user_agent},
            follow_redirects=True,
            timeout=settings.http_request_timeout_sec,
        ) as http:
            ok, fail = await fetch_worker.fetch_pending(conn, http, limit=limit)
    finally:
        await conn.close()

    # A completed run is a success even if nothing new was fetched: most
    # candidates are notices with no PDF, or a host that's temporarily
    # unreachable. Per-item failures are logged, not fatal — only a config
    # error (handled above, exit 2) should fail the scheduled job.
    if ok == 0 and fail > 0:
        print(
            f"run-pipeline: completed — 0 fetched, {fail} skipped "
            "(no usable PDF / host unreachable). Not a job failure."
        )
    else:
        print(f"run-pipeline: fetched+parsed ok={ok} failed={fail}")
    return 0


async def _reparse(*, limit: int, institution: str | None, pending_only: bool = False) -> int:
    """LIVE: re-extract already-stored guideline documents so the latest
    extraction/normalization fixes apply to existing data (the old review
    cards are superseded via dedup). Reads PDFs from storage — does NOT
    re-fetch from ac.kr — but DOES make paid LLM calls, so it's gated on
    `UNI_DB_LIVE_APIS` + `SUPABASE_DB_URL`.
    """
    if not settings.live_apis:
        print(
            "reparse needs UNI_DB_LIVE_APIS=true (it re-runs paid LLM "
            "extraction). Refusing. See docs/credentials.md.",
            file=sys.stderr,
        )
        return 2
    if not settings.supabase_db_url:
        print("SUPABASE_DB_URL is not set; cannot reparse.", file=sys.stderr)
        return 2

    import asyncpg

    from .workers import reparse_worker

    conn = await asyncpg.connect(settings.supabase_db_url)
    try:
        institution_id = None
        if institution:
            institution_id = await conn.fetchval(
                "select id from public.institutions where primary_domain = $1",
                institution,
            )
            if institution_id is None:
                print(f"No institution with primary_domain={institution!r}.", file=sys.stderr)
                return 2
        ok, fail = await reparse_worker.reparse_pending(
            conn, limit=limit, institution_id=institution_id, pending_only=pending_only,
        )
    finally:
        await conn.close()

    print(f"reparse: re-extracted ok={ok} failed={fail}")
    return 0


async def _publish(*, limit: int) -> int:
    """Normalize approved review items into the public tables the app reads.
    DB-only (no LLM/HTTP), so it just needs `SUPABASE_DB_URL`.
    """
    if not settings.supabase_db_url:
        print("SUPABASE_DB_URL is not set; cannot publish.", file=sys.stderr)
        return 2

    import asyncpg

    from .workers import publish_worker

    conn = await asyncpg.connect(settings.supabase_db_url)
    try:
        run = await publish_worker.publish_pending(conn, limit=limit)
    finally:
        await conn.close()

    print(
        f"publish: approved_seen={run.approved_seen} published={run.published} "
        f"rows_written={run.rows_written} skipped={run.skipped} held={run.held} "
        f"errors={run.errors}"
    )
    return 0


async def _ingest_direct(*, limit: int) -> int:
    """LIVE: fetch + extract guides from auto-discovered (promoted) sources that
    have no board adapter — direct PDF links and plain guide pages. Real ac.kr
    fetches + paid LLM, and it auto-creates a hidden placeholder institution for
    any school not yet tracked, so it's gated on `UNI_DB_LIVE_CRAWL` +
    `UNI_DB_LIVE_APIS` + `SUPABASE_DB_URL`.
    """
    if not (settings.live_crawl and settings.live_apis):
        print(
            "ingest-direct needs UNI_DB_LIVE_CRAWL=true and UNI_DB_LIVE_APIS=true "
            "(real ac.kr fetches + paid LLM). Refusing. See docs/credentials.md.",
            file=sys.stderr,
        )
        return 2
    if not settings.supabase_db_url:
        print("SUPABASE_DB_URL is not set; cannot ingest.", file=sys.stderr)
        return 2

    import asyncpg
    import httpx

    from .workers import direct_ingest_worker

    conn = await asyncpg.connect(settings.supabase_db_url)
    try:
        async with httpx.AsyncClient(
            headers={"User-Agent": settings.http_user_agent},
            follow_redirects=True,
            timeout=settings.http_request_timeout_sec,
        ) as http:
            ok, fail = await direct_ingest_worker.ingest_pending(conn, http, limit=limit)
    finally:
        await conn.close()

    print(f"ingest-direct: ingested ok={ok} failed={fail}")
    return 0


async def _find_guidelines(*, limit: int, year: int | None, per_institution: int) -> int:
    """LIVE: sweep every tracked institution for the target cycle's 모집요강 PDF.

    For each institution it site-searches (Naver) inside the university's own
    domain, ranks the hits, downloads the best PDF, and — only when the PDF is
    genuinely new (unseen SHA-256) — stores it and runs the paid Claude parse.
    Real ac.kr fetches + paid LLM, so it's gated on `UNI_DB_LIVE_CRAWL` +
    `UNI_DB_LIVE_APIS` + Naver keys + `SUPABASE_DB_URL`.
    """
    if not (settings.live_crawl and settings.live_apis):
        print(
            "find-guidelines needs UNI_DB_LIVE_CRAWL=true and UNI_DB_LIVE_APIS=true "
            "(real ac.kr fetches + paid LLM). Refusing. See docs/credentials.md.",
            file=sys.stderr,
        )
        return 2
    if not (settings.naver_search_client_id and settings.naver_search_client_secret):
        print(
            "NAVER_SEARCH_CLIENT_ID/SECRET not set; cannot search for guidelines.",
            file=sys.stderr,
        )
        return 2
    if not settings.supabase_db_url:
        print("SUPABASE_DB_URL is not set; cannot run the guideline finder.", file=sys.stderr)
        return 2

    from datetime import datetime, timezone

    import asyncpg
    import httpx

    from .workers import guideline_finder_worker

    conn = await asyncpg.connect(settings.supabase_db_url)
    try:
        # Target cycle: an explicit --year wins; otherwise the CRM-selected
        # intake (public.intakes); otherwise the upcoming academic year.
        target_year: int | None = year
        target_term: str | None = None
        if target_year is None:
            cycle = await guideline_finder_worker.fetch_target_cycle(conn)
            if cycle is not None:
                target_year, target_term = cycle
        if target_year is None:
            target_year = datetime.now(tz=timezone.utc).year + 1

        # Gate 0 identity check + target-cycle-aware parse gauntlet, unless
        # verification is turned off (UNI_DB_VERIFY_LEVEL=off).
        verify_on = settings.verify_level.lower() != "off"
        identity_check = (
            guideline_finder_worker.make_identity_check(target_year, target_term)
            if verify_on else None
        )
        run_parse = guideline_finder_worker.make_run_parse(target_year, target_term)

        async with httpx.AsyncClient(
            headers={"User-Agent": settings.http_user_agent},
            follow_redirects=True,
            timeout=settings.http_request_timeout_sec,
        ) as http:
            run = await guideline_finder_worker.find_new_guidelines(
                conn, http,
                year=target_year, limit=limit, per_institution=per_institution,
                run_parse=run_parse, identity_check=identity_check,
            )
    finally:
        await conn.close()

    cycle_label = f"{target_year}{'/' + target_term if target_term else ''}"
    print(
        f"find-guidelines[{cycle_label}]: institutions={run.institutions_seen} "
        f"candidates={run.candidates_seen} ingested={run.ingested} "
        f"unchanged={run.unchanged} skipped={run.skipped} errors={run.errors} "
        f"(verify={settings.verify_level}, approval_required={settings.require_approval})"
    )
    return 0


async def _propose_sources(*, days: int, mode: str) -> int:
    """LIVE: discover ac.kr admission pages via the Naver web-search API and
    write the survivors to `proposed_sources` for HITL review.

    `broad`    — search all of .ac.kr for newly-posted admission boards.
    `targeted` — search inside each university domain we already know for its
                 foreign-applicant (외국인/재외국민) page, so universities we only
                 found a domestic page for get their foreign page filled in.

    Free (no LLM, no fetch) but it calls a live API and writes to prod, so it's
    gated on `UNI_DB_LIVE_APIS` + Naver keys + `SUPABASE_DB_URL`. Nothing goes
    live without a reviewer approving in v_proposed_sources_queue.
    """
    if not settings.live_apis:
        print(
            "propose-sources needs UNI_DB_LIVE_APIS=true (it calls the live "
            "Naver search API). Refusing. See docs/credentials.md.",
            file=sys.stderr,
        )
        return 2
    if not (settings.naver_search_client_id and settings.naver_search_client_secret):
        print(
            "NAVER_SEARCH_CLIENT_ID/SECRET not set; cannot run Naver discovery.",
            file=sys.stderr,
        )
        return 2
    if not settings.supabase_db_url:
        print("SUPABASE_DB_URL is not set; cannot write proposed_sources.", file=sys.stderr)
        return 2

    from datetime import datetime, timedelta, timezone

    import asyncpg
    import httpx

    from .workers import propose_worker

    conn = await asyncpg.connect(settings.supabase_db_url)
    try:
        async with httpx.AsyncClient(
            headers={"User-Agent": settings.http_user_agent},
            follow_redirects=True,
            timeout=settings.http_request_timeout_sec,
        ) as http:
            if mode == "targeted":
                domains = await propose_worker.fetch_known_domains(conn)
                if not domains:
                    print(
                        "propose-sources --mode targeted: no known university domains "
                        "in proposed_sources yet. Run broad discovery first."
                    )
                    return 0
                # Foreign-admission pages are stable pages, not recent posts —
                # don't date-filter them.
                run = await propose_worker.discover_targeted(
                    conn,
                    domains=domains,
                    since=datetime(2000, 1, 1, tzinfo=timezone.utc),
                    http_client=http,
                )
            else:
                since = datetime.now(timezone.utc) - timedelta(days=days)
                run = await propose_worker.discover_sources(
                    conn, since=since, http_client=http
                )
    finally:
        await conn.close()

    label = "searches" if mode == "targeted" else "keywords"
    print(
        f"propose-sources[{mode}]: {label}={run.keywords_searched} "
        f"candidates={run.candidates_seen} proposed={run.proposed} "
        f"skipped={run.skipped} search_errors={run.search_errors}"
    )
    return 0


def _schema_check() -> int:
    """Phase 0 lint: every migration parses with Python's `sqlparse`-equivalent
    naive line scan, and every CREATE VIEW resolves table names that exist."""
    repo_root = Path(__file__).parent.parent.parent.parent.parent
    migrations = sorted((repo_root / "supabase" / "migrations").glob("*.sql"))
    table_names: set[str] = set()
    for path in migrations:
        text = path.read_text(encoding="utf-8")
        for line in text.splitlines():
            ll = line.strip().lower()
            if ll.startswith("create table if not exists public."):
                table_names.add(ll.split(".", 1)[1].split(" ", 1)[0].rstrip(" ("))

    print(f"# schema-check — found {len(table_names)} tables across {len(migrations)} migrations")
    for t in sorted(table_names):
        print(f"  - {t}")
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
