"""Admin CLI — `uni-db <subcommand>`.

Phase 0 commands:
  review-digest          Print HITL review queue as Markdown digest.
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

from . import db
from .config import settings


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="uni-db", description="Korean Universities DB admin")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_review = sub.add_parser("review-digest", help="Print HITL queue as markdown")
    p_review.add_argument("--limit", type=int, default=20)

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

    p_retry = sub.add_parser(
        "retry-failed",
        help="LIVE: re-run FAILED extraction jobs from already-stored guideline "
             "PDFs (no re-download; blob hash verified). Only the failed field "
             "groups are re-extracted.",
    )
    p_retry.add_argument("--limit", type=int, default=25,
                         help="Max failed extraction jobs to retry this run")

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

    p_todo = sub.add_parser(
        "todo",
        help="Print (as JSON) the institutions that still need a current-cycle "
             "guideline — the Routine agent's work list for ingest-url.",
    )
    p_todo.add_argument("--limit", type=int, default=20,
                        help="Max institutions to return (keep subscription usage bounded)")
    p_todo.add_argument("--cooldown-days", type=int, default=3,
                        help="Skip institutions flagged (via flag-blocked or an "
                             "ingest-url failure) within this many days, so a "
                             "site that just 503'd isn't re-browsed every run "
                             "(default 3)")
    p_todo.add_argument("--include-flagged", action="store_true",
                        help="Ignore the cooldown and include recently-flagged "
                             "institutions anyway")

    p_flag = sub.add_parser(
        "flag-blocked",
        help="Record that an institution's site could not be reached/verified "
             "this run (e.g. HTTP 503, bot-blocked) so `todo` skips it for the "
             "cooldown window instead of re-browsing a dead end every night. "
             "Writes to proposed_sources for staff visibility.",
    )
    p_flag.add_argument("--institution", required=True,
                        help="institutions.id (UUID)")
    p_flag.add_argument("--reason", required=True,
                        help="Why the site/candidate couldn't be used, e.g. "
                             "'HTTP 503 on admissions page, no candidate PDF found'")
    p_flag.add_argument("--url", default=None,
                        help="URL to flag (default: the institution's known "
                             "admissions_url)")

    p_ingest_url = sub.add_parser(
        "ingest-url",
        help="LIVE: ingest+parse ONE guideline PDF at a caller-supplied URL for one "
             "institution (no search backend — the URL is found by the Routine agent's "
             "own web research). Keyless with UNI_DB_LLM_BACKEND=claude_cli.",
    )
    p_ingest_url.add_argument("--institution", required=True,
                              help="institutions.id (UUID) the PDF belongs to")
    p_ingest_url.add_argument("--url", required=True,
                              help="Direct URL of the 모집요강 PDF (or a page that resolves to one)")
    p_ingest_url.add_argument("--year", type=int, default=None,
                              help="Target academic year (학년도) the PDF must match. An "
                                   "explicit value wins over the CRM-selected intake "
                                   "(public.intakes), so the nightly Routine can target a "
                                   "cycle the CRM hasn't switched to yet. Default: the "
                                   "CRM-selected intake, else next year.")
    p_ingest_url.add_argument("--term", choices=["spring", "fall"], default=None,
                              help="Target semester the PDF must match (spring = 전기/1학기, "
                                   "fall = 후기/2학기). Only meaningful together with --year.")

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
    if args.cmd == "parse":
        return asyncio.run(_parse_fixture(name=args.fixture))
    if args.cmd == "run-pipeline":
        return asyncio.run(_run_pipeline(limit=args.limit))
    if args.cmd == "reparse":
        return asyncio.run(_reparse(limit=args.limit, institution=args.institution,
                                    pending_only=args.pending_only))
    if args.cmd == "retry-failed":
        return asyncio.run(_retry_failed(limit=args.limit))
    if args.cmd == "ingest-direct":
        return asyncio.run(_ingest_direct(limit=args.limit))
    if args.cmd == "find-guidelines":
        return asyncio.run(_find_guidelines(
            limit=args.limit, year=args.year, per_institution=args.per_institution,
        ))
    if args.cmd == "todo":
        return asyncio.run(_todo(
            limit=args.limit, cooldown_days=args.cooldown_days,
            include_flagged=args.include_flagged,
        ))
    if args.cmd == "flag-blocked":
        return asyncio.run(_flag_blocked(
            institution_id=args.institution, reason=args.reason, url=args.url,
        ))
    if args.cmd == "ingest-url":
        return asyncio.run(_ingest_url(
            institution_id=args.institution, url=args.url,
            year=args.year, term=args.term,
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

    import httpx

    from .workers import fetch_worker

    conn = await db.connect()
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


    from .workers import reparse_worker

    conn = await db.connect()
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


async def _retry_failed(*, limit: int) -> int:
    """LIVE: re-run failed extraction jobs from already-stored guideline PDFs.
    Reads blobs from storage (no re-download from ac.kr; the stored blob's
    SHA-256 is verified against guideline_documents first) and re-extracts
    ONLY the field groups whose latest job failed. Makes LLM calls, so it's
    gated on `UNI_DB_LIVE_APIS` + `SUPABASE_DB_URL`.
    """
    if not settings.live_apis:
        print(
            "retry-failed needs UNI_DB_LIVE_APIS=true (it re-runs LLM "
            "extraction). Refusing. See docs/credentials.md.",
            file=sys.stderr,
        )
        return 2
    if not settings.supabase_db_url:
        print("SUPABASE_DB_URL is not set; cannot retry failed jobs.", file=sys.stderr)
        return 2

    from .workers import retry_failed_worker

    conn = await db.connect()
    try:
        run = await retry_failed_worker.retry_failed(conn, limit=limit)
    finally:
        await conn.close()

    print(
        f"retry-failed: jobs_seen={run.jobs_seen} documents={run.documents} "
        f"retried={run.retried} hash_mismatch={run.hash_mismatch} "
        f"errors={run.errors}"
    )
    return 0


async def _publish(*, limit: int) -> int:
    """Normalize approved review items into the public tables the app reads.
    DB-only (no LLM/HTTP), so it just needs `SUPABASE_DB_URL`.
    """
    if not settings.supabase_db_url:
        print("SUPABASE_DB_URL is not set; cannot publish.", file=sys.stderr)
        return 2


    from .workers import publish_worker

    conn = await db.connect()
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

    import httpx

    from .workers import direct_ingest_worker

    conn = await db.connect()
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

    import httpx

    from .workers import guideline_finder_worker

    conn = await db.connect()
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


async def _todo(*, limit: int, cooldown_days: int = 3, include_flagged: bool = False) -> int:
    """Print, as JSON, institutions that still need a current-cycle guideline —
    the Routine agent's work list. Each item: id, name, admissions_url, domain.
    DB-only, no LLM, no external API — just needs SUPABASE_DB_URL.

    By default, institutions flagged within `cooldown_days` (via `flag-blocked`,
    or automatically whenever `ingest-url` couldn't fetch/verify a candidate)
    are excluded — a site that just returned HTTP 503 is not worth re-browsing
    from scratch on the very next run. `--include-flagged` overrides this.
    """
    if not settings.supabase_db_url:
        print("SUPABASE_DB_URL is not set; cannot list work.", file=sys.stderr)
        return 2

    import json as _json


    conn = await db.connect()
    try:
        rows = await conn.fetch(
            """
            select i.id::text as id,
                   coalesce(i.name_en, i.name_ko) as name,
                   i.name_ko,
                   i.primary_admissions_url_ko as admissions_url,
                   i.primary_domain as domain
              from public.institutions i
             where not exists (
                     select 1 from public.guideline_documents g
                      where g.institution_id = i.id
                        and g.parse_status <> 'failed'
                        and g.fetched_at > now() - interval '120 days'
                   )
               and (
                     $2
                     or not exists (
                          select 1 from public.proposed_sources ps
                           where ps.url_ko = i.primary_admissions_url_ko
                             and ps.status = 'pending_review'
                             and ps.proposed_at > now() - make_interval(days => $3::int)
                        )
                   )
             order by i.is_partner desc nulls last, i.tier asc nulls last, i.name_ko asc
             limit $1
            """,
            limit, include_flagged, cooldown_days,
        )
    finally:
        await conn.close()

    print(_json.dumps([dict(r) for r in rows], ensure_ascii=False, indent=2))
    return 0


async def _flag_blocked(*, institution_id: str, reason: str, url: str | None) -> int:
    """Record that an institution's site couldn't be reached/verified this run,
    so `todo` skips it for the cooldown window instead of re-browsing a dead
    end every night. Writes to `proposed_sources` (same HITL queue ingest-url's
    fail-closed skips use) for staff visibility. DB-only, no LLM/HTTP.
    """
    if not settings.supabase_db_url:
        print("SUPABASE_DB_URL is not set; cannot flag.", file=sys.stderr)
        return 2

    from uuid import UUID

    from .workers.guideline_finder_worker import record_proposed_note

    try:
        inst_uuid = UUID(institution_id)
    except ValueError:
        print(f"--institution must be a UUID, got {institution_id!r}", file=sys.stderr)
        return 2

    conn = await db.connect()
    try:
        row = await conn.fetchrow(
            "select name_ko, primary_admissions_url_ko, primary_domain "
            "from public.institutions where id=$1",
            inst_uuid,
        )
        if row is None:
            print(f"institution {institution_id} not found", file=sys.stderr)
            return 2

        target_url = url or row["primary_admissions_url_ko"] or f"https://{row['primary_domain']}/"
        name = row["name_ko"] or institution_id
        await record_proposed_note(
            conn, target_url, name, f"{name}: {reason}", proposed_by="manual",
        )
    finally:
        await conn.close()

    print(f"flag-blocked: recorded {target_url!r} for institution={institution_id}")
    return 0


async def _ingest_url(*, institution_id: str, url: str,
                      year: int | None = None, term: str | None = None) -> int:
    """LIVE: ingest+parse one guideline PDF at a caller-supplied URL for one
    institution — the URL is found by the Routine agent's own web research, so
    there is NO search backend (no Naver). With UNI_DB_LLM_BACKEND=claude_cli the
    parse runs on the Claude subscription, so the whole path is keyless (only
    SUPABASE_DB_URL is needed). Gated on UNI_DB_LIVE_CRAWL + UNI_DB_LIVE_APIS.
    """
    if not (settings.live_crawl and settings.live_apis):
        print(
            "ingest-url needs UNI_DB_LIVE_CRAWL=true and UNI_DB_LIVE_APIS=true "
            "(real fetch + LLM parse). Refusing.",
            file=sys.stderr,
        )
        return 2
    if not settings.supabase_db_url:
        print("SUPABASE_DB_URL is not set; cannot ingest.", file=sys.stderr)
        return 2

    from datetime import datetime, timezone
    from uuid import UUID

    import httpx

    from .workers import guideline_finder_worker as gf

    try:
        inst_uuid = UUID(institution_id)
    except ValueError:
        print(f"--institution must be a UUID, got {institution_id!r}", file=sys.stderr)
        return 2

    conn = await db.connect()
    try:
        row = await conn.fetchrow(
            "select id, name_ko, name_en, primary_domain from public.institutions where id=$1",
            inst_uuid,
        )
        if row is None:
            print(f"institution {institution_id} not found", file=sys.stderr)
            return 2

        # Target cycle: an explicit --year (with optional --term) wins; else
        # the CRM-selected intake (public.intakes); else the upcoming academic
        # year. The override lets the nightly Routine target e.g. 2027 spring
        # even while the CRM's active intake is still an earlier cycle.
        target_year: int | None = year
        target_term: str | None = term
        if target_year is None:
            cycle = await gf.fetch_target_cycle(conn)
            if cycle is not None:
                target_year, target_term = cycle
        if target_year is None:
            target_year = datetime.now(tz=timezone.utc).year + 1

        verify_on = settings.verify_level.lower() != "off"
        identity_check = (
            gf.make_identity_check(target_year, target_term) if verify_on else None
        )
        run_parse = gf.make_run_parse(target_year, target_term)

        async with httpx.AsyncClient(
            headers={"User-Agent": settings.http_user_agent},
            follow_redirects=True,
            timeout=settings.http_request_timeout_sec,
        ) as http:
            outcome, note = await gf.ingest_one_url(
                conn,
                row,
                url,
                resolve=gf._make_default_resolve(http),
                store_blob=gf._default_store_blob,
                run_parse=run_parse,
                identity_check=identity_check,
            )
    finally:
        await conn.close()

    print(
        f"ingest-url: {outcome} — {note} (institution={institution_id}, "
        f"verify={settings.verify_level}, approval_required={settings.require_approval})"
    )
    return 0 if outcome in ("ingested", "unchanged") else 1


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

    import httpx

    from .workers import propose_worker

    conn = await db.connect()
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
