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

Caveat: each invocation is a fresh CLI session, so there is no cross-call prompt
caching (unlike the API path's ephemeral cache). That is a deliberate trade for
"no API key"; the crawl paces itself and only new guidelines are parsed.
"""

from __future__ import annotations

import json
import logging
import subprocess
import tempfile
from pathlib import Path

from ..config import settings

log = logging.getLogger(__name__)

# LLM calls can take 60-120s for long structured extractions; give the CLI
# headroom over the API path's 120s since it also pays session-spawn overhead.
_CLI_TIMEOUT_SEC = 240.0


class ClaudeCliError(RuntimeError):
    """The `claude` CLI failed, timed out, or returned an error envelope."""


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


def run_claude_cli(
    system: str,
    user: str,
    model: str,
    *,
    timeout: float = _CLI_TIMEOUT_SEC,
) -> str:
    """Run one keyless Claude call and return the model's raw text output.

    Mirrors the API path's "(system, user, model) -> raw text" contract so the
    existing JSON-parsing/salvage logic is reused unchanged.
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
        ]
        try:
            proc = subprocess.run(
                cmd,
                input=user,
                capture_output=True,
                text=True,
                timeout=timeout,
            )
        except subprocess.TimeoutExpired as exc:
            raise ClaudeCliError(f"claude CLI timed out after {timeout:.0f}s") from exc
        except FileNotFoundError as exc:
            raise ClaudeCliError(
                f"claude CLI binary not found: {settings.claude_cli_bin!r}. "
                "Set UNI_DB_CLAUDE_CLI or run inside a Claude Code session."
            ) from exc
    finally:
        Path(sys_file.name).unlink(missing_ok=True)

    if proc.returncode != 0:
        raise ClaudeCliError(
            f"claude CLI exited {proc.returncode}: {(proc.stderr or '')[:300]}"
        )
    try:
        envelope = json.loads(proc.stdout)
    except json.JSONDecodeError as exc:
        raise ClaudeCliError(
            f"claude CLI output was not JSON: {(proc.stdout or '')[:200]!r}"
        ) from exc

    if envelope.get("is_error") or envelope.get("subtype") not in (None, "success"):
        raise ClaudeCliError(f"claude CLI returned error: {str(envelope.get('result'))[:300]}")
    result = envelope.get("result")
    if not isinstance(result, str) or not result.strip():
        raise ClaudeCliError("claude CLI returned no result text")
    return result
