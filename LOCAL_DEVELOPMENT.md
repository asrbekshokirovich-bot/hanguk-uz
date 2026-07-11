# Running Hanguk locally (full local backend)

This runs the **entire app on your machine** — the React frontend **and** a
complete local Supabase backend (Postgres + Auth + Storage + Edge runtime) in
Docker. No hosted/cloud project is touched; the app talks to `localhost`.

```
supabase start   →  local Postgres/Auth/Storage/Edge at  http://127.0.0.1:54321
npm run dev      →  the app at                            http://localhost:8080
```

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| **Node.js** | 18+ (20/22 recommended) | ships `npm` |
| **Docker** | running daemon | Docker Desktop on macOS/Windows; `dockerd` on Linux. Supabase runs its services as containers. |
| **Supabase CLI** | — | installed for you as a dev dependency (`npx supabase …`); no separate install needed. |

> The local stack pulls ~8 container images the first time (~2–3 GB). This needs
> unrestricted access to Docker Hub / `public.ecr.aws`. On networks that block
> those registries (some corporate proxies, and Claude Code's web sandbox) the
> image pull fails — run the stack on a normal network / your own machine. See
> [Troubleshooting](#troubleshooting).

---

## Quick start

```bash
# 1. Install dependencies
npm install
#    On a restricted network where `sharp` (the mobile-icon tool) can't fetch
#    its binary from github, use:  npm install --ignore-scripts

# 2. Start the local Supabase stack (first run pulls images, then applies all
#    migrations in supabase/migrations and the seed in supabase/seed.sql)
npm run db:start          # = supabase start

# 3. Point the frontend at the local stack (writes .env.local from the running
#    stack's real keys — no copying keys by hand)
npm run env:local

# 4. Run the app
npm run dev               # http://localhost:8080
```

Then open <http://localhost:8080> and **log in**:

```
username: owner
password: password123
```

That is a pre-seeded **owner** account with full CRM access. (See
[Logging in](#logging-in) for how it's created and how to add more users.)

---

## What's running

After `supabase start`:

| Service | URL | Purpose |
|---------|-----|---------|
| App (Vite dev server) | http://localhost:8080 | the frontend |
| Supabase API (REST/Auth/Storage/Realtime) | http://127.0.0.1:54321 | what the app talks to |
| Postgres | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` | the database |
| Studio (DB admin UI) | http://127.0.0.1:54323 | browse tables, run SQL |
| Inbucket (captured emails) | http://127.0.0.1:54324 | auth emails land here locally |

`supabase status` prints the live URLs and keys any time.

---

## Logging in

Staff sign in with a **username**, which the app maps to `${username}@hanguk.local`.

- **Seeded owner** — `supabase/seed.sql` pre-creates `owner@hanguk.local`
  (username `owner`, password `password123`) with the `owner` role, so you can
  log straight in. Change the password/username at the top of `supabase/seed.sql`
  and re-run `npm run db:reset` if you like.
- **First-run setup (no seed)** — if the seed is ever skipped, a fresh database
  has `system_settings.owner_created = false`, so opening the app shows a
  "create the first owner" screen. Create your owner there.
- **More users** — once logged in as owner, create staff (admin, call operator,
  document handler) from the CRM's staff/settings area. Students are created via
  the add-student flow and log in with a magic code.

---

## Edge functions (optional)

The 19 core/CRUD functions (create-staff, create-student, student-login,
guest-auth, document-proxy, …) work with only the local Supabase keys, which the
CLI injects automatically. The other ~31 functions call external AI / messaging
APIs and need keys to do anything.

```bash
cp supabase/functions/.env.local.example supabase/functions/.env.local
#   fill in only the keys for the features you want to try
npm run functions:serve   # serves all functions locally against your stack
```

`supabase/functions/.env.local.example` documents every secret and which
feature it unlocks (Gemini, Firecrawl, ElevenLabs, Telegram, Instagram, HeyGen,
etc.). Everything left blank simply means that one feature returns an error when
invoked; the rest of the app keeps working.

---

## Switching between local and cloud

Vite loads `.env.local` **ahead of** the committed `.env`:

- **Local backend** — keep `.env.local` present (created by `npm run env:local`).
- **Hosted/cloud backend** — delete or rename `.env.local`; the app falls back to
  the cloud values in `.env`.

No source changes are needed either way — every Supabase reference in `src/` is
env-driven.

---

## Useful commands

| Command | What it does |
|---------|--------------|
| `npm run db:start` | start the local Supabase stack |
| `npm run db:stop` | stop it (data is preserved) |
| `npm run db:reset` | drop, re-apply all migrations, re-run the seed |
| `npm run db:status` | show local URLs + keys |
| `npm run env:local` | (re)write `.env.local` from the running stack |
| `npm run dev` | Vite dev server on :8080 |
| `npm run build` | production build |
| `npm run test` | run the Vitest suite |
| `npm run functions:serve` | serve edge functions locally |

---

## How the local database is built

`supabase db reset` replays every file in `supabase/migrations` on an empty
database and then runs `supabase/seed.sql`.

A few objects on the hosted project were created through the dashboard and never
captured as migrations (schema drift), which would abort a fresh reset. The
migration **`20260104090000_local_schema_drift_repair.sql`** backfills them —
two tables (`student_budgets`, `finance_audit_log`), missing `profiles` columns,
three functions (`finance_audit_log_fn`, `fn_delete_my_account`,
`get_regional_stats`) and the `pgroonga` extension. Every statement is guarded
(`IF NOT EXISTS` / `to_regprocedure`), so on the hosted project — where these
already exist — it is a complete no-op and never overwrites anything.

---

## Troubleshooting

**`supabase start` hangs or errors pulling images / `403 Forbidden` from a
Docker CDN.** Your network blocks Docker Hub / `public.ecr.aws` (some corporate
proxies; Claude Code's web sandbox). The full local stack can't come up without
those images — run it on an unrestricted network or your own machine. Nothing in
this repo needs changing; it's purely network access to the container registries.

**`npm install` fails on `sharp` / `libvips` with a 403.** `sharp` comes in via
`@capacitor/assets` (mobile icon generation) and downloads a binary from github.
On networks that block that, run `npm install --ignore-scripts`. The web app,
build, tests, and the Supabase CLI don't need it.

**Port already in use.** Another Supabase project or Postgres is running. Stop it
(`supabase stop`) or change ports in `supabase/config.toml`.

**Login says invalid credentials.** The seed may have been skipped on your
GoTrue version — use the app's first-run owner setup (open the app on a fresh
`npm run db:reset`), or check `supabase/seed.sql`.

**I changed a migration and want a clean DB.** `npm run db:reset`.

---

## Mobile (Capacitor)

The Android/iOS wrappers (`android/`, `ios/`, `capacitor.config.ts`) are out of
scope for local backend development. They point at whichever backend the web
build uses; see `capacitor.config.ts` and the store docs. Icon generation via
`@capacitor/assets` needs `sharp`/`libvips` (see above).
