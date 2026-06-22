# AI Admissions Monitoring — Research Report

Deep-research synthesis on building an AI system that monitors, scrapes, extracts,
uploads, and continuously updates university admissions data + documents (모집요강).
Cross-referenced against the current Supabase Edge Functions + Gemini pipeline
(`crawl-dispatcher` → `crawl-worker`, `process-guideline`).

> Method note: web search succeeded across all 5 angles; direct page fetches were
> egress-blocked in the build environment, so confidence is capped where a claim
> rests on search extracts rather than the primary page. Each high-confidence
> claim is corroborated by ≥2 independent sources.

---

## 1. Crawling & change-detection

- **Issue conditional GETs first** — store `ETag`, send `If-None-Match`; a `304`
  means skip. ETag beats `Last-Modified` (clock-independent, sub-second). (high)
  — developer.mozilla.org/.../Conditional_requests
- **Content hash is the fallback** when no validator is offered — SHA-256 of the
  body, compared to the prior hash. (high) — zuplo.com conditional-requests
- **Raw-byte hashing produces false positives** (timestamps, ad tokens, tracking
  pixels). Prune non-content DOM (nav/header/footer/sidebar/ads/modals/scripts) and
  normalize text *before* hashing. (high) — dev.to/apify_forge change-detection
- **Adaptive scheduling beats fixed intervals**; re-visit frequency should grow
  *sub-linearly* with change rate — partially deprioritize the busiest pages
  (Cho & Garcia-Molina Poisson model). (high) — en.wikipedia.org/wiki/Web_crawler
- **Plain `fetch()` misses JS-injected content.** Prefer the page's own XHR/JSON
  API (DevTools network tab) or embedded `<script>` JSON; reserve headless
  Chromium for genuinely client-rendered pages (hundreds of MB/tab). (high)
  — scrapingbee.com/blog/scraping-javascript-rendered-web-pages

**Our pipeline:** ✅ already does DOM pruning + SHA-256 text-hash gate.
**Gaps:** ⚠️ no `ETag`/`If-None-Match` conditional GET (cheap win — skip the
fetch body entirely). ⚠️ no handling for JS-rendered portals (raw HTML only).

## 2. LLM structured extraction (Gemini & Claude)

- **Gemini schema subset is limited.** `enum`, `items`, `properties`, `required`,
  `anyOf` supported. **`additionalProperties` and OpenAPI `nullable:true` are
  problematic** — use `{"type":["string","null"]}` for optional fields. (medium)
  — ai.google.dev/gemini-api/docs/structured-output
  → *This is exactly the `field_confidence` bug we just removed.*
- **`enum` improves reliability** — always constrain closed-set fields. (high)
- **Force the call:** `toolConfig.functionCallingConfig.mode="ANY"` +
  `allowedFunctionNames` guarantees parseable JSON output. (high)
  — ai.google.dev/gemini-api/docs/function-calling
  → *Already doing this.* ✅
- **Gemini PDF:** native, up to 1000 pages, ~7MB inline / 50MB via storage,
  **~258 tokens/page** (cost ∝ page count, not text). (high)
  — ai.google.dev/gemini-api/docs/document-processing
- **Anti-hallucination:** grant permission to say "not enough information",
  restrict to provided document only, and (for long docs) require verbatim source
  quotes before analysis. (high) — platform.claude.com/.../reduce-hallucinations
- **Flash vs Claude:** Gemini 2.5 Flash wins cost + 1M context; Claude edges it on
  instruction-following precision. Hybrid: Flash for high-volume extraction,
  Claude for high-stakes. (medium)

**Our pipeline:** ✅ `mode:ANY`, forced single tool, "only explicitly present"
prompts. **Gaps:** ⚠️ consider per-field `["type","null"]` instead of dropped
fields; ⚠️ add a "source quote or null" field for cheap grounding/confidence.

## 3. Validation & human-in-the-loop review

- **Three-band threshold:** high (>~90–95%) auto-approve, mid (~70–95%) → review
  queue, low (<70%) reject/escalate. Target ~10–15% escalation rate. (high/medium)
  — cobbai.com/blog/human-in-the-loop-support-ai
- **Per-field confidence**, not just per-document — enables field-level confirm and
  a *conservative safe-override* that never degrades existing good data. (high)
  — subhajitbhar.com idp confidence-scoring
- **Validate-then-commit = schema + grounding (value appears in source) + rules
  (range/date/enum).** On failure, corrective regenerate-and-recheck, not commit or
  silent drop. (high) — guardrailsai.com
- **Audit trail needs 4 parts:** source traceability, decision+confidence record,
  human-review record (who/what), tamper-evident ordering. (high) — turbolens.io
- **Soft delete:** prefer `deleted_at` timestamp over boolean; default-filter
  deleted rows; use a **Postgres partial unique index `WHERE deleted_at IS NULL`**
  (and an environment/visibility flag) so test rows don't collide with or leak into
  production. (high) — phparch.com soft-delete unique patterns
