"""Claude extraction.

Plan §F.3. One call per field group with strict JSON schema mode.

Status (2026-05-08): the Anthropic SDK call site is implemented and
gated behind `settings.live_apis`. With `live_apis=False` the function
returns a deterministic mock that satisfies the schema for the calendar
group so the rest of the pipeline can be exercised end-to-end without
spending tokens. Other groups return empty-collection stubs.

When `live_apis=True` and `ANTHROPIC_API_KEY` is set, the live call
goes through. The system message (glossary + field-group prompt +
archetype few-shots + addenda) is marked `cache_control=ephemeral`
so subsequent extractions for the same archetype/field-group hit the
prompt cache (10x cheaper input tokens).

Cost (per plan §F.3): ~$1.30 per guideline at full Sonnet pricing,
materially lower with cache hits.
"""

from __future__ import annotations

import contextlib
import json
import logging
import re
import time
from dataclasses import dataclass
from typing import Any

import jsonschema
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from ..config import settings
from .normalize import normalize_output
from .prompt_assembler import GlossaryEntry, assemble_prompt
from .prune import prune_to_schema
from .schemas import FIELD_GROUP_SCHEMAS

log = logging.getLogger(__name__)


# Sonnet pricing (USD per 1M tokens) per ADR-001 / plan §F.3.
# Cache write = 1.25x input rate; cache read = 0.10x input rate.
_SONNET_INPUT_USD_PER_M = 3.00
_SONNET_OUTPUT_USD_PER_M = 15.00
_SONNET_CACHE_WRITE_USD_PER_M = _SONNET_INPUT_USD_PER_M * 1.25
_SONNET_CACHE_READ_USD_PER_M = _SONNET_INPUT_USD_PER_M * 0.10

# Strip ```json ... ``` and ``` ... ``` fences — Sonnet sometimes wraps
# JSON output despite the prompt instruction not to. The closing fence is
# OPTIONAL because long extractions occasionally hit max_tokens before the
# closing ``` is emitted; we still want to recover the body in that case.
_FENCE_RE = re.compile(
    r"^\s*```(?:json|JSON)?\s*(.*?)(?:\s*```\s*)?$",
    re.DOTALL,
)

# Fenced JSON preceded by prose ("Here is the extraction:\n```json\n{...").
# The anchored regex above misses it; this one finds the first fenced block
# anywhere in the text. Closing fence optional for the same truncation reason.
_FENCE_ANYWHERE_RE = re.compile(
    r"```(?:json|JSON)?\s*([\[{].*?)(?:\s*```|\s*$)",
    re.DOTALL,
)


@dataclass(frozen=True, slots=True)
class ExtractionResult:
    field_group: str
    parsed_output: dict[str, Any]
    raw_output: str
    llm_provider: str
    llm_model: str
    input_tokens: int
    output_tokens: int
    cost_usd: float
    latency_ms: int
    accuracy_self_score: float
    # On a failed extraction, the human-readable error (goes to the
    # extraction_jobs.error_text column, not buried in raw_output). None on
    # success.
    error_text: str | None = None
    # Key paths schema-guided pruning stripped before validation (see
    # prune.prune_to_schema). Logged onto the job; raw_output keeps the
    # unpruned model text.
    dropped_keys: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class _AnthropicCallResult:
    parsed: dict[str, Any]
    raw: str
    model: str
    input_tokens: int
    output_tokens: int
    cached_input_tokens: int
    cache_write_tokens: int
    cost_usd: float


class AnthropicResponseError(ValueError):
    """Raised when the model returns text we can't parse as JSON."""


_MOCK_OUTPUTS: dict[str, dict[str, Any]] = {
    "calendar": {
        "events": [
            {
                "event_type": "apply_open",
                "starts_at": "2026-09-01T09:00:00+09:00",
                "ends_at": None,
                "is_tentative": False,
                "notes_ko": "<mock> 모집기간 시작",
                "source_text_ko": "2026.09.01(월) 09:00 원서접수 시작",
                "extractor_confidence": 0.91,
            },
            {
                "event_type": "apply_close",
                "starts_at": "2026-09-30T17:00:00+09:00",
                "ends_at": None,
                "is_tentative": False,
                "notes_ko": "<mock> 17:00 KST 마감",
                "source_text_ko": "2026.09.30(화) 17:00까지 접수",
                "extractor_confidence": 0.92,
            },
        ]
    },
    "tuition": {"rows": []},
    "requirements": {
        "rows": [
            {
                "applicant_category": "외국인전형",
                "topik_min_level": None,
                "topik_deferred": False,
                "english_test": None,
                "gpa_floor_pct": None,
                "interview_required": False,
                "practical_exam_required": False,
                "prose_ko": "<mock requirements>",
                "source_text_ko": "<mock>",
                "extractor_confidence": 0.5,
            },
        ],
    },
    "scholarships": {"rows": []},
    "documents_required": {"rows": []},
}


