"""Discovery worker — orchestrates the seasonal cron loop (plan §E.4).

In production:
  pg_cron triggers every 10 minutes →
    Edge Function dispatches → workers/discovery_worker.py runs against
    the VPS-installed Python venv.

In Phase 0 we run the same code path against fixtures so the loop is
proven end-to-end before any live polling happens.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Iterable
from uuid import UUID, uuid4

import asyncpg

from .._adapter_base_alias import SourceAdapter  # type: ignore[attr-defined]
from ..discovery.change_detection import (
    ChangeFinding,
    PriorAnnouncementSnapshot,
    detect_change,
)
from ..discovery.classifier import classify
from ..discovery.models import Announcement, CrawlRunSummary
from ..discovery.registry import (
    RegistrySource,
    jittered_next_poll_at,
    next_interval_minutes,
    reschedule,
)

log = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class DiscoveryRun:
    """One adapter pass, summarized for telemetry + crawl_runs writeback."""

    source: RegistrySource
    summary: CrawlRunSummary
    findings: list[tuple[Announcement, ChangeFinding]]


async def run_one_source(
    *,
    source: RegistrySource,
    adapter: SourceAdapter,
    prior_snapshots: dict[str, PriorAnnouncementSnapshot],
    since: datetime | None = None,
) -> DiscoveryRun:
    """Run one source's adapter, classify + diff its posts, return findings.

    `prior_snapshots` is keyed by `external_post_id` and is provided by the
    caller (loaded from the `announcements` table in production; built from
    fixtures in tests).
    """
    started = datetime.now(tz=timezone.utc)
    since = since or _default_since(source)

    seen = 0
    new_count = 0
    changed_count = 0
    findings: list[tuple[Announcement, ChangeFinding]] = []
    error_text: str | None = None
    status: str = "succeeded"
    http_status: int | None = None

    try:
        announcements = await adapter.list_recent_posts(since)
    except Exception as exc:  # pragma: no cover — guarded for ops
        announcements = []
        status = "failed"
        error_text = repr(exc)
        log.exception("adapter.list_recent_posts failed for %s", source.url_ko)

    for ann in announcements:
        seen += 1
        cls = classify(ann)
        prior = prior_snapshots.get(ann.external_post_id)
        finding = detect_change(ann, prior)
        if finding.finding_type == "new_post":
            new_count += 1
        elif finding.finding_type != "noop":
            changed_count += 1
        if finding.finding_type != "noop":
            findings.append((ann, finding))
        log.info(
            "discovery hit",
            extra={
                "source_id": str(source.id),
                "title": ann.title_ko[:80],
                "label": cls.label,
                "finding": finding.finding_type,
            },
        )

    ended = datetime.now(tz=timezone.utc)
    summary = CrawlRunSummary(
        source_id=source.id,
        started_at=started,
        ended_at=ended,
        status=status,
        http_status_code=http_status,
        error_text=error_text,
        records_seen=seen,
        records_new=new_count,
        records_changed=changed_count,
    )
    return DiscoveryRun(source=source, summary=summary, findings=findings)


async def write_run_to_db(
    conn: asyncpg.Connection,
    run: DiscoveryRun,
    *,
    rand: float = 0.5,
) -> None:
    """Persist crawl_runs + crawl_findings + announcement upserts.

    Idempotent on `(source_id, external_post_id)` for announcements.
    """
    crawl_run_id = uuid4()
    await conn.execute(
        """
        insert into public.crawl_runs (
          id, source_id, started_at, ended_at, status,
          http_status_code, error_text, records_seen,
          records_new, records_changed
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        """,
        crawl_run_id,
        run.summary.source_id,
        run.summary.started_at,
        run.summary.ended_at,
        run.summary.status,
        run.summary.http_status_code,
        run.summary.error_text,
        run.summary.records_seen,
        run.summary.records_new,
        run.summary.records_changed,
    )

    for ann, finding in run.findings:
        # Persist the actual classifier verdict. Historically this inserted
        # the literal "unknown", so the fetch stage had no signal for which
        # posts are admission guidelines. classify() is pure, so recomputing
        # here (it also runs in run_one_source for logging) is cheap.
        cls = classify(ann)
        ann_id = await conn.fetchval(
            """
            insert into public.announcements (
              source_id, external_post_id, title_ko, url_ko,
              attachments, posted_at, classifier_label, classifier_confidence
            ) values ($1,$2,$3,$4,$5::jsonb,$6,$7,$8)
            on conflict (source_id, external_post_id) do update
              set title_ko              = excluded.title_ko,
                  url_ko                = excluded.url_ko,
                  attachments           = excluded.attachments,
                  posted_at             = excluded.posted_at,
                  classifier_label      = excluded.classifier_label,
                  classifier_confidence = excluded.classifier_confidence
            returning id
            """,
            run.source.id,
            ann.external_post_id,
            ann.title_ko,
            ann.url_ko,
            _attachments_json(ann),
            ann.posted_at,
            cls.label,
            cls.confidence,
        )
        await conn.execute(
            """
            insert into public.crawl_findings (
              crawl_run_id, announcement_id, finding_type, details
            ) values ($1, $2, $3, $4::jsonb)
            """,
            crawl_run_id,
            ann_id,
            finding.finding_type,
            _details_json(finding),
        )

    succeeded = run.summary.status == "succeeded"
    await reschedule(
        conn,
        source_id=run.source.id,
        next_in_minutes=next_interval_minutes(run.source),
        succeeded=succeeded,
    )
    _ = jittered_next_poll_at(
        next_interval_minutes(run.source),
        jitter_minutes=15,
        rand=rand,
    )  # exposed for unit tests; reschedule already wrote the value


def _default_since(_source: RegistrySource) -> datetime:
    # 24h window matches plan §E.4 default polling cadence.
    from datetime import timedelta as _td

    return datetime.now(tz=timezone.utc) - _td(days=1)


def _attachments_json(ann: Announcement) -> str:
    import json

    payload = [
        {
            "filename": a.filename,
            "url": a.url,
            "size_bytes": a.size_bytes,
            "mime": a.mime,
            "sha256": a.sha256,
        }
        for a in ann.attachments
    ]
    return json.dumps(payload, ensure_ascii=False)


def _details_json(finding: ChangeFinding) -> str:
    import json

    return json.dumps(
        {
            "finding_type": finding.finding_type,
            "priority": finding.priority,
            **finding.details,
        },
        ensure_ascii=False,
        default=str,
    )


# expose a helper for the iterator-based test runner
def iter_findings(runs: Iterable[DiscoveryRun]) -> Iterable[tuple[UUID, ChangeFinding]]:
    for run in runs:
        for _, finding in run.findings:
            yield run.source.id, finding
