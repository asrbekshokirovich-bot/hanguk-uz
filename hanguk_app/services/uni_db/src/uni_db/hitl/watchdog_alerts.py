"""Turn `public.pipeline_watchdog_log` (written hourly by DB-side functions
`fn_routine_supervisor`/`fn_pipeline_watchdog` via pg_cron) into a real,
already-working notification: a failed GitHub Actions run, which mails the
repo's default recipients.

2026-09-01 audit finding: the table is genuinely alive — 50 `alert_claude_
routine_stale` entries in 30 days, plus extraction-failure and sources-
overdue alerts — but nothing ever reads it. The Aug 2026 outages (a dead API
key running 18 hours across six scheduled runs; a drained subscription
balance producing zero extractions for 11 days) were both found by a human
noticing stale data days later, not by this table, even though it had
already logged the exact condition.

Routing to a paging channel (Slack/Telegram/PagerDuty) was the more
featureful option, but two real gaps ruled it out for a first pass without
a live-database change or a new secret this session cannot safely invent:
`pipeline_watchdog_log` has no "already notified" column, so a naive poller
would re-alert on every run; and the already-deployed `send-telegram` edge
function is built for staff-authenticated CRM replies inside an existing
conversation thread, not a system alert to a fixed operator chat. Failing
the scheduled GitHub Actions run instead needs no schema change and no new
secret — the three uni-db workflows already hold DB read credentials — and
converts silence into the same failure-email path the workflows' own
comments already describe as the current escalation channel.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

# Alert codes worth waking someone up for. Mirrors watchdog.py's in-process
# _FATAL_CODES plus the DB-side codes that module cannot see (routine
# staleness and source-poll overdue are computed by fn_routine_supervisor
# from table state, not from anything the Python process observes).
FATAL_ALERT_CODES = frozenset(
    {
        "alert_claude_routine_stale",
        "api_credit_balance",
        "api_auth_failure",
        "cli_failure_streak",
    }
)

# Logged but not (yet) treated as wake-someone-up: these describe a slow
# decline (stale discovery, a growing review backlog) rather than a stopped
# pipeline, and paging on every occurrence would be noisy. They still print
# in the summary as a `::warning::` so they are visible in the run log.
ADVISORY_ALERT_CODES = frozenset(
    {
        "alert_sources_overdue",
        "alert_review_backlog",
        "alert_extraction_failures",
    }
)


@dataclass(frozen=True, slots=True)
class WatchdogAlert:
    action: str
    details: dict
    created_at: datetime

    @property
    def is_fatal(self) -> bool:
        return self.action in FATAL_ALERT_CODES


def classify(alerts: list[WatchdogAlert]) -> tuple[list[WatchdogAlert], list[WatchdogAlert]]:
    """Split into (fatal, advisory). Anything not in either known set is
    treated as fatal — an unrecognised code is more likely a new alert type
    than a safe one, and 0e3c157's incident was exactly a code missing from
    the fatal set letting real failures through silently."""
    fatal, advisory = [], []
    for a in alerts:
        (advisory if a.action in ADVISORY_ALERT_CODES else fatal).append(a)
    return fatal, advisory


def format_github_annotations(alerts: list[WatchdogAlert]) -> list[str]:
    """One GitHub Actions `::error::`/`::warning::` workflow-command line per
    alert — these render as annotations on the run summary page and (for
    `::error::` on a step in a scheduled workflow) contribute to the failure
    email GitHub sends the repo's default notification recipients."""
    fatal, advisory = classify(alerts)
    lines = [
        f"::error::uni_db watchdog: {a.action} at {a.created_at.isoformat()} "
        f"— {_summarize(a.details)}"
        for a in fatal
    ]
    lines += [
        f"::warning::uni_db watchdog: {a.action} at {a.created_at.isoformat()} "
        f"— {_summarize(a.details)}"
        for a in advisory
    ]
    return lines


def _summarize(details: object) -> str:
    if isinstance(details, dict):
        parts = [f"{k}={v}" for k, v in list(details.items())[:4]]
        return ", ".join(parts) if parts else "(no detail)"
    return str(details)[:200] if details else "(no detail)"


def since_cutoff(window_minutes: int, *, now: datetime | None = None) -> datetime:
    now = now or datetime.now(timezone.utc)
    return now - timedelta(minutes=window_minutes)
