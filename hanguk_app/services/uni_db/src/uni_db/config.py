"""Settings loaded from env. Single source of truth — every paid call site
imports `settings` and checks `settings.live_apis` before invoking."""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # Master switches
    live_apis: bool = Field(default=False, alias="UNI_DB_LIVE_APIS")
    live_crawl: bool = Field(default=False, alias="UNI_DB_LIVE_CRAWL")
    env: str = Field(default="development", alias="UNI_DB_ENV")

    # LLM backend for extraction + verification:
    #   anthropic  — the Anthropic API (needs ANTHROPIC_API_KEY, billed per token)
    #   claude_cli — shell out to the local `claude` CLI, which authenticates via
    #                the running Claude Code session's subscription (NO api key,
    #                no per-token bill). Used when the crawl runs inside a Claude
    #                Routine so the whole pipeline stays keyless.
    llm_backend: str = Field(default="claude_cli", alias="UNI_DB_LLM_BACKEND")
    # Path/name of the claude CLI binary (claude_cli backend only).
    claude_cli_bin: str = Field(default="claude", alias="UNI_DB_CLAUDE_CLI")
    # Usage-limit resilience (claude_cli backend only). When a subscription
    # usage/rate limit is hit — most likely right at midnight when the nightly
    # crawl starts — a single `claude` call fails. Instead of aborting the whole
    # run, the CLI backend waits and retries for up to this many seconds total,
    # so the crawl "keeps going for a couple of hours" until the limit window
    # resets. Default 2h; raise via env to wait longer.
    claude_cli_retry_budget_sec: int = Field(
        default=7200, alias="UNI_DB_CLI_RETRY_BUDGET_SEC"
    )
    # How many `claude` calls may run at once (claude_cli backend only).
    # Default 1 — the original hard guarantee, and the right value for the
    # nightly crawl, which shares the subscription with whoever is using it.
    # Raise it to drain a backlog faster, understanding the trade: the
    # subscription's usage window is consumed N times as fast, so the wall
    # clock does not simply divide by N once a limit is reached. Hitting one
    # is not fatal — the backend waits out the window and resumes — but the
    # speed-up is a hope, not an arithmetic certainty.
    claude_cli_concurrency: int = Field(
        default=1, ge=1, le=8, alias="UNI_DB_CLI_CONCURRENCY"
    )

    # Database transport:
    #   postgres — asyncpg direct connection (default; needs raw TCP to 5432)
    #   http     — run SQL over HTTPS via the `db-exec` edge function. Required
    #              when the crawl runs in a Claude Routine sandbox, which only
    #              permits outbound HTTP(S) and blocks raw Postgres. Needs
    #              SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
    db_transport: str = Field(default="postgres", alias="UNI_DB_DB_TRANSPORT")

    # Auto-publish (no human review). When true (default), parse_worker
    # auto-approves every non-empty/non-failed extraction straight into
    # review_queue as `approved` — low-confidence/difficult ones flagged
    # needs_attention but still published. Set false to restore the legacy
    # human-gated behavior (only `requires_hitl` items enqueued as `open`).
    auto_publish_enabled: bool = Field(default=True, alias="UNI_DB_AUTO_PUBLISH")

    # Reliability verification gauntlet (see verify/). Controls how hard we
    # check an extraction before a human sees it:
    #   off       — no verification
    #   balanced  — deterministic grounding + sanity only (no LLM judges)
    #   thorough  — + LLM grounding judge + 3 adversarial critics
    #   maximum   — + N-way consensus re-extraction on the critical fields
    verify_level: str = Field(default="maximum", alias="UNI_DB_VERIFY_LEVEL")
    # How many independent extractions the consensus gate runs at 'maximum'.
    consensus_runs: int = Field(default=3, alias="UNI_DB_CONSENSUS_RUNS")
    # Full-document extraction (correction plan, Phase 2). When the whole
    # guideline text fits this token budget, every field group is extracted
    # against the FULL text — the fixed 12k-char section slice starved groups
    # whose data sits in appendix tables. Above the budget, the improved
    # anchor slicer (TOC-aware, prefer-last-match) kicks in.
    extract_fulldoc_token_budget: int = Field(
        default=100_000, alias="UNI_DB_FULLDOC_TOKEN_BUDGET"
    )
    # One extraction call for all five field groups (per-group JSON keys)
    # instead of five calls — opt-in; falls back to per-group on any failure.
    extract_single_call: bool = Field(
        default=False, alias="UNI_DB_EXTRACT_SINGLE_CALL"
    )
    # When true, NOTHING auto-publishes — every guideline waits in review_queue
    # for a staff member to approve. This is the human-in-front gate; it overrides
    # auto_publish for any document parsed through it.
    require_approval: bool = Field(default=True, alias="UNI_DB_REQUIRE_APPROVAL")

    # OCR provider — ADR-002 default is `easyocr` (open-source).
    # Flip to `naver_clova` if the in-office reviewer reports >6 hrs/wk
    # of OCR cleanup load sustained for 4 weeks (ADR-002 reversal trigger).
    ocr_provider: str = Field(default="easyocr", alias="UNI_DB_OCR_PROVIDER")

    # Remote document conversion (parse/convert_remote.py). The LAST tier for
    # a non-PDF guideline, after hwp5txt and LibreOffice — and on a CI runner
    # the ONLY one, because neither of those is installed there. Empty = the
    # tier is off and non-PDF payloads fail exactly as they did before.
    cloudconvert_api_key: str = Field(
        default="", alias="CLOUDCONVERT_API_KEY"
    )

    # PDF blob storage backend — ADR-009 default is `supabase_storage`.
    # `r2` kept as a fallback config knob but R2 is no longer the primary.
    blob_storage_backend: str = Field(
        default="supabase_storage", alias="UNI_DB_BLOB_STORAGE"
    )

    # Translation default-on languages.
    # ADR-004-amend-1 (2026-05-08): owner accepted the two-hop ko->en->uz
    # quality risk and authorised Uzbek translation without a native
    # reviewer. Default flipped to "en,uz".
    # ADR-004-amend-2 (2026-05-10): same risk profile accepted for
    # Vietnamese and Mongolian ahead of cohort growth. Default was
    # briefly "en,uz,vi,mn".
    # ADR-004-amend-3 (2026-05-17): owner reverted vi/mn — the
    # contracted-student cohort doesn't need either language right now,
    # and translating prose we won't surface burns Anthropic tokens for
    # no user value. Default back to "en,uz". Re-add later by setting
    # UNI_DB_TRANSLATION_LANGUAGES=en,uz,vi,mn at the env layer.
    translation_languages_enabled: str = Field(
        default="en,uz", alias="UNI_DB_TRANSLATION_LANGUAGES"
    )

    # Supabase
    supabase_url: str = Field(default="", alias="SUPABASE_URL")
    supabase_anon_key: str = Field(default="", alias="SUPABASE_ANON_KEY")
    supabase_service_role_key: str = Field(default="", alias="SUPABASE_SERVICE_ROLE_KEY")
    supabase_db_url: str = Field(default="", alias="SUPABASE_DB_URL")

    # R2
    r2_account_id: str = Field(default="", alias="R2_ACCOUNT_ID")
    r2_access_key_id: str = Field(default="", alias="R2_ACCESS_KEY_ID")
    r2_secret_access_key: str = Field(default="", alias="R2_SECRET_ACCESS_KEY")
    r2_bucket_guideline_blobs: str = Field(
        default="guideline-blobs", alias="R2_BUCKET_GUIDELINE_BLOBS"
    )
    r2_endpoint: str = Field(default="", alias="R2_ENDPOINT")

    # Anthropic
    anthropic_api_key: str = Field(default="", alias="ANTHROPIC_API_KEY")
    anthropic_model_extract: str = Field(
        default="claude-sonnet-4-6", alias="ANTHROPIC_MODEL_EXTRACT"
    )
    anthropic_model_classify: str = Field(
        default="claude-haiku-4-5", alias="ANTHROPIC_MODEL_CLASSIFY"
    )
    anthropic_model_translate: str = Field(
        default="claude-sonnet-4-6", alias="ANTHROPIC_MODEL_TRANSLATE"
    )

    # Naver
    naver_clova_ocr_invoke_url: str = Field(default="", alias="NAVER_CLOVA_OCR_INVOKE_URL")
    naver_clova_ocr_secret_key: str = Field(default="", alias="NAVER_CLOVA_OCR_SECRET_KEY")
    naver_search_client_id: str = Field(default="", alias="NAVER_SEARCH_CLIENT_ID")
    naver_search_client_secret: str = Field(default="", alias="NAVER_SEARCH_CLIENT_SECRET")
    naver_papago_client_id: str = Field(default="", alias="NAVER_PAPAGO_CLIENT_ID")
    naver_papago_client_secret: str = Field(default="", alias="NAVER_PAPAGO_CLIENT_SECRET")

    # DeepL
    deepl_api_key: str = Field(default="", alias="DEEPL_API_KEY")

    # Google PSE
    google_pse_api_key: str = Field(default="", alias="GOOGLE_PSE_API_KEY")
    google_pse_cx: str = Field(default="", alias="GOOGLE_PSE_CX")

    # Other upstreams
    data_go_kr_app_key: str = Field(default="", alias="DATA_GO_KR_APP_KEY")
    adiga_app_key: str = Field(default="", alias="ADIGA_APP_KEY")

    # HTTP defaults
    http_user_agent: str = Field(
        default="HangukUniDBBot/0.1 (+contact: ops@hanguk.example)",
        alias="HTTP_USER_AGENT",
    )
    http_request_timeout_sec: int = Field(default=30, alias="HTTP_REQUEST_TIMEOUT_SEC")
    http_per_domain_rps: float = Field(default=1.0, alias="HTTP_PER_DOMAIN_RPS")
    http_jitter_min_sec: int = Field(default=2, alias="HTTP_JITTER_MIN_SEC")
    http_jitter_max_sec: int = Field(default=15, alias="HTTP_JITTER_MAX_SEC")

    # Observability
    sentry_dsn: str = Field(default="", alias="SENTRY_DSN")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")


    @property
    def effective_verify_level(self) -> str:
        """The verify level actually used, given the LLM backend.

        On the `claude_cli` (subscription) backend, cap the reliability gauntlet
        at `balanced` — deterministic grounding + sanity only, NO LLM judges and
        NO consensus re-extraction. The heavy levels fan out ~35 nested `claude`
        calls per document, which spikes subscription usage and trips limits; the
        deterministic gates plus mandatory staff approval keep quality. `off`
        stays off. The API backend keeps the configured level unchanged.
        """
        lvl = self.verify_level.lower()
        if lvl == "off" or self.llm_backend != "claude_cli":
            return lvl
        return "balanced" if lvl in ("thorough", "maximum") else lvl


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]


settings = get_settings()
