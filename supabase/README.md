# Supabase: how this directory relates to the live database

Read this before writing a migration or deploying a function. The relationship
is not the usual one, and assuming it is will cost you a production incident.

## The short version

- The live project is **Hanguk 2026**, ref `lysjdtyanhdfphqyijsr`.
- **`supabase/functions/` is deployed by CI**, from an explicit list — see
  `.github/workflows/supabase-deploy.yml`. Do not deploy by hand.
- **`supabase/migrations/` is NOT what built this database.** Do not run
  `supabase db push` against production. See below.

## Why migrations are different here

Production's migration ledger and this directory have **no version in common**:
211 versions recorded in `supabase_migrations.schema_migrations`, 134 files
here, zero overlap.

Two mechanisms wrote the schema, and neither was `db push`:

1. The Supabase dashboard and the Lovable integration, which record their own
   timestamped versions.
2. The MCP `apply_migration` tool, which takes SQL and a name and **stamps its
   own version, ignoring the filename**. So a migration written here as
   `20260903090000_channel_health_watchdog.sql` is recorded in production as
   `20260903083344`. The two ledgers cannot converge on their own — they drift
   by construction, once per migration.

The practical consequence: the CLI, pointed at production, believes all 134
local migrations are unapplied. `supabase db push` would replay every one of
them against a database that already has that schema. Some are `create table`
without `if not exists`. It would fail partway through, having already done
damage.

**So: write migrations here for the record, and apply them to production
through `apply_migration`. Keep both. Never `db push`.**

Because that means the file and the applied SQL are typed twice, they can
differ. When they do, production wins and the file is wrong — which is the same
class of problem this whole document is about. Write the migration file first,
apply exactly that text, and verify the result by querying the catalog.

## What was missing, and was recovered

A September 2026 audit found a whole subsystem live in production and absent
from this repo: five Instagram tables, the `get_thread_previews` /
`get_thread_messages` RPCs the Messages page depends on, the
`delivery_status` / `client_msg_id` columns, and three triggers.
`20260903100000_reconcile_messaging_schema_from_prod.sql` brings those back,
read out of the live catalog rather than from memory. It is written to be a
no-op against production.

`config.toml` pointed at project `hyvxwlwttzxzrkfolivo`, which does not exist —
so `supabase link` from a checkout connected to nothing. That is fixed, and it
is part of why every change was made in the dashboard instead.

## Fixing this properly (not yet done — needs a decision)

The clean end state is a **baseline**:

1. `supabase db dump --schema public -f supabase/migrations/<ts>_baseline.sql`
2. Move the existing 134 files to `supabase/migrations/archive/`.
3. `supabase migration repair --status applied <ts>` so the remote ledger lists
   exactly that baseline.
4. From then on, `db push` works and CI can run it.

This rewrites migration history and needs somebody who can restore a backup if
it goes wrong, so it is deliberately not automated. Until it happens, the
`schema-snapshot` job in the deploy workflow keeps a readable dump of the live
schema at `supabase/schema/production.sql`, so a change made outside the repo
shows up as a diff instead of staying invisible for months.

## Deploying a function

Add it to `FUNCTIONS` in `.github/workflows/supabase-deploy.yml`, but **only
after** comparing the repo copy against what is deployed:

- read the live source (Supabase dashboard → Edge Functions, or the MCP
  `get_edge_function` tool),
- diff it against this directory,
- if the live one is newer, commit the live one FIRST, then make your change on
  top of it.

Deploying a stale repo copy silently reverts however many months of dashboard
edits are in the live version. That has already happened once and was caught
only because someone checked before pressing deploy.
