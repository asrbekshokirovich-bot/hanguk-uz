# Credentials checklist

When the user is back at the PC, this is the run-list for going from
Phase 1 file scaffolding to a live system. Every secret below maps to
an envvar in `services/uni_db/.env.example`.

> **Order matters.** Items 1–3 are needed before any migration is
> applied. Items 4–8 unlock individual integrations and can be added in
> any order.

## Status — 2026-05-08

| # | Integration | Status | Notes |
|---|---|---|---|
| 1 | Supabase (staging) | **Done** | `hanguk-staging` linked; Phase 0/1/2 migrations applied. See `supabase/.temp/`. |
| 1 | Supabase (production) | **Baseline done** (2026-05-08) | Real `pg_dump` of prod replaces the staging shim. Production migration push itself is still pending — handled by Gemini deploy prompt Phase B. |
| 2 | Cloudflare R2 | **Superseded** | [ADR-009](decisions/009-pdf-blob-access.md) replaces R2 with Supabase Storage. R2 envvars no longer needed. The `r2.py` storage backend is deprecated. |
| 3 | Hetzner VPS | Pending | Phase 3 deliverable; provisioning sketch in [`PHASE_3_DESIGN.md` §3](../services/uni_db/PHASE_3_DESIGN.md#3-hetzner-vps-provisioning). |
| 4 | Anthropic API | **Done** (2026-05-08) | Key set; budget alerts at $200/$400/$1000 per [ADR-001](decisions/001-budget-ceiling.md). Live calls still gated by `UNI_DB_LIVE_APIS=true` (off by default). |
| 5 | Naver CLOVA OCR | **Superseded** | [ADR-002](decisions/002-ocr-vendor.md) replaces Clova with EasyOCR. The Clova stub stays as a reversal-trigger fallback. |
| 5 | Naver Search | Pending | Discovery worker uses it for source proposal — Phase 3 freshness work. |
| 5 | Naver Papago | Pending | English translation primary in Phase 3. Free tier covers internal-cohort volume. |
| 6 | DeepL Pro | Optional | Not on the Phase 3 critical path; only valuable if Papago quality drops. |
| 7 | data.go.kr | Pending | Required for recruitment-unit normalisation (audit §3.3). |
| 8 | Push (FCM/APNs/VAPID) | Pending | Phase 3 deliverable — `notify-tracked-changes` Edge Function consumes these. |

The body sections below are kept verbatim from Phase 1 for reference;
where a row above says "Superseded", treat the linked ADR as the source
of truth, not the body section.

---

## 1. Supabase (production)

Needed for: applying the staged migrations; running the worker against
the live DB; CLI `uni-db review-digest`.

- Sign in to <https://supabase.com> and open the Hanguk project.
- **Settings → API**:
  - Copy `Project URL` → `SUPABASE_URL`.
  - Copy `anon` public key → `SUPABASE_ANON_KEY`.
  - Reveal `service_role` secret key → `SUPABASE_SERVICE_ROLE_KEY` (this
    bypasses RLS; never ship to the Flutter client).
- **Settings → Database** (Connection string, "Direct connection"):
  - Copy `URI` → `SUPABASE_DB_URL`. The CLI's `db dump` command uses
    this directly.
- **Database → Extensions**: enable `pgcrypto` (always), `pg_cron`
  (Phase 0 §I-Phase-0 step 5), and optionally `vector` + `pgroonga` for
  embedding search (Phase 2+; the migration handles their absence
  gracefully).

**Apply the baseline.** From a host that can reach the production DB:

```bash
supabase db dump --db-url "$SUPABASE_DB_URL" --schema public --schema-only \
  > supabase/migrations/00000000000001_lovable_baseline.sql

# Sanitize: strip ALTER OWNER, ALTER TABLE … OWNER TO, COMMENT ON ROLE.
# Then push the new uni_db migrations through staging first.
supabase db push --db-url "$STAGING_DB_URL" --dry-run
supabase db push --db-url "$STAGING_DB_URL"
# When staging passes:
supabase db push --db-url "$SUPABASE_DB_URL"
```

**Reviewer role.** After migrations apply, mark reviewer accounts via
`profiles.role='uni_db_reviewer'`:

```sql
update public.profiles set role = 'uni_db_reviewer' where user_id = '<uuid>';
```

---

## 2. Cloudflare R2 (object storage)

Needed for: immutable PDF/HWP blob storage. Until R2 is provisioned the
service writes to `./.cache/blobs/<sha256>/<sha256>` (local disk).

- Sign in to <https://dash.cloudflare.com> → R2.
- **Create bucket** named `guideline-blobs`. Region: `auto` is fine; do
  NOT make it public.
- **Manage R2 API Tokens** → "Create API token". Permissions: "Object
  Read & Write" scoped to the bucket.
  - Copy `Access Key ID` → `R2_ACCESS_KEY_ID`.
  - Copy `Secret Access Key` → `R2_SECRET_ACCESS_KEY`.
  - Copy `Account ID` (visible top-right of R2 dashboard) → `R2_ACCOUNT_ID`.
  - Endpoint URL is `https://<account-id>.r2.cloudflarestorage.com` →
    `R2_ENDPOINT`.

---

## 3. Hetzner VPS

Needed for: long-running Python worker (discovery + parse + translate),
Playwright stealth profile against bot-protected sites.

- Sign up at <https://www.hetzner.com/cloud>.
- **Create CX22 instance** (€5.83/mo, 2 vCPU, 4 GB RAM, 40 GB disk),
  Helsinki or Falkenstein region. Image: Ubuntu 24.04.
- SSH in, install Python 3.12, clone the Hanguk repo, run
  `make install` inside `services/uni_db/`.
- Set up the env from `.env.example`, then start the worker via
  `systemd` (template provided in `services/uni_db/deploy/` — TODO
  Phase 2).

---

## 4. Anthropic (Claude)

Needed for: extraction (Sonnet) + classification (Haiku) + translation
prose. Plan §F.3 budgets ~$1.30/guideline; plan §J caps total monthly
LLM spend at $200–400 in steady state.

- Sign in to <https://console.anthropic.com>.
- **Settings → API Keys** → "Create Key" with a workspace-specific
  name. Copy → `ANTHROPIC_API_KEY`.
- **Settings → Plans & Billing** → set a hard usage cap. Recommended
  Phase 1: $50/month while we tune prompts.

---

## 5. Naver Cloud (Clova OCR + Search + Papago)

Three separate APIs; one Naver Cloud Platform account covers all three.

- Sign up at <https://www.ncloud.com> (Korean account preferred; foreign
  cards work).