def extract_field_group(
    *,
    field_group: str,
    archetype: str,
    source_text_ko: str,
) -> ExtractionResult:
    """Extract one field group from a guideline section.

    Args:
        field_group: one of `calendar | tuition | requirements |
                     scholarships | documents_required`.
        archetype: A..H (used to pick the right prompt template).
        source_text_ko: the raw text slice for this section, in Korean.

    Returns:
        ExtractionResult with `parsed_output` validated against
        FIELD_GROUP_SCHEMAS[field_group]. Raises jsonschema.ValidationError
        if the LLM output drifts.
    """
    if field_group not in FIELD_GROUP_SCHEMAS:
        raise ValueError(f"unknown field_group: {field_group}")

    started = time.monotonic()

    if not settings.live_apis:
        parsed = _MOCK_OUTPUTS[field_group]
        raw = json.dumps(parsed, ensure_ascii=False)
        log.info(
            "extract: returning mock for %s/%s (UNI_DB_LIVE_APIS=false)",
            archetype,
            field_group,
        )
        jsonschema.validate(instance=parsed, schema=FIELD_GROUP_SCHEMAS[field_group])
        latency_ms = int((time.monotonic() - started) * 1000)
        return ExtractionResult(
            field_group=field_group,
            parsed_output=parsed,
            raw_output=raw,
            llm_provider="mock",
            llm_model="mock",
            input_tokens=0,
            output_tokens=0,
            cost_usd=0.0,
            latency_ms=latency_ms,
            accuracy_self_score=_self_score(parsed),
        )

    use_cli = settings.llm_backend == "claude_cli"
    backend = _call_claude_cli if use_cli else _call_anthropic

    def _attempt(prompt_addendum: str | None):
        call = backend(
            field_group=field_group,
            archetype=archetype,
            source_text_ko=source_text_ko,
            prompt_addendum=prompt_addendum,
        )
        parsed = normalize_output(field_group, call.parsed)
        # Prune-don't-reject: strip keys the schema would refuse (logging
        # them) so one unmodelled-but-real field never fails the whole job.
        # After pruning, validation can only fail for a genuinely structural
        # problem (required core field absent / broken type).
        pruned, dropped = prune_to_schema(field_group, parsed)
        jsonschema.validate(instance=pruned, schema=FIELD_GROUP_SCHEMAS[field_group])
        return call, pruned, dropped

    # One corrective retry per failure class, with the error fed back into
    # the prompt: unparseable JSON → retry with the parse error; schema
    # validation failure after pruning → retry with the validator errors.
    try:
        call, parsed, dropped = _attempt(None)
    except AnthropicResponseError as exc:
        log.warning(
            "extract: %s/%s response unparseable (%s); retrying once with "
            "the parse error appended to the prompt",
            archetype, field_group, str(exc)[:120],
        )
        call, parsed, dropped = _attempt(_parse_retry_addendum(exc))
    except jsonschema.ValidationError as exc:
        log.warning(
            "extract: %s/%s failed schema validation (%s); retrying once "
            "with the validator errors appended to the prompt",
            archetype, field_group, exc.message[:120],
        )
        call, parsed, dropped = _attempt(_validation_retry_addendum(exc))

    if dropped:
        log.info(
            "extract: %s/%s pruned %d unmodelled key(s): %s",
            archetype, field_group, len(dropped), ", ".join(dropped[:10]),
        )

    latency_ms = int((time.monotonic() - started) * 1000)
    return ExtractionResult(
        field_group=field_group,
        parsed_output=parsed,
        raw_output=call.raw,
        llm_provider="claude_cli" if use_cli else "anthropic",
        llm_model=call.model,
        input_tokens=call.input_tokens,
        output_tokens=call.output_tokens,
        cost_usd=call.cost_usd,
        latency_ms=latency_ms,
        accuracy_self_score=_self_score(parsed),
        dropped_keys=dropped,
    )