- **Guard automation bias:** seed known-error cases, track per-reviewer override
  rates. (medium)

**Our pipeline:** ✅ `review_queue` with priority/needs_attention, validate-then-
commit (never write empty over good data), guardrails (year/fee/date), auto vs
manual `require_approval` toggle, `is_visible_on_map=false` to isolate test rows.
**Gaps:** ⚠️ confidence is per-row, not per-field; ⚠️ no source-quote grounding
check; ⚠️ partial unique index on visibility flag worth verifying.

## 4. Scheduling & resilience

- **Full Jitter backoff** `sleep=rand(0, min(cap, base·2^n))` minimizes upstream
  load — recommended default. (high) — aws.amazon.com exponential-backoff-and-jitter
- **Cap backoff at 30–60s** for transient retries; circuit breaker for sustained
  failure. (medium/high)
- **Supabase Edge limits:** 400s wall-clock, 2s CPU (excl. async I/O), 150s idle →
  504. Bounds per-invocation work. (high) — supabase.com/docs/guides/functions/limits
- **pg_cron + pg_net** is the Supabase scheduling path; sub-minute schedules need
  Postgres ≥15.1.1.61, else 1-min granularity. (high) — supabase.com/docs/guides/cron
- **Idempotency = atomic reserve:** insert key as `IN_PROGRESS` before work
  (`INSERT ... ON CONFLICT`), not check-then-write (race). (high) — serverlessland.com
- **`Promise.allSettled`** for fan-out → graceful per-task degradation. (medium)

**Our pipeline:** ✅ circuit breaker w/ exponential backoff + jitter (cap 72h),
`Promise.allSettled` fan-out, `pending→running` status lock (idempotent),
dispatcher batch sizing. **Gaps:** ⚠️ backoff cap of 72h is very long vs the 30–60s
guidance — but that's *per-site re-crawl* cooldown, not API retry, so it's
defensible; ⚠️ pg_cron schedule not yet wired (functions are manual-trigger).

## 5. Avoiding bot-blocking (ethical)

- **Obey robots.txt** + `Crawl-delay`; ~1 req / 10–15s default spacing. (high/medium)
- **Honest identifying User-Agent with contact URL/email** is the ethical default
  for a known monitoring task; a browser-spoof UA reduces blocks but is deceptive.
  (high) — developers.google.com/crawling, aws.amazon.com web-crawling best-practices
- **403 causes:** default library UA + missing browser headers (`Accept`,
  `Accept-Language`, `Accept-Encoding`, `Referer`). Send a consistent header set.
  (high) — scrapfly.io/blog/posts/403-forbidden-web-scraping
- **429:** honor `Retry-After`, exponential backoff — never retry immediately.
  (high) — firecrawl.dev 429
- **Cloudflare JS challenge** fires only on HTML views, not AJAX/API → an official
  API bypasses it cleanly; otherwise prefer API → contact owner → honest headless
  browser (not covert solvers). (medium/high)
- **Let server signals govern rate** — slow on rising latency/429/503. (high)

**Our pipeline:** ⚠️ currently sends a browser-spoof UA
(`Mozilla/5.0 (compatible; HangukUZ-AdmissionsBot/1.0)` — actually a hybrid). It
sends `Accept`/`Accept-Language` ✅ but no `Retry-After` handling and no robots.txt
check. **Gaps:** add robots.txt parsing, honor `Retry-After` on 429, add contact
info to UA.

---

## Prioritized recommendations for our pipeline

1. **(done)** Remove unsupported `additionalProperties`/`field_confidence` from
   Gemini schema — fixed in v4.
2. **High value, low effort:** add `ETag`/`If-None-Match` conditional GET before
   downloading the body (saves bandwidth + LLM calls).
3. **Honor `Retry-After` on HTTP 429** and parse robots.txt; add contact email to
   the User-Agent for ethical transparency.
4. **Per-field confidence + source-quote grounding** in the extraction schema for
   safer auto-commit and better review UX.
5. **Wire pg_cron + pg_net** to drive `crawl-dispatcher` on the configured interval
   (currently manual). Keep the `enabled` gate.
6. **Verify a partial unique index** keyed on the visibility/environment flag so
   test institutions never collide with or leak into production reads.
7. **JS-rendered portals:** detect empty extraction + JS-heavy HTML and either hit
   the underlying API or flag for a headless-browser path.

## Key sources
- Gemini structured output / function calling / PDF — ai.google.dev/gemini-api/docs
- Anthropic reduce-hallucinations — platform.claude.com/docs
- AWS exponential backoff & jitter — aws.amazon.com/blogs/architecture
- Supabase cron + function limits — supabase.com/docs/guides
- Cho & Garcia-Molina crawl freshness — en.wikipedia.org/wiki/Web_crawler
- 403/429 scraping — scrapfly.io, firecrawl.dev
- Soft-delete unique patterns — phparch.com
- HITL thresholds — cobbai.com, subhajitbhar.com
