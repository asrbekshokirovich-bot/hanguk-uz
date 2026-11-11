-- Hanguk Ish — is a database as the migrations leave it? It only reads.
--
--   tests/verify.sh <database url>
--
-- For the production project after `supabase db push` (README, «Prod'ga
-- chiqarish ro'yxati»), and in CI on the local Supabase stack after
-- `supabase db reset`. Each line says «ok» or «MISSING»; tests/verify.sh
-- fails on any MISSING. :expected (from verify.sh) lists the migration
-- versions of supabase/migrations.
\set ON_ERROR_STOP 1
\pset format unaligned
\pset tuples_only on
\pset footer off

-- Migrations: every file of supabase/migrations is applied.
select to_regclass('supabase_migrations.schema_migrations') is not null as has_migrations \gset
\if :has_migrations
select case when count(*) = 0 then 'ok       every migration is applied'
            else 'MISSING  migrations not applied: ' || string_agg(v, ', ' order by v) end
from unnest(string_to_array(:'expected', ',')) v
where v not in (select version from supabase_migrations.schema_migrations);
\else
select 'MISSING  supabase_migrations.schema_migrations (not a Supabase database?)';
\endif

-- Every table of the apps keeps its rows to their people (RLS); signed-out
-- callers get no table at all; owner-run functions pin their search path.
select case when count(*) = 0 then 'ok       row level security on every public table'
            else 'MISSING  row level security on: ' || string_agg(c.relname, ', ') end
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
select case when count(*) = 0 then 'ok       no table rights for signed-out callers (anon)'
            else 'MISSING  anon may use: ' || string_agg(distinct table_name, ', ') end
from information_schema.role_table_grants
where table_schema = 'public' and grantee = 'anon';
select case when count(*) = 0 then 'ok       every security definer function sets search_path'
            else 'MISSING  search_path in: ' || string_agg(p.proname, ', ') end
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef
  and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%');

-- The jobs (pg_cron): finished shifts closed, reminders, the evening digest.
select exists (select 1 from pg_extension where extname = 'pg_cron') as has_cron \gset
\if :has_cron
select case when count(*) = 3 then 'ok       the three pg_cron jobs are scheduled and active'
            else 'MISSING  pg_cron jobs: ' || coalesce(string_agg(jobname, ', '), 'none') || ' (want 3)' end
from cron.job
where jobname in ('ish-close-finished-shifts', 'ish-shift-reminders', 'ish-nearby-digests') and active;
\else
select 'MISSING  pg_cron is not installed: no reminders, no closing of finished shifts, no digest';
\endif

-- Live updates (Realtime) for the screens that refresh by themselves.
select case when count(*) = 3 then 'ok       realtime: notifications, messages, applications'
            else 'MISSING  realtime tables: ' || coalesce(string_agg(tablename, ', '), 'none') || ' (want 3)' end
from pg_publication_tables
where pubname = 'supabase_realtime' and schemaname = 'public'
  and tablename in ('notifications', 'messages', 'applications');

-- Profile photos (A02).
select to_regclass('storage.buckets') is not null as has_storage \gset
\if :has_storage
select case when count(*) = 1 then 'ok       avatars bucket: public, 2 MB, png/jpeg/webp'
            else 'MISSING  avatars bucket with its limits' end
from storage.buckets
where id = 'avatars' and public and file_size_limit = 2 * 1024 * 1024
  and allowed_mime_types @> array['image/png', 'image/jpeg', 'image/webp'];
\else
select 'MISSING  storage (no avatars bucket)';
\endif

-- The statutory minimum wage BA2 checks against: this year's, and from
-- September next year's too (고용노동부 announces it by 5 August; without
-- the row, January would still check the old rate).
with seoul as (select now() at time zone 'Asia/Seoul' as t),
wanted as (
  select extract(year from t)::int as year from seoul
  union all
  select extract(year from t)::int + 1 from seoul where extract(month from t) >= 9
)
select case when count(*) filter (where m.year is null) = 0 then 'ok       minimum wage of ' || string_agg(w.year::text, ' and ' order by w.year)
            else 'MISSING  minimum wage of ' || string_agg(w.year::text, ', ' order by w.year) filter (where m.year is null)
                 || ' — add it from the 고용노동부 고시' end
from wanted w left join public.minimum_wages m on m.year = w.year;

-- Indexes the feed, the board and the jobs rely on (tests/perf.sh).
select case when count(*) = 7 then 'ok       indexes of the feed, the board, applications, notifications, places'
            else 'MISSING  indexes (' || count(*) || ' of 7)' end
from pg_indexes
where schemaname = 'public' and indexname in (
  'shifts_open_starts_idx', 'shifts_business_starts_idx', 'applications_worker_idx',
  'applications_shift_idx', 'notifications_user_idx', 'worker_profiles_place_idx',
  'applications_one_live_per_shift');