def _parse_retry_addendum(exc: Exception) -> str:
    """Prompt suffix for the retry after an unparseable response."""
    return (
        "\n\n## RETRY — your previous response could not be parsed as JSON\n\n"
        f"Parse error: {str(exc)[:400]}\n\n"
        "Return ONLY the JSON object this time — no prose, no markdown code "
        "fences, no commentary before or after the JSON.\n"
    )


def _validation_retry_addendum(exc: jsonschema.ValidationError) -> str:
    """Prompt suffix for the retry after a schema-validation failure."""
    path = "$" + "".join(
        f"[{p}]" if isinstance(p, int) else f".{p}" for p in exc.absolute_path
    )
    return (
        "\n\n## RETRY — your previous response failed schema validation\n\n"
        f"Validator error at `{path}`: {exc.message[:400]}\n\n"
        "Fix that problem and return ONLY the corrected JSON object. Keep "
        "every other row/value you extracted unchanged.\n"
    )


def _self_score(parsed: object) -> float:
    """Job-level confidence = the MIN of the per-row confidences.

    A reviewer needs to be alerted to the *weakest* row, not an average or
    a flat constant. We scan every row (`rows`/`events`) for
    `extractor_confidence` and return the minimum; falling back to a
    root-level value, then the neutral 0.85 default, only when no per-row
    score is present.
    """
    if not isinstance(parsed, dict):
        return 0.85

    row_scores: list[float] = []
    saw_content = False
    has_content_key = False
    for key in ("rows", "events"):
        rows = parsed.get(key)
        if isinstance(rows, list):
            has_content_key = True
            if rows:
                saw_content = True
            for row in rows:
                if isinstance(row, dict) and "extractor_confidence" in row:
                    try:
                        row_scores.append(float(row["extractor_confidence"]))
                    except (TypeError, ValueError):
                        continue
    if row_scores:
        return min(row_scores)

    # Empty extraction ({"rows": []}) → 0 confidence, not the neutral default.
    # The score must mean something for triage: empty jobs were averaging
    # ~0.77, indistinguishable from real content.
    if has_content_key and not saw_content:
        return 0.0

    if "extractor_confidence" in parsed:
        try:
            return float(parsed["extractor_confidence"])  # type: ignore[arg-type]
        except (TypeError, ValueError):
            return 0.85
    return 0.85


# Anthropic completions can legitimately take 60-90s for long structured
# extractions. The 30s httpx timeout used for HTML fetches is far too tight
# for LLM calls — it was the root cause of the `requirements` field group
# timing out on every parse run. 120s gives Sonnet headroom while still
# bounding cron worker latency.
_ANTHROPIC_TIMEOUT_SEC = 120.0


def _get_client():  # pragma: no cover — exercised via monkeypatch in tests
    """Lazy-instantiate the Anthropic client.

    Factored as a function so tests can monkeypatch without importing the
    SDK. Production code path imports `anthropic` here, after the
    `settings.live_apis` gate has already passed in `extract_field_group`.
    """
    from anthropic import Anthropic

    return Anthropic(
        api_key=settings.anthropic_api_key,
        timeout=_ANTHROPIC_TIMEOUT_SEC,
    )


def _retriable_exception_types() -> tuple[type[BaseException], ...]:  # pragma: no cover
    """Return the set of Anthropic SDK exceptions worth retrying.

    Imported lazily so test environments without the SDK don't choke on
    module import. Returns a fallback if `anthropic` isn't installed.
    """
    try:
        from anthropic import (  # type: ignore[import-not-found]
            APIConnectionError,
            APITimeoutError,
            InternalServerError,
            RateLimitError,
        )

        return (APIConnectionError, APITimeoutError, InternalServerError, RateLimitError)
    except ImportError:
        return (ConnectionError, TimeoutError)


def _strip_fences(text: str) -> str:
    """Remove ```json``` / ``` markdown fences if the model wrapped output.

    Handles both a fully fenced response and a fenced block preceded by
    prose ("Here is the JSON:\\n```json\\n{...}```") — the second form was
    failing whole jobs with "response was not valid JSON; raw='```json…'".
    """
    stripped = text.strip()
    if stripped.startswith(("{", "[")):
        return stripped  # already bare JSON — don't touch fences inside strings
    match = _FENCE_RE.match(text)
    if match:
        return match.group(1).strip()
    match = _FENCE_ANYWHERE_RE.search(text)
    if match:
        return match.group(1).strip()
    return stripped


