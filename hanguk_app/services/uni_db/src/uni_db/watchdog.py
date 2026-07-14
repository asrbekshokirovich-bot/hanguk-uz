"""Run-level watchdog (Phase 3): loud, deduplicated alerts for the failure
modes that silently ate whole crawl runs.

The forensic audit found runs that "succeeded" while producing mostly empty
payloads, runs that ingested stale-cycle documents, and runs that burned hours
retrying an API whose credit balance was exhausted or a CLI that exited 1 on
every call. Each of those now trips ONE loud alert (log.error, `WATCHDOG
ALERT [code]`) the first time it is detected in a run:

  empty_payload_spike      — >30% of extraction payloads in this run are empty
                             (evaluated once at least 10 payloads were seen)
  stale_document_ingested  — a document with academic_year BELOW the crawl
                             target was ingested (the identity gate should
                             make this impossible; belt-and-suspenders)
  api_credit_balance       — the Anthropic API reported a credit-balance /
                             billing error (retrying is pointless; a human
                             must top up)
  cli_failure_streak       — 3 consecutive `claude` CLI calls failed with a
                             nonzero exit that is NOT a transient usage limit
                             (usage limits self-heal and are retried by the
                             backend; a genuine-error streak means the CLI
                             itself is broken)

The module-level `watchdog` singleton is process-wide; workers feed it and a
run entry point may call `reset()` to start a fresh window. Pure Python, no
IO beyond logging — alerts are also queryable via `alerts()` so a caller can
surface them in a run summary.
"""

from __future__ import annotations

import logging
import threading
from dataclasses import dataclass

log = logging.getLogger(__name__)

# Alert thresholds.
EMPTY_PAYLOAD_ALERT_RATIO = 0.30
EMPTY_PAYLOAD_MIN_SAMPLE = 10
CLI_FAILURE_STREAK_LIMIT = 3

# Case-insensitive substrings that mark an API credit-balance/billing failure
# (e.g. "Your credit balance is too low to access the Anthropic API").
_CREDIT_BALANCE_MARKERS = (
    "credit balance",
    "credit_balance",
    "insufficient credit",
    "purchase credits",
    "billing_error",
)


@dataclass(frozen=True, slots=True)
class WatchdogAlert:
    code: str
    detail: str


class RunWatchdog:
    """Accumulates run health signals; fires each alert code at most once."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self.reset()

    def reset(self) -> None:
        """Start a fresh run window (clears counters AND fired alerts)."""
        with self._lock:
            self._payloads_total = 0
            self._payloads_empty = 0
            self._cli_streak = 0
            self._alerts: dict[str, WatchdogAlert] = {}

    def alerts(self) -> tuple[WatchdogAlert, ...]:
        with self._lock:
            return tuple(self._alerts.values())

    def _fire(self, code: str, detail: str) -> None:
        with self._lock:
            if code in self._alerts:
                return
            self._alerts[code] = WatchdogAlert(code=code, detail=detail)
        log.error("WATCHDOG ALERT [%s] %s", code, detail)

    # -- signals ------------------------------------------------------------

    def record_payload(self, *, empty: bool) -> None:
        """One extraction payload produced (succeeded lane). Alerts when the
        run's empty ratio exceeds the threshold on a meaningful sample."""
        with self._lock:
            self._payloads_total += 1
            if empty:
                self._payloads_empty += 1
            total, empties = self._payloads_total, self._payloads_empty
        if total >= EMPTY_PAYLOAD_MIN_SAMPLE and empties / total > EMPTY_PAYLOAD_ALERT_RATIO:
            self._fire(
                "empty_payload_spike",
                f"{empties}/{total} extraction payloads in this run are empty "
                f"(>{EMPTY_PAYLOAD_ALERT_RATIO:.0%}) — check the source slices "
                "and prompts before trusting the run",
            )

    def record_ingested_document(
        self, *, academic_year: int | None, target_year: int | None
    ) -> None:
        """A guideline document was ingested. academic_year below the crawl
        target should be impossible past the identity gate — alert if seen."""
        if academic_year is None or target_year is None:
            return
        if academic_year < target_year:
            self._fire(
                "stale_document_ingested",
                f"ingested a document with academic_year={academic_year} below "
                f"the crawl target {target_year} — the cycle gate was bypassed",
            )

    def record_llm_error(self, message: str) -> None:
        """An extraction/verification LLM call failed; detect credit-balance
        errors, where retrying is pointless and a human must intervene."""
        low = (message or "").lower()
        if any(marker in low for marker in _CREDIT_BALANCE_MARKERS):
            self._fire("api_credit_balance", (message or "")[:300])

    def record_cli_exit(self, returncode: int, *, usage_limited: bool = False) -> None:
        """One `claude` CLI invocation finished. A streak of genuine (non-
        usage-limit) nonzero exits means the CLI itself is broken — auth,
        binary, sandbox — and the run is burning its retry budget for nothing.
        Usage-limited exits neither count nor reset (they self-heal)."""
        with self._lock:
            if returncode == 0:
                self._cli_streak = 0
                return
            if usage_limited:
                return
            self._cli_streak += 1
            streak = self._cli_streak
        if streak >= CLI_FAILURE_STREAK_LIMIT:
            self._fire(
                "cli_failure_streak",
                f"{streak} consecutive claude CLI calls failed with a genuine "
                f"(non-usage-limit) nonzero exit — the CLI looks broken",
            )


# Process-wide singleton the workers feed.
watchdog = RunWatchdog()
