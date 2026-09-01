"""Keyless Claude backend — shell out to the local `claude` CLI.

When `UNI_DB_LLM_BACKEND=claude_cli`, extraction and verification route their
Claude calls through the `claude` CLI instead of the Anthropic API. The CLI
authenticates via the running Claude Code session's subscription, so the whole
crawl pipeline runs with NO `ANTHROPIC_API_KEY` and no per-token bill — the
intended mode when the nightly crawl runs inside a Claude Routine.

The CLI is invoked in non-interactive print mode with the system prompt passed
as a file (it can be large) and the user prompt on stdin (avoids ARG_MAX on long
guideline sections). `--output-format json` returns an envelope whose `result`
field holds the model's text, which callers parse exactly as they parse an API
response.

Two properties matter when this runs unattended at midnight inside a Routine:

1. STRICT single-agent — at most ONE `claude` process ever runs at a time,
   enforced both in-process (a threading lock) and across processes (an
   `fcntl` file lock). Even if two Routines fire, or the crawl agent spawns
   parallel `uni-db` subprocesses, their Claude calls are serialized so they
   can never gang up and trip the subscription's concurrency limits.

2. NON-STOP resilience — if a usage/rate limit IS hit (very likely at the
   midnight peak), the call does not abort the run. It waits and retries with
   exponential backoff for up to `claude_cli_retry_budget_sec` (default 2h),
   so the crawl "keeps going for a couple of hours" until the limit window
   resets rather than dying on the first limited call.

Caveat: each invocation is a fresh CLI session, so there is no cross-call prompt
caching (unlike the API path's ephemeral cache). That is a deliberate trade for
"no API key"; the crawl paces itself and only new guidelines are parsed.
"""

from __future__ import annotations

import contextlib
import json
import logging
import os
import subprocess
import tempfile
import threading
import time
from dataclasses import dataclass
from pathlib import Path

from ..config import settings
from ..watchdog import watchdog

log = logging.getLogger(__name__)

# LLM calls can take 60-120s for long structured extractions; give the CLI
# headroom over the API path's 120s since it also pays session-spawn overhead.
_CLI_TIMEOUT_SEC = 240.0

# Serialize every `claude` invocation process-wide so the crawl never runs two
# subscription-backed Claude calls at once — concurrent calls spike usage and
# trip rate limits. Even though the pipeline is already sequential, this is a
# hard guarantee: at most ONE `claude` subprocess runs at any moment.
# Extraction is text-in, text-out: the Korean source span is IN the prompt and
# the answer must come from it. But `claude -p` is an agent, not a completion
# endpoint — left alone it runs with its full tool set in whatever directory
# the worker happens to be in, which here is the repository.
#
# It used them. Observed in a live drain, the model answered a `documents_required`
# extraction with "I looked at the actual pipeline files this prompt is drawn
# from (`src/...`)" instead of returning JSON — three of eight calls in one
# shard were retried for this. Every one of those is a wasted couple of
# minutes, and a model grounding an admissions answer in our source tree
# rather than in the 모집요강 is a correctness problem, not just a slow one.
#
# The list is explicit because nothing else works: `--tools ""` and
# `--allowed-tools ""` were both probed against this CLI (2.1.234) and left
# every tool enabled — only `--disallowed-tools <names>` actually blocks them.
# It is therefore a DENYLIST, with a denylist's failure mode: a tool added to
# a future CLI is not covered. Keep it a superset of what
# `claude -p "list your built-in tools"` reports; the unparseable-response
# retry is the backstop if one slips through.
_DISALLOWED_TOOLS: tuple[str, ...] = (
    "Agent", "Artifact", "Bash", "BashOutput", "Edit", "Glob", "Grep",
    "KillBash", "ListAgents", "ListMcpResourcesTool", "Monitor", "MultiEdit",
    "NotebookEdit", "Read", "ReadMcpResourceTool", "ReadNotifications", "REPL",
    "ReportFindings", "ScheduleWakeup", "SendUserFile",
    "ShowOnboardingRolePicker", "Skill", "SuggestSkills", "Task", "TodoWrite",
    "Tmux", "ToolSearch", "WebFetch", "WebSearch", "Workflow", "Write",
)

_CLI_LOCK = threading.Lock()

# In-process side of the semaphore, built once per concurrency value. Cached
# because `_cli_serialized` reads the setting on every call and a fresh
# semaphore each time would enforce nothing at all.
_CLI_SEMAPHORES: dict[int, threading.BoundedSemaphore] = {}
_CLI_SEM_GUARD = threading.Lock()


