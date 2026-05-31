# Supabase Key Migration — Rollout Runbook

**Goal:** move every Edge Function off the legacy `SUPABASE_SERVICE_ROLE_KEY` /
`SUPABASE_ANON_KEY` (which stop working when legacy JWT API keys are disabled) and onto
the new API keys — **with zero downtime** — so the leaked legacy `service_role` key can
finally be disabled.

## What this PR changed (code only — nothing is deployed)

Every function now reads its key with a fallback:

```ts
(Deno.env.get('SB_SECRET_KEY')      ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))  // admin
(Deno.env.get('SB_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY'))          // anon
```

- **Before** you set `SB_SECRET_KEY` / `SB_PUBLISHABLE_KEY`: functions use the OLD keys exactly as before — **no behavior change.**
- **After** you set them: functions use the NEW keys.
- **Unset** them: functions instantly fall back to the old keys. ← this is the safety net.

## The two values to set

| Secret name | Value |
| --- | --- |
| `SB_SECRET_KEY` | a **new** Secret key (`sb_secret_…`) from Dashboard → Settings → API Keys |
| `SB_PUBLISHABLE_KEY` | `sb_publishable_Ne64VlXnQ7tWJJ1e7aQLGg_5OgQiof3` |

> We use the `SB_` prefix because Supabase reserves `SUPABASE_*` for its own injected secrets.

## Rollout — do it on `hanguk-staging` FIRST, then production

1. **Set the two function secrets** → Dashboard → Edge Functions → **Secrets**.
2. **Deploy the migrated functions.** Two groups:
   - **In this repo (37):** deploy from here (`supabase functions deploy`).
   - **NOT in this repo (deployed via Lovable) — must be migrated from their LIVE source during rollout** (Claude can do this through the Supabase tools):
     `student-login-v2`, `register-user`, `update-staff-password`, `check-student-phone`,
     `vapi-fetch-recording`, `register-push-token`, `notify-tracked-changes`,
     `export-my-data`, `translate-fields`, `diagtranslate`.
3. **Smoke-test on staging** (this is the real compatibility check — confirms the new
   `sb_secret_` key works with `auth.admin.*`):
   - Student magic-code login
   - Open a document (document-proxy)
   - Create a student / create staff
   - One AI feature (chat / interview / study-plan)
   - Upload a payment receipt
4. **Repeat steps 1–3 on production.**
5. **Watch production logs for ~a day.**
6. **Disable legacy keys** → Dashboard → Settings → API Keys → Legacy →
   **"Disable JWT-based API keys."** The leaked `service_role` is now dead.

## Rollback (any time before step 6)

- **Unset** `SB_SECRET_KEY` (functions instantly fall back to the legacy key), **or**
- re-enable legacy keys in the dashboard.

## Notes

- The web app, mobile app code, and dev scripts were already migrated in earlier commits.
- The repo is out of sync with what's deployed; always deploy functions from their
  **current live source** for the 10 functions listed above so you don't revert live fixes.
