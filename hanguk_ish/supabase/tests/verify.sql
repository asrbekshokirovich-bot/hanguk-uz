-- Hanguk Ish — is a database as the migrations leave it? It only reads.
--
--   tests/verify.sh <database url>
--
-- For hanguk.uz's production project after the Hanguk Ish migrations are
-- applied there (README, «Prod'ga chiqarish ro'yxati»), and in CI on the local
-- Supabase stack after `supabase db reset`. Each line says «ok» or
-- «MISSING»; tests/verify.sh fails on any MISSING. :expected (from verify.sh)
-- lists the migration names of supabase/migrations (production records them
-- by name: apply_migration stamps its own version).
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
where v not in (select name from supabase_migrations.schema_migrations where name is not null);
\else
select 'MISSING  supabase_migrations.schema_migrations (not a Supabase database?)';
\endif

-- hanguk.uz's own sign-up trigger leaves Hanguk Ish's people to ish.profiles
-- (supabase/migrations/20261111150000_hanguk_ish_skip_main_profile.sql at the
-- repository root) and makes no profile for an anonymous account
-- (20261111180000_hanguk_ish_skip_anonymous.sql, P49). Only where hanguk.uz
-- is: the local stack has no such trigger.
select to_regprocedure('public.handle_new_user()') is not null as has_main \gset
\if :has_main
select case when pg_get_functiondef('public.handle_new_user()'::regprocedure) like '%hanguk_ish%'
            then 'ok       hanguk.uz sign-up skips Hanguk Ish users (public.profiles stays hanguk.uz''s)'
            else 'MISSING  hanguk.uz public.handle_new_user does not skip Hanguk Ish users' end;
select case when pg_get_functiondef('public.handle_new_user()'::regprocedure) like '%is_anonymous%'
            then 'ok       hanguk.uz sign-up skips anonymous accounts (the apps'' sign-in, P49)'
            else 'MISSING  hanguk.uz public.handle_new_user does not skip anonymous accounts' end;
-- P54 (20261112160000_hanguk_ish_phone_accounts.sql): phone accounts are
-- marked app_metadata.app = 'hanguk_ish' and kept out of hanguk.uz's tables.
select case when exists (select 1 from pg_trigger where tgrelid = 'auth.users'::regclass
                         and tgname = 'hanguk_ish_mark_account' and tgenabled <> 'D')
            then 'ok       phone and anonymous accounts are marked as Hanguk Ish''s (P54)'
            else 'MISSING  auth.users trigger hanguk_ish_mark_account (P54)' end;
select case when pg_get_functiondef('public.handle_new_user()'::regprocedure) like '%raw_app_meta_data%'
            then 'ok       hanguk.uz sign-up skips marked (phone) accounts (P54)'
            else 'MISSING  hanguk.uz public.handle_new_user does not skip marked accounts (P54)' end;
\else
select 'ok       no hanguk.uz sign-up trigger here (local stack)';
\endif

-- Every table of the apps keeps its rows to their people (RLS); signed-out
-- callers get no table at all; owner-run functions pin their search path.
select case when count(*) = 0 then 'ok       row level security on every ish table'
            else 'MISSING  row level security on: ' || string_agg(c.relname, ', ') end
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'ish' and c.relkind = 'r' and not c.relrowsecurity;
select case when count(*) = 0 then 'ok       no table rights for signed-out callers (anon)'
            else 'MISSING  anon may use: ' || string_agg(distinct table_name, ', ') end
from information_schema.role_table_grants
where table_schema = 'ish' and grantee = 'anon';
select case when count(*) = 0 then 'ok       every security definer function sets search_path'
            else 'MISSING  search_path in: ' || string_agg(p.proname, ', ') end
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'ish' and p.prosecdef
  and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%');

-- The jobs (pg_cron): finished shifts closed, reminders, the evening digest,
-- translations (P55) and the staff's Telegram messages (P57) retried.
select exists (select 1 from pg_extension where extname = 'pg_cron') as has_cron \gset
\if :has_cron
select case when count(*) = 5 then 'ok       the five pg_cron jobs are scheduled and active'
            else 'MISSING  pg_cron jobs: ' || coalesce(string_agg(jobname, ', '), 'none') || ' (want 5)' end
from cron.job
where jobname in ('ish-close-finished-shifts', 'ish-shift-reminders', 'ish-nearby-digests', 'ish-translate',
                  'ish-staff-alerts') and active;
\else
select 'MISSING  pg_cron is not installed: no reminders, no closing of finished shifts, no digest, no retries';
\endif

-- Live updates (Realtime) for the screens that refresh by themselves.
select case when count(*) = 3 then 'ok       realtime: notifications, messages, applications'
            else 'MISSING  realtime tables: ' || coalesce(string_agg(tablename, ', '), 'none') || ' (want 3)' end
from pg_publication_tables
where pubname = 'supabase_realtime' and schemaname = 'ish'
  and tablename in ('notifications', 'messages', 'applications');

-- Profile photos (A02).
select to_regclass('storage.buckets') is not null as has_storage \gset
\if :has_storage
select case when count(*) = 1 then 'ok       ish-avatars bucket: public, 2 MB, png/jpeg/webp'
            else 'MISSING  ish-avatars bucket with its limits' end
from storage.buckets
where id = 'ish-avatars' and public and file_size_limit = 2 * 1024 * 1024
  and allowed_mime_types @> array['image/png', 'image/jpeg', 'image/webp'];
\else
select 'MISSING  storage (no ish-avatars bucket)';
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
from wanted w left join ish.minimum_wages m on m.year = w.year;

-- Indexes the feed, the board and the jobs rely on (tests/perf.sh).
select case when count(*) = 7 then 'ok       indexes of the feed, the board, applications, notifications, places'
            else 'MISSING  indexes (' || count(*) || ' of 7)' end
from pg_indexes
where schemaname = 'ish' and indexname in (
  'shifts_open_starts_idx', 'shifts_business_starts_idx', 'applications_worker_idx',
  'applications_shift_idx', 'notifications_user_idx', 'worker_profiles_place_idx',
  'applications_one_live_per_shift');