def _sem_for(slots: int) -> threading.BoundedSemaphore:
    with _CLI_SEM_GUARD:
        sem = _CLI_SEMAPHORES.get(slots)
        if sem is None:
            sem = threading.BoundedSemaphore(slots)
            _CLI_SEMAPHORES[slots] = sem
        return sem

# Cross-process serialization. The threading lock above only covers one Python
# process; if the crawl agent spawns two `uni-db` subprocesses (or two Routines
# fire), each has its own threading lock and they could still call `claude`
# concurrently. This flock-based lock makes "one at a time" strict across every
# process on the host that uses this backend.
_CLI_LOCKFILE = Path(tempfile.gettempdir()) / "uni_db_claude_cli.lock"

# Usage-limit retry pacing. First wait is short; back off exponentially up to a
# cap so we probe periodically without hammering during a limit window. The
# total budget comes from settings (default 2h).
_CLI_RETRY_BASE_SLEEP_SEC = 60.0
_CLI_RETRY_MAX_SLEEP_SEC = 15 * 60.0

# Substrings (case-insensitive) that mark a *transient* usage/rate/capacity
# limit — retryable. Matched only against error output (nonzero exit or an
# is_error envelope), never against successful result text.
_USAGE_LIMIT_MARKERS = (
    "usage limit",
    "rate limit",
    "rate_limit",
    "rate-limit",
    "429",
    "overloaded",
    "limit reached",
    "reset at",
    "try again later",
    "temporarily unavailable",
    "capacity",
    "too many requests",
    "quota",
    "please wait",
)


@dataclass(frozen=True, slots=True)
class CliCallResult:
    """One successful `claude` CLI call: the model's text plus the token usage
    the CLI reports in its JSON envelope (Phase 2 — usage was previously
    discarded, so extraction_jobs rows from the CLI lane all showed 0 tokens)."""

    text: str
    input_tokens: int = 0
    output_tokens: int = 0
    cached_input_tokens: int = 0
    cache_write_tokens: int = 0


class ClaudeCliError(RuntimeError):
    """The `claude` CLI failed, timed out, or returned an error envelope."""


class _UsageLimitError(ClaudeCliError):
    """A transient subscription usage/rate limit — retry after a wait."""


def _cli_model(model: str) -> str:
    """Map an Anthropic model id to a CLI `--model` alias.

    The CLI accepts short aliases (`sonnet`/`haiku`/`opus`) which are stable
    across model versions; full ids drift. Fall back to sonnet.
    """
    m = (model or "").lower()
    if "haiku" in m:
        return "haiku"
    if "opus" in m:
        return "opus"
    return "sonnet"


def _envelope_reason(text: str) -> str | None:
    """The human-readable reason out of a CLI JSON envelope, if that is what
    `text` is. Returns None for anything that is not such an envelope, so the
    caller can fall back to the raw output."""
    stripped = (text or "").strip()
    if not stripped.startswith("{"):
        return None
    try:
        envelope = json.loads(stripped)
    except json.JSONDecodeError:
        return None
    if not isinstance(envelope, dict):
        return None
    for key in ("result", "error", "message"):
        value = envelope.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _is_usage_limit(text: str) -> bool:
    """True if error output looks like a transient usage/rate/capacity limit."""
    low = (text or "").lower()
    return any(marker in low for marker in _USAGE_LIMIT_MARKERS)


def _slot_paths(slots: int) -> list[Path]:
    """One lock file per concurrency slot.

    Slot 0 keeps the original filename so a process running at concurrency 1
    still contends with an older process that predates this setting, rather
    than silently running beside it.
    """
    if slots <= 1:
        return [_CLI_LOCKFILE]
    return [_CLI_LOCKFILE] + [
        _CLI_LOCKFILE.with_name(f"{_CLI_LOCKFILE.name}.{i}") for i in range(1, slots)
    ]


