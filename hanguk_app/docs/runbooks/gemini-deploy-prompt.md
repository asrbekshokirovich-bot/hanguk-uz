# Gemini deploy prompt — uni_db Phase 2/3 production cutover

> Copy everything between the `=== BEGIN PROMPT ===` and `=== END PROMPT ===`
> markers below into Gemini 3.1 Pro. The prompt is fully self-contained:
> Gemini does not need access to this conversation. The prompt assumes
> Gemini has secret-handling access (Supabase tokens, prod DB URLs,
> Edge Function secrets, Hetzner API tokens, Apple/Firebase service
> account JSONs).
>
> **Before pasting:** sanity-check that `claude/vigorous-haibt-f28e2d`
> is the active branch and the working tree is clean apart from the
> intentional Flutter plugin auto-gen edits. Gemini should not touch
> those.

---

=== BEGIN PROMPT ===

You are operating as the deployment agent for the Hanguk uni_db
project. The codebase is local at
`C:\Users\User\Desktop\Hanguk\.claude\worktrees\vigorous-haibt-f28e2d`,
on branch `claude/vigorous-haibt-f28e2d`. All Phase 2 + Phase 3
source code is already committed; your job is to take it from "code
on disk" to "running in production."

You have full secret-handling authorisation for this task. Read
secrets from environment variables, ask the user for any you don't
have, and write them to the appropriate secret stores (Supabase
project secrets, `/etc/uni_db/env` on the Hetzner VPS, etc.).

## Repo references

| Project | Ref | Region |
|---|---|---|
| Hanguk 2026 (production) | `lysjdtyanhdfphqyijsr` | ap-northeast-2 (Seoul) |
| hanguk-staging | `nhjzbjzhmugcmzchzxlv` | ap-northeast-2 (Seoul) |

| Tool | Path |
|---|---|
| Supabase CLI | `C:\Users\User\AppData\Local\Programs\Supabase\supabase.exe` |
| pg_dump 17.6 | `C:\Users\User\AppData\Local\Programs\PostgreSQL17\pgsql\bin\pg_dump.exe` |
| Python 3.12 | `C:\Users\User\AppData\Local\Programs\Python\Python312\python.exe` |
| Project venv | `services\uni_db\.venv\` (already populated) |

## Hard constraints

1. **DO NOT** push the branch to git remote. The user will review and
   push manually.
2. **DO NOT** open a PR.
3. **DO NOT** merge into `main`.
4. **DO NOT** delete or alter any commit on the branch.
5. **DO NOT** touch the seven `linux/`, `macos/`, `windows/` Flutter
   plugin auto-gen files that show as modified in `git status`. Those
   are pre-existing local generations and stay out of every commit.
6. Follow the staging-first rule: every migration applies to staging
   and gets smoke-tested before prod.
7. If a step fails, stop and report. Don't try to "fix forward" past
   an error — the user is on standby for ambiguous calls.

## Phase A — Real production schema baseline

The file `supabase\migrations\00000000000001_lovable_baseline.sql`
is currently a minimal staging shim (creates only `public.profiles`).
Replace it with a real `pg_dump` of the production schema.

1. Ask the user for the production database URL. Wording: "Paste the
   production DB URL from Supabase Dashboard → Hanguk 2026 → Settings
   → Database → Connection string → URI → Direct connection. The
   value will be used once for `pg_dump` and not stored to disk
   unless you tell me otherwise."
2. Run:
   ```powershell
   & "C:\Users\User\AppData\Local\Programs\PostgreSQL17\pgsql\bin\pg_dump.exe" `
     "<prod-db-url>" `
     --schema=public `
     --schema-only `
     --no-owner `
     --no-privileges `
     --no-comments `
     > supabase\migrations\00000000000001_lovable_baseline.sql.candidate
   ```
3. Sanitize the candidate file:
   - Strip every `ALTER … OWNER TO …;`
   - Strip every `COMMENT ON ROLE …;`
   - Strip every `GRANT … TO postgres;` for cluster-level roles (table-level grants stay)
   - Strip session-only `SET` statements outside `set local search_path`
   - Strip `SELECT pg_catalog.set_config(...)` lines
   - Verify the result starts with `CREATE EXTENSION IF NOT EXISTS pgcrypto;` and contains the existing tables: `profiles`, `payments`, `scheduled_payments`, `university_documents`, `interview_sessions`, `interview_messages`, `documents`, `student_suggestions`, `university_rooms`, `room_channels`, `channel_messages`, `university_events`, `system_settings`, `app_versions`. If any are missing, stop and report.
4. Replace the shim:
   ```powershell
   Move-Item -Force `
     supabase\migrations\00000000000001_lovable_baseline.sql.candidate `
     supabase\migrations\00000000000001_lovable_baseline.sql
   ```
5. Restore the six pre-existing migrations from `.staging-skipped/` if
   that directory exists with its old contents. (It's the side-park
   workaround from the staging push; with a real baseline they no
   longer need to be parked.)