def _salvage_partial_json(text: str, field_group: str | None = None) -> dict[str, Any] | None:
    """Recover complete row/event objects from JSON truncated mid-array.

    When the model hits max_tokens it stops mid-object, so `json.loads` throws
    and the whole extraction was being discarded — even though the rows before
    the cut are perfectly good. This walks the array with brace+string matching,
    keeps every COMPLETE `{...}` object, and drops the incomplete trailing one.
    Also scans the field-group name as a key, since the model sometimes keys the
    array by it (e.g. `{"documents_required": [...]}`). Returns the array under
    its canonical wrapper (`{"rows": [...]}` / `{"events": [...]}`) or None.
    """
    keys = ["rows", "events"]
    if field_group and field_group not in keys:
        keys.append(field_group)
    wrapper = ("events" if field_group == "calendar" else "rows") if field_group else None
    for key in keys:
        marker = f'"{key}"'
        ki = text.find(marker)
        if ki == -1:
            continue
        lb = text.find("[", ki)
        if lb == -1:
            continue
        objs: list[Any] = []
        depth = 0
        obj_start: int | None = None
        in_str = False
        esc = False
        for j in range(lb + 1, len(text)):
            c = text[j]
            if in_str:
                if esc:
                    esc = False
                elif c == "\\":
                    esc = True
                elif c == '"':
                    in_str = False
                continue
            if c == '"':
                in_str = True
            elif c == "{":
                if depth == 0:
                    obj_start = j
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0 and obj_start is not None:
                    with contextlib.suppress(json.JSONDecodeError):
                        objs.append(json.loads(text[obj_start : j + 1]))
                    obj_start = None
            elif c == "]" and depth == 0:
                break
        if objs:
            return {wrapper or key: objs}
    return None


def _normalize_wrapper(parsed: dict[str, Any], field_group: str) -> dict[str, Any]:
    """The model sometimes keys the array by the field-group name
    (`{"documents_required": [...]}`) instead of the schema's wrapper
    (`{"rows": [...]}`). Remap so validation + downstream see the rows. Was
    silently failing documents_required on ~most documents."""
    wrapper = "events" if field_group == "calendar" else "rows"
    if isinstance(parsed.get(wrapper), list):
        return parsed
    if isinstance(parsed.get(field_group), list):
        out = dict(parsed)
        out[wrapper] = out.pop(field_group)
        return out
    list_keys = [k for k, v in parsed.items() if isinstance(v, list)]
    if len(list_keys) == 1 and list_keys[0] != wrapper:
        out = dict(parsed)
        out[wrapper] = out.pop(list_keys[0])
        return out
    return parsed


def _parse_extraction_output(raw: str, field_group: str) -> dict[str, Any]:
    """Parse the model's JSON output, recovering from fences / prose / truncation.

    Shared by the API and claude-CLI backends so both get identical fence
    stripping, outermost-object fallback, and mid-array salvage.
    """
    stripped = _strip_fences(raw)
    try:
        parsed: dict[str, Any] | list[Any] | None = json.loads(stripped)
    except json.JSONDecodeError:
        parsed = None
        # Prose around the JSON — recover the outermost object or the
        # outermost array (the model sometimes returns a bare rows list).
        # Whichever opener appears FIRST wins, so a bare list isn't mistaken
        # for its first row object.
        pairs = sorted(
            (("{", "}"), ("[", "]")),
            key=lambda p: (stripped.find(p[0]) == -1, stripped.find(p[0])),
        )
        for open_ch, close_ch in pairs:
            start = stripped.find(open_ch)
            end = stripped.rfind(close_ch)
            if start != -1 and end > start:
                try:
                    parsed = json.loads(stripped[start : end + 1])
                    break
                except json.JSONDecodeError:
                    parsed = None
        if parsed is None:
            salvaged = _salvage_partial_json(stripped, field_group)
            if salvaged is not None:
                log.warning(
                    "extract: %s response truncated; salvaged %d %s rows",
                    field_group,
                    len(next(iter(salvaged.values()))),
                    next(iter(salvaged.keys())),
                )
                parsed = salvaged
            else:
                raise AnthropicResponseError(
                    f"model response was not valid JSON; raw={raw[:200]!r}"
                ) from None
    # Bare top-level list → wrap under the canonical content key so both
    # shapes ({"rows": [...]} and [...]) normalize identically.
    if isinstance(parsed, list):
        wrapper = "events" if field_group == "calendar" else "rows"
        parsed = {wrapper: parsed}
    if not isinstance(parsed, dict):
        raise AnthropicResponseError(
            f"model response parsed to {type(parsed).__name__}, expected dict"
        )
    return _normalize_wrapper(parsed, field_group)