- **AI Services → CLOVA OCR**:
  - Create a Domain. Copy invoke URL → `NAVER_CLOVA_OCR_INVOKE_URL`.
  - Copy Secret Key → `NAVER_CLOVA_OCR_SECRET_KEY`.
- **AI Services → Search**:
  - Enable the Search API. Copy `Client ID` → `NAVER_SEARCH_CLIENT_ID`,
    `Client Secret` → `NAVER_SEARCH_CLIENT_SECRET`.
- **AI Services → Papago Translation**:
  - Enable the Papago NMT API. Copy creds →
    `NAVER_PAPAGO_CLIENT_ID` / `NAVER_PAPAGO_CLIENT_SECRET`.

---

## 6. DeepL Pro

Needed for: cheap ko↔en label translation (institution short labels,
recruitment-unit names) and ko↔ru where Papago is weak.

- Sign up at <https://www.deepl.com/pro-api>.
- Pick the "Free" tier (500k chars/mo) for development. Production
  Phase 4 may need the $25/mo plan.
- **Account → API Keys** → copy → `DEEPL_API_KEY`.

---

## 7. Korean public APIs (free)

- **data.go.kr** — register at <https://www.data.go.kr>, apply for a
  development-tier app key per dataset listed in audit §3.3.
  Copy → `DATA_GO_KR_APP_KEY`.
- **Adiga (KCUE)** — <https://www.adiga.kr>. Public open-data feed has
  no key requirement for v1; if KCUE later enables an API key, it goes
  into `ADIGA_APP_KEY`.

---

## 8. Push notifications (Phase 3)

Defer until Phase 3 work begins.

- **FCM (Android)**: Firebase Console → Project Settings → Service
  Accounts → "Generate new private key". Save JSON →
  `FCM_SERVICE_ACCOUNT_JSON` path.
- **APNs (iOS)**: Apple Developer → Certificates, Identifiers & Profiles
  → Keys → "Create" with "Apple Push Notifications service" enabled.
  - `.p8` file path → `APNS_KEY_PATH`.
  - Key ID → `APNS_KEY_ID`. Team ID → `APNS_TEAM_ID`.
- **Web push**: generate VAPID keypair via `web-push generate-vapid-keys`.
  Public → `WEB_PUSH_VAPID_PUBLIC`, private → `WEB_PUSH_VAPID_PRIVATE`.

---

## When you're done

```bash
cd services/uni_db
cp .env.example .env
# Fill the values you have so far. Anything blank stays mocked.

# Sanity:
make install
make test            # all tests should still pass
make review-digest   # prints the empty-state digest if SUPABASE_DB_URL unset

# When ready to apply migrations (in order, against staging first):
supabase db push --db-url "$STAGING_DB_URL"
```

Flip individual integrations on by setting `UNI_DB_LIVE_APIS=true` (and
`UNI_DB_LIVE_CRAWL=true` for live ac.kr fetches) once the relevant
credentials are in place.