6. Confirm staging still pushes cleanly:
   ```powershell
   & "C:\Users\User\AppData\Local\Programs\Supabase\supabase.exe" link --project-ref nhjzbjzhmugcmzchzxlv
   & "C:\Users\User\AppData\Local\Programs\Supabase\supabase.exe" db push --linked --dry-run
   ```
   If the dry-run reports drift on staging (likely — staging has the
   shim baseline applied, prod baseline is different), reset staging:
   ```powershell
   & "C:\Users\User\AppData\Local\Programs\Supabase\supabase.exe" db reset --linked
   ```
   Then push fresh:
   ```powershell
   & "C:\Users\User\AppData\Local\Programs\Supabase\supabase.exe" db push --linked
   ```
7. Verify staging via the smoke-test SQL:
   ```powershell
   $env:SUPABASE_DB_URL = "<staging-direct-url>"
   & "C:\Users\User\AppData\Local\Programs\Supabase\supabase.exe" db remote `
     -- "$(Get-Content scripts\smoke_test_uni_db.sql -Raw)"
   ```
   Expect 16/16 checks pass (7 baseline + 9 Phase 2). If anything
   fails, stop and report the row.
8. Stage + commit the real baseline:
   ```powershell
   git add supabase\migrations\00000000000001_lovable_baseline.sql
   # If the side-park dance was undone, also git add supabase\migrations\20260505*.sql etc.
   git add supabase\migrations\MIGRATION_BASELINE_TODO.md  # to delete it
   git rm supabase\migrations\MIGRATION_BASELINE_TODO.md
   git commit -m "feat(uni_db): real prod schema baseline + remove staging shim"
   ```
9. Strike the staging-shim mentions in:
   - `services\uni_db\PHASE_2_NOTES.md` ("Real prod schema baseline still missing")
   - `services\uni_db\PHASE_3_DESIGN.md` ("Real prod schema baseline replaces the staging shim")
   - `CURRENT_STATUS.md` (the §11 in-flight item about the shim)
   - `docs\credentials.md` (the Status table row)
   Commit those edits as `docs(uni_db): mark prod baseline gate cleared`.

## Phase B — Apply migrations to staging then production

After Phase A, staging is already on the latest schema. Production
is not yet.

1. Link to production:
   ```powershell
   & "C:\Users\User\AppData\Local\Programs\Supabase\supabase.exe" link --project-ref lysjdtyanhdfphqyijsr
   ```
2. Dry-run:
   ```powershell
   & "C:\Users\User\AppData\Local\Programs\Supabase\supabase.exe" db push --linked --dry-run
   ```
   The dry-run should list every uni_db migration as pending. Expected
   migration count is 22+ (Phase 0: 13, Phase 1: 4, Phase 2: 4,
   Phase 3: 4 = 25 total minus already-on-prod baseline rows). If the
   number is wildly different, stop and report.
3. Push:
   ```powershell
   & "C:\Users\User\AppData\Local\Programs\Supabase\supabase.exe" db push --linked
   ```
4. Run the same smoke-test against prod that staging passed in Phase A.
5. Re-link to staging so subsequent steps don't accidentally hit prod:
   ```powershell
   & "C:\Users\User\AppData\Local\Programs\Supabase\supabase.exe" link --project-ref nhjzbjzhmugcmzchzxlv
   ```

## Phase C — Edge Function deploy

Three functions live under `supabase\functions\`:

- `get-pdf-url` — signed URL minting + audit log
- `notify-tracked-changes` — cron-triggered outbox drain
- `register-push-token` — token upsert

For each project ref (staging first, then prod):

1. Set the function secrets:
   ```powershell
   & "C:\Users\User\AppData\Local\Programs\Supabase\supabase.exe" secrets set `
     ANTHROPIC_API_KEY="<anthropic-key>" `
     NAVER_PAPAGO_CLIENT_ID="<papago-id>" `
     NAVER_PAPAGO_CLIENT_SECRET="<papago-secret>" `
     DEEPL_API_KEY="<deepl-key>" `
     FCM_SERVICE_ACCOUNT_JSON="$(Get-Content firebase-adminsdk.json -Raw)" `
     APNS_KEY_P8="$(Get-Content AuthKey_XXXX.p8 -Raw)" `
     APNS_KEY_ID="<key-id>" `
     APNS_TEAM_ID="<team-id>" `
     APNS_BUNDLE_ID="<bundle-id>" `
     WEB_PUSH_VAPID_PRIVATE="<vapid-private>" `
     WEB_PUSH_VAPID_PUBLIC="<vapid-public>" `
     UNI_DB_PUSH_ENABLED="false" `
     --project-ref <ref>
   ```
   Ask the user for any secret that isn't already in their environment
   or available via the Supabase Dashboard. Do not invent values. If a
   credential isn't ready (e.g. APNs key), set `UNI_DB_PUSH_ENABLED=false`
   and skip the missing-platform secrets — the function tolerates
   missing platform keys by skipping that delivery channel.