# documents_required regularly needs the most output (dozens of rows across
# applicant categories) and was the top CLI-timeout victim at 240s. Give it
# double the budget; the other groups keep the default.
_CLI_TIMEOUT_DEFAULT_SEC = 240.0
_CLI_TIMEOUT_LONG_SEC = 480.0
_CLI_TIMEOUT_LONG_GROUPS = frozenset({"documents_required", "document_checklist"})


def _cli_timeout_for(field_group: str) -> float:
    return (
        _CLI_TIMEOUT_LONG_SEC
        if field_group in _CLI_TIMEOUT_LONG_GROUPS
        else _CLI_TIMEOUT_DEFAULT_SEC
    )


def _call_claude_cli(
    *,
    field_group: str,
    archetype: str,
    source_text_ko: str,
    prompt_addendum: str | None = None,
) -> _AnthropicCallResult:
    """Keyless extraction via the `claude` CLI (subscription auth, no API key)."""
    from .llm_cli import run_claude_cli

    prompt = assemble_prompt(
        field_group=field_group,  # type: ignore[arg-type]
        archetype=archetype,
        source_text_ko=source_text_ko,
        glossary=_default_glossary(),
    )
    user = prompt.user + prompt_addendum if prompt_addendum else prompt.user
    log.info(
        "extract: calling claude CLI (subscription) for %s/%s (~%d input tokens est.)",
        archetype,
        field_group,
        prompt.estimated_input_tokens,
    )
    raw = run_claude_cli(
        prompt.system,
        user,
        settings.anthropic_model_extract,
        timeout=_cli_timeout_for(field_group),
    )
    parsed = _parse_extraction_output(raw, field_group)
    return _AnthropicCallResult(
        parsed=parsed,
        raw=raw,
        model=settings.anthropic_model_extract,
        input_tokens=0,
        output_tokens=0,
        cached_input_tokens=0,
        cache_write_tokens=0,
        cost_usd=0.0,
    )


def _compute_cost_usd(
    *,
    input_tokens: int,
    output_tokens: int,
    cached_input_tokens: int,
    cache_write_tokens: int,
) -> float:
    """Compute Sonnet billing for one call.

    Anthropic's `usage.input_tokens` reports tokens that were billed at
    the standard input rate (i.e. NOT cache-read). `cache_read_input_tokens`
    is billed separately at 10% of input rate; `cache_creation_input_tokens`
    is billed at 1.25x input rate (a one-time write cost). Output tokens
    bill at the full output rate regardless of cache state.
    """
    cost_input = input_tokens * _SONNET_INPUT_USD_PER_M / 1_000_000
    cost_output = output_tokens * _SONNET_OUTPUT_USD_PER_M / 1_000_000
    cost_cache_read = cached_input_tokens * _SONNET_CACHE_READ_USD_PER_M / 1_000_000
    cost_cache_write = cache_write_tokens * _SONNET_CACHE_WRITE_USD_PER_M / 1_000_000
    return round(cost_input + cost_output + cost_cache_read + cost_cache_write, 6)