@contextlib.contextmanager
def _cli_serialized():
    """Hold one of the N concurrency slots for the duration of a CLI call.

    At the default concurrency of 1 this is the original behaviour: one
    threading lock, one exclusive file lock, at most one `claude` subprocess
    anywhere on the host.

    Above 1 the single lock becomes a counting semaphore. In-process that is
    `BoundedSemaphore`; across processes it is a POOL of lock files, each
    tried non-blocking in turn — the first one that is free is this call's
    slot. Polling rather than blocking on a chosen file is deliberate:
    blocking on one file would queue behind whoever holds it while another
    slot sat idle. A quarter-second poll is free next to calls that run for
    minutes.

    The `fcntl` file lock is best-effort: on platforms without it (non-Unix),
    the in-process semaphore alone limits concurrency.
    """
    slots = max(1, int(getattr(settings, "claude_cli_concurrency", 1) or 1))
    sem = _sem_for(slots)
    sem.acquire()
    try:
        try:
            import fcntl
        except ImportError:  # pragma: no cover — Unix-only sandbox in practice
            yield
            return
        paths = _slot_paths(slots)
        while True:
            for path in paths:
                # `continue` and `return` both leave the `with`, so the handle
                # is closed on every path out — including the one where this
                # slot was already taken.
                with open(path, "w") as lock_fh:
                    try:
                        fcntl.flock(lock_fh, fcntl.LOCK_EX | fcntl.LOCK_NB)
                    except OSError:
                        continue
                    try:
                        yield
                        return
                    finally:
                        fcntl.flock(lock_fh, fcntl.LOCK_UN)
            time.sleep(0.25)
    finally:
        sem.release()


def _envelope_usage(envelope: dict) -> dict[str, int]:
    """Token counts from the CLI envelope's `usage` block (zeros if absent)."""
    usage = envelope.get("usage")
    if not isinstance(usage, dict):
        return {"input": 0, "output": 0, "cached": 0, "cache_write": 0}

    def _i(key: str) -> int:
        try:
            return int(usage.get(key) or 0)
        except (TypeError, ValueError):
            return 0

    return {
        "input": _i("input_tokens"),
        "output": _i("output_tokens"),
        "cached": _i("cache_read_input_tokens"),
        "cache_write": _i("cache_creation_input_tokens"),
    }


def _cli_env() -> dict[str, str]:
    """The environment the `claude` subprocess runs in.

    The point of this backend is stated in the module docstring: "the whole
    crawl pipeline runs with NO ANTHROPIC_API_KEY and no per-token bill". The
    subprocess inherited the parent environment, so that was only true when the
    operator happened not to have a key set — and every CI workflow here sets
    one at job level alongside UNI_DB_LLM_BACKEND=claude_cli.

    That is not a harmless leftover. Claude Code's authentication precedence
    puts ANTHROPIC_API_KEY (rank 3) above CLAUDE_CODE_OAUTH_TOKEN (rank 5),
    and for the print mode this file uses the docs are explicit: "In
    non-interactive mode (-p), the key is always used when present." So every
    `claude` call the crawl has ever made was billed to the API key, and the
    OAuth token minted with `claude setup-token` was never reached.

    The symptom that led here: from 21 Aug 2026 essentially every extraction
    job failed with "Credit balance is too low" — on BOTH backends, because
    they were both spending the same balance. The pipeline kept crawling and
    kept marking documents parsed, so reviewers were handed cards with no
    extracted data behind them.

    Stripping the key here rather than in the workflows means the guarantee
    holds however the process is launched — CI, a Claude Routine, or a laptop.
    `UNI_DB_CLAUDE_CLI_ALLOW_API_KEY=true` opts back out for anyone who really
    does want this backend on a key.
    """
    env = os.environ.copy()
    if settings.claude_cli_allow_api_key:
        return env
    if env.pop("ANTHROPIC_API_KEY", None):
        log.debug(
            "claude_cli: ANTHROPIC_API_KEY removed from the CLI environment so "
            "the subscription credential is used instead"
        )
    return env