2. Deploy each function:
   ```powershell
   & "C:\Users\User\AppData\Local\Programs\Supabase\supabase.exe" functions deploy `
     get-pdf-url --project-ref <ref>
   & "C:\Users\User\AppData\Local\Programs\Supabase\supabase.exe" functions deploy `
     notify-tracked-changes --schedule '* * * * *' --project-ref <ref>
   & "C:\Users\User\AppData\Local\Programs\Supabase\supabase.exe" functions deploy `
     register-push-token --project-ref <ref>
   ```

3. Smoke test against staging only:
   - `register-push-token` — call with a fake token; verify
     `user_push_tokens` table got the row.
   - `get-pdf-url` — call with an existing document_id; verify
     response contains `signed_url` and `pdf_access_log` got an audit
     row.
   - `notify-tracked-changes` — manually insert a test row into
     `change_event_outbox`; wait one minute; verify the row's status
     flips to `sent` (or `dead` if the platform secrets are
     intentionally unset, in which case the failure path is the
     observed-correct outcome).

## Phase D — Hetzner VPS provisioning

Only proceed if the user confirms they have a Hetzner Cloud account
with a payment method. If not, stop and tell them to do that first.

1. Ask the user for the Hetzner API token (Cloud Console → Security
   → API Tokens). Treat it as secret-tier; do not log it.
2. Create the CX22:
   ```bash
   hcloud server create \
     --name uni-db-prod-1 \
     --type cx22 \
     --image ubuntu-24.04 \
     --location hel1 \
     --ssh-key uni-db-deploy \
     --label env=prod --label service=uni-db
   ```
   (`hcloud` is the Hetzner CLI; install it via `winget install Hetzner.hcloud` if missing.)
3. Wait for the server to boot (~30 seconds). Note the IPv4.
4. Run the bootstrap from `infra\bootstrap.sh` against the VPS via
   ssh. The runbook is at `docs\runbooks\hetzner-provisioning.md`.
   Follow steps 4 through 8 in order.
5. Write `/etc/uni_db/env` on the VPS using `infra\env.example` as a
   template. Ask the user for any value you can't infer.
6. Drop systemd units from `infra\systemd\` and start them.
7. Verify with `journalctl -u uni-db-extract -n 50 --no-pager` —
   expect "polling, 0 jobs" steady-state messages within 5 minutes.

## Phase E — Verification

1. Run the Python test suite locally one more time:
   ```powershell
   & ".\services\uni_db\.venv\Scripts\python.exe" -m pytest services\uni_db -q
   ```
   Expected: at least 240 tests pass (210 baseline + 13 llm_anthropic
   + new Phase 3 additions).

2. Run `flutter analyze` on the Phase 3 surfaces:
   ```powershell
   & "C:\Users\User\flutter\bin\flutter.bat" analyze `
     lib\features\uni_db\ `
     lib\core\feature_flags\
   ```
   Expected: no issues.

3. Confirm the prod Supabase project has all 25 uni_db migrations
   applied:
   ```sql
   select count(*) from supabase_migrations.schema_migrations
    where version like '20260601%' or version like '20260605%'
       or version like '20260606%' or version like '20260701%';
   ```
   Expected: 21 (13 + 4 + 4) at minimum, more if Phase 3 migrations
   landed.

4. Stage the smoke-test results and any doc edits, then commit them
   as `feat(uni_db): Phase 2 + Phase 3 deployed to production`.

## What's intentionally not in scope for this prompt

- Hiring the in-office reviewer (per ADR-005) — human action by the
  Hanguk team.
- Approving the first live `ac.kr` crawl — owner call. Set
  `UNI_DB_LIVE_CRAWL=false` everywhere until that approval lands.
- Recruiting a native Uzbek reviewer — gates Uzbek translation per
  ADR-004. Keep `UNI_DB_TRANSLATION_LANGUAGES=en`.
- Pushing the branch to git remote, merging to main, opening a PR.

## Final report format

When you're done (or you stop on an error), report:

```
Branch state:        <branch>@<sha>
Tests:               <pass>/<total>
Staging migrations:  <count> applied
Prod migrations:     <count> applied (or "not applied because <reason>")
Edge Functions:      <list>
Hetzner VPS:         <ip-or-not-provisioned>
What still needs human action: <bulleted list>
What's still mocked: <bulleted list with re-enable commands>
```

=== END PROMPT ===

---

## Operator notes (for the user, NOT pasted into Gemini)

1. Replace placeholder secret values (`<anthropic-key>`, etc.) by
   pasting them when Gemini asks. Don't pre-substitute into the
   prompt unless you're comfortable with the secret being in
   Gemini's chat history.
2. The Hetzner step is optional — if you'd rather provision manually
   following `docs/runbooks/hetzner-provisioning.md`, skip Phase D
   and tell Gemini to.
3. After Gemini finishes, run `git log --oneline -10` locally to see
   what landed. Push or merge to main on your own schedule.