# 2 attempts (1 retry) at 120s timeout each = max ~240s per field group
# instead of 4 attempts at 30s = 120s wasted on a hard-failing extraction.
# Real Anthropic glitches are rare; budget-bound the worst case rather
# than retrying optimistically into a timeout cliff.
@retry(
    reraise=True,
    stop=stop_after_attempt(2),
    wait=wait_exponential(multiplier=2, min=2, max=30),
    retry=retry_if_exception_type(_retriable_exception_types()),
)
def _call_anthropic(
    *,
    field_group: str,
    archetype: str,
    source_text_ko: str,
    prompt_addendum: str | None = None,
) -> _AnthropicCallResult:
    """Live Anthropic call.

    Gated by `settings.live_apis` upstream — this function itself does
    NOT re-check the flag, but it raises if the API key isn't present
    so accidental invocation in a misconfigured env fails loudly.
    """
    if not settings.anthropic_api_key:
        raise RuntimeError(
            "ANTHROPIC_API_KEY is not set; cannot call Claude. Set the "
            "key in services/uni_db/.env or unset UNI_DB_LIVE_APIS to "
            "use the deterministic mock path. See docs/credentials.md §4."
        )

    prompt = assemble_prompt(
        field_group=field_group,  # type: ignore[arg-type]
        archetype=archetype,
        source_text_ko=source_text_ko,
        glossary=_default_glossary(),
    )

    client = _get_client()

    log.info(
        "extract: calling anthropic %s for %s/%s (~%d input tokens estimated)",
        settings.anthropic_model_extract,
        archetype,
        field_group,
        prompt.estimated_input_tokens,
    )

    response = client.messages.create(
        model=settings.anthropic_model_extract,
        # 4096 truncated many-row extractions mid-JSON (scholarships/calendar),
        # which were then discarded as "invalid JSON" → data loss. 8192 fits
        # the large field groups; the salvage pass below recovers anything that
        # still truncates instead of dropping the whole job.
        max_tokens=8192,
        # Mark the system block as cacheable. The system prompt is the
        # glossary + field-group + archetype few-shots — large and stable
        # per archetype, so cache hits are common across a crawl batch.
        system=[
            {
                "type": "text",
                "text": prompt.system,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[{
            "role": "user",
            "content": prompt.user + prompt_addendum if prompt_addendum else prompt.user,
        }],
    )

    raw = _extract_text(response)
    parsed = _parse_extraction_output(raw, field_group)

    usage = response.usage
    input_tokens = int(getattr(usage, "input_tokens", 0) or 0)
    output_tokens = int(getattr(usage, "output_tokens", 0) or 0)
    cached_input_tokens = int(getattr(usage, "cache_read_input_tokens", 0) or 0)
    cache_write_tokens = int(getattr(usage, "cache_creation_input_tokens", 0) or 0)
    cost = _compute_cost_usd(
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cached_input_tokens=cached_input_tokens,
        cache_write_tokens=cache_write_tokens,
    )

    log.info(
        "extract: anthropic %s/%s done — in=%d cached=%d cache_write=%d out=%d cost=$%.5f",
        archetype,
        field_group,
        input_tokens,
        cached_input_tokens,
        cache_write_tokens,
        output_tokens,
        cost,
    )

    return _AnthropicCallResult(
        parsed=parsed,
        raw=raw,
        model=getattr(response, "model", settings.anthropic_model_extract),
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cached_input_tokens=cached_input_tokens,
        cache_write_tokens=cache_write_tokens,
        cost_usd=cost,
    )


def _extract_text(response: Any) -> str:
    """Pull the first text block from a Messages response.

    Anthropic Messages responses come back as `content: list[ContentBlock]`,
    where each block has a `type` and (for text blocks) `.text`. We expect
    a single text block; if multiple, concatenate.
    """
    content = getattr(response, "content", None)
    if not content:
        raise AnthropicResponseError("Anthropic response had no content blocks")
    parts: list[str] = []
    for block in content:
        text = getattr(block, "text", None)
        if isinstance(text, str):
            parts.append(text)
    if not parts:
        raise AnthropicResponseError(
            "Anthropic response had no text blocks (only tool/image?)"
        )
    return "".join(parts)


def _default_glossary() -> tuple[GlossaryEntry, ...]:
    """Minimal glossary used by the extractor.

    The richer glossary table (see services/uni_db/TRANSLATION_GLOSSARY.md)
    is consumed by the translation worker. The extractor only needs the
    handful of terms that show up structurally in the prompts.
    """
    return (
        GlossaryEntry(term_ko="외국인전형", term_value="외국인전형", category="applicant_category"),
        GlossaryEntry(term_ko="재외국민전형", term_value="재외국민전형", category="applicant_category"),
        GlossaryEntry(term_ko="정정공고", term_value="정정공고", category="document_type"),
        GlossaryEntry(term_ko="모집요강", term_value="모집요강", category="document_type"),
    )