def _one_call(cmd: list[str], user: str, timeout: float) -> CliCallResult:
    """Run the `claude` CLI once and return its result text + token usage.

    Raises `_UsageLimitError` on a transient limit (retryable) and
    `ClaudeCliError` on any other failure (fatal).
    """
    try:
        # One at a time, always — never two Claude calls concurrently, in this
        # process or any other on the host.
        with _cli_serialized():
            proc = subprocess.run(
                cmd,
                input=user,
                capture_output=True,
                text=True,
                timeout=timeout,
                env=_cli_env(),
            )
    except subprocess.TimeoutExpired as exc:
        raise ClaudeCliError(f"claude CLI timed out after {timeout:.0f}s") from exc
    except FileNotFoundError as exc:
        raise ClaudeCliError(
            f"claude CLI binary not found: {settings.claude_cli_bin!r}. "
            "Set UNI_DB_CLAUDE_CLI or run inside a Claude Code session."
        ) from exc

    if proc.returncode != 0:
        # The CLI does not reliably use stderr. The 2026-08-18 drain failed
        # 380 times with the message "claude CLI exited 1: " and nothing after
        # the colon, because the reason was on stdout — leaving the operator
        # with a broken run and no way to tell auth from a missing binary from
        # a sandbox refusal. Fall back to stdout so the record says something.
        detail = (proc.stderr or "").strip() or (proc.stdout or "").strip()
        # The CLI often exits nonzero AND prints its usual JSON envelope. In
        # that envelope the human-readable reason is `result`, and it sits
        # after a long `usage` block — so truncating the raw JSON to a few
        # hundred characters keeps the accounting and throws away the cause.
        # The 2026-08-18 failures read "...cache_read_input_tokens:0,output_
        # tokens:" and stopped, which named nothing at all.
        detail = _envelope_reason(detail) or detail
        stderr = detail[:300] or "(no output on stderr or stdout)"
        limited = _is_usage_limit(detail)
        # Phase 3 watchdog: a streak of GENUINE nonzero exits (not usage
        # limits, which self-heal via the retry loop) means the CLI is broken.
        watchdog.record_cli_exit(proc.returncode, usage_limited=limited)
        msg = f"claude CLI exited {proc.returncode}: {stderr}"
        raise (_UsageLimitError if limited else ClaudeCliError)(msg)
    watchdog.record_cli_exit(0)

    try:
        envelope = json.loads(proc.stdout)
    except json.JSONDecodeError as exc:
        raise ClaudeCliError(
            f"claude CLI output was not JSON: {(proc.stdout or '')[:200]!r}"
        ) from exc

    if envelope.get("is_error") or envelope.get("subtype") not in (None, "success"):
        detail = str(envelope.get("result"))
        msg = f"claude CLI returned error: {detail[:300]}"
        raise (_UsageLimitError if _is_usage_limit(detail) else ClaudeCliError)(msg)

    result = envelope.get("result")
    if not isinstance(result, str) or not result.strip():
        raise ClaudeCliError("claude CLI returned no result text")
    tokens = _envelope_usage(envelope)
    return CliCallResult(
        text=result,
        input_tokens=tokens["input"],
        output_tokens=tokens["output"],
        cached_input_tokens=tokens["cached"],
        cache_write_tokens=tokens["cache_write"],
    )


def run_claude_cli(
    system: str,
    user: str,
    model: str,
    *,
    timeout: float = _CLI_TIMEOUT_SEC,
) -> str:
    """Run one keyless Claude call and return the model's raw text output.

    Mirrors the API path's "(system, user, model) -> raw text" contract so the
    existing JSON-parsing/salvage logic is reused unchanged. Callers that also
    want the CLI-reported token usage use `run_claude_cli_result`.
    """
    return run_claude_cli_result(system, user, model, timeout=timeout).text


def run_claude_cli_result(
    system: str,
    user: str,
    model: str,
    *,
    timeout: float = _CLI_TIMEOUT_SEC,
) -> CliCallResult:
    """Run one keyless Claude call; return the model text + envelope token usage.

    On a transient subscription usage/rate limit the call does not abort: it
    waits (exponential backoff, capped) and retries for up to
    `settings.claude_cli_retry_budget_sec` before giving up, so a midnight limit
    does not stop the nightly crawl.
    """
    sys_file = tempfile.NamedTemporaryFile(  # noqa: SIM115 — need the path after write
        "w", suffix=".sys.txt", delete=False, encoding="utf-8"
    )
    try:
        sys_file.write(system)
        sys_file.close()
        cmd = [
            settings.claude_cli_bin,
            "-p",
            "--output-format",
            "json",
            "--model",
            _cli_model(model),
            "--append-system-prompt-file",
            sys_file.name,
            "--disallowed-tools",
            ",".join(_DISALLOWED_TOOLS),
        ]

        budget = max(0, settings.claude_cli_retry_budget_sec)
        deadline = time.monotonic() + budget
        sleep_for = _CLI_RETRY_BASE_SLEEP_SEC
        attempt = 0
        while True:
            attempt += 1
            try:
                return _one_call(cmd, user, timeout)
            except _UsageLimitError as exc:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise ClaudeCliError(
                        f"claude CLI usage-limited and retry budget "
                        f"({budget / 3600:.1f}h) exhausted after {attempt} "
                        f"attempts: {exc}"
                    ) from exc
                wait = min(sleep_for, _CLI_RETRY_MAX_SLEEP_SEC, remaining)
                log.warning(
                    "claude CLI usage-limited (attempt %d); waiting %.0fs then "
                    "retrying (%.0fs of budget left): %s",
                    attempt,
                    wait,
                    remaining,
                    exc,
                )
                time.sleep(wait)
                sleep_for = min(sleep_for * 2, _CLI_RETRY_MAX_SLEEP_SEC)
    finally:
        Path(sys_file.name).unlink(missing_ok=True)
