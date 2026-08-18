"""The `claude` CLI concurrency slot admits exactly N callers, never N+1.

The subscription backend serializes its calls so a crawl never spikes usage
with parallel model calls. Draining a backlog is the one case where that
guarantee costs hours, so the limit is a setting — and a setting that
silently admitted more than it promised would be worse than no setting.
"""

from __future__ import annotations

import json
import threading
import time
from pathlib import Path

import pytest

from uni_db.extract import llm_cli


@pytest.fixture
def isolated_lockfile(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Point the file locks at a private path.

    Without this the test contends with any real drain running on the same
    host — which is exactly what the lock is FOR, and exactly what makes a
    test that uses the shared path hang instead of fail.
    """
    path = tmp_path / "uni_db_claude_cli.lock"
    monkeypatch.setattr(llm_cli, "_CLI_LOCKFILE", path)
    llm_cli._CLI_SEMAPHORES.clear()
    return path


def _peak_concurrency(slots: int, callers: int = 6, hold_sec: float = 0.2) -> int:
    """Highest number of callers inside the context manager at once."""
    llm_cli._CLI_SEMAPHORES.clear()
    live = 0
    peak = 0
    guard = threading.Lock()

    def worker() -> None:
        nonlocal live, peak
        with llm_cli._cli_serialized():
            with guard:
                live += 1
                peak = max(peak, live)
            time.sleep(hold_sec)
            with guard:
                live -= 1

    threads = [threading.Thread(target=worker) for _ in range(callers)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    return peak


class TestConcurrencySlots:
    def test_default_is_one_at_a_time(
        self, isolated_lockfile: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        # The original hard guarantee must survive the setting existing: the
        # nightly crawl shares the subscription with whoever is using it.
        monkeypatch.setattr(llm_cli.settings, "claude_cli_concurrency", 1)
        assert _peak_concurrency(1) == 1

    def test_two_slots_admit_two(
        self, isolated_lockfile: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(llm_cli.settings, "claude_cli_concurrency", 2)
        assert _peak_concurrency(2) == 2

    def test_slots_are_a_ceiling(
        self, isolated_lockfile: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        # Six callers, three slots — never a fourth.
        monkeypatch.setattr(llm_cli.settings, "claude_cli_concurrency", 3)
        assert _peak_concurrency(3) == 3

    def test_every_caller_gets_through(
        self, isolated_lockfile: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        # A slot pool that leaked a lock would deadlock the rest of the run.
        monkeypatch.setattr(llm_cli.settings, "claude_cli_concurrency", 2)
        done = []
        lock = threading.Lock()

        def worker(i: int) -> None:
            with llm_cli._cli_serialized(), lock:
                done.append(i)

        threads = [threading.Thread(target=worker, args=(i,)) for i in range(8)]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=20)
        assert sorted(done) == list(range(8))


class TestSlotPaths:
    def test_slot_zero_keeps_the_original_filename(self) -> None:
        # A process that predates this setting holds the original path. If
        # slot 0 were renamed, a concurrency-1 run would sit BESIDE it rather
        # than contend with it — two `claude` calls where the guarantee says
        # one, and no test would catch it because each side is internally
        # consistent.
        paths = llm_cli._slot_paths(3)
        assert paths[0] == llm_cli._CLI_LOCKFILE

    def test_paths_are_distinct(self) -> None:
        paths = llm_cli._slot_paths(4)
        assert len(set(paths)) == 4

    def test_one_slot_is_one_path(self) -> None:
        assert llm_cli._slot_paths(1) == [llm_cli._CLI_LOCKFILE]


class TestToolsAreDisabled:
    """The extraction call must not be able to read the repository.

    `claude -p` is an agent, not a completion endpoint. Left unrestricted it
    runs with its full tool set in the worker's working directory — and in a
    live drain it did exactly that, answering an extraction with "I looked at
    the actual pipeline files this prompt is drawn from" instead of JSON.
    Three of eight calls in one shard were retried for it.
    """

    def test_command_disables_tools(self, monkeypatch: pytest.MonkeyPatch) -> None:
        seen: dict[str, list[str]] = {}

        def fake_one_call(cmd, user, timeout):
            seen["cmd"] = cmd
            raise llm_cli.ClaudeCliError("stop here — the command is what we assert on")

        monkeypatch.setattr(llm_cli, "_one_call", fake_one_call)
        monkeypatch.setattr(llm_cli.settings, "claude_cli_retry_budget_sec", 0)
        with pytest.raises(llm_cli.ClaudeCliError):
            llm_cli.run_claude_cli_result("sys", "user", "claude-sonnet-4-6")

        cmd = seen["cmd"]
        assert "--disallowed-tools" in cmd, cmd
        blocked = set(cmd[cmd.index("--disallowed-tools") + 1].split(","))
        # The ones that would actually reach the repository or the network.
        for tool in ("Bash", "Read", "Glob", "Grep", "Write", "Edit", "WebFetch"):
            assert tool in blocked, f"{tool} is not blocked"

    def test_denylist_has_no_blank_entries(self) -> None:
        # A stray empty string would render as ",," and could be read as a
        # wildcard or silently dropped by the CLI's parser.
        assert all(t and t.strip() == t for t in llm_cli._DISALLOWED_TOOLS)
        assert len(set(llm_cli._DISALLOWED_TOOLS)) == len(llm_cli._DISALLOWED_TOOLS)


class TestErrorReasonIsReadable:
    """A failing CLI call must record WHY, not its token accounting.

    On 2026-08-18 every failure read:

        claude CLI exited 1: {"is_error":true,"duration_api_ms":0,...
        "cache_read_input_tokens":0,"output_tokens":

    The CLI exits nonzero and still prints its usual JSON envelope, in which
    the human-readable reason is `result` — and `result` sits AFTER a long
    `usage` block. Truncating the raw JSON kept the accounting and threw away
    the cause, which left an operator unable to tell auth from a missing
    binary from a sandbox refusal.
    """

    def test_reason_is_lifted_out_of_the_envelope(self) -> None:
        envelope = json.dumps({
            "is_error": True,
            "duration_api_ms": 0,
            "usage": {"input_tokens": 0, "cache_read_input_tokens": 0},
            "result": "Invalid API key · Please run /login",
        })
        assert llm_cli._envelope_reason(envelope) == "Invalid API key · Please run /login"

    def test_falls_back_through_other_key_names(self) -> None:
        assert llm_cli._envelope_reason('{"error": "boom"}') == "boom"
        assert llm_cli._envelope_reason('{"message": "boom"}') == "boom"

    def test_plain_text_is_left_alone(self) -> None:
        # Not an envelope — the caller must keep using the raw output.
        assert llm_cli._envelope_reason("command not found: claude") is None
        assert llm_cli._envelope_reason("") is None

    def test_malformed_json_is_left_alone(self) -> None:
        # Truncated output is exactly the case that produced this bug; it must
        # degrade to the raw text rather than raising.
        assert llm_cli._envelope_reason('{"is_error":true,"usage":{"in') is None

    def test_envelope_without_a_reason_is_left_alone(self) -> None:
        assert llm_cli._envelope_reason('{"is_error": true, "usage": {}}') is None
