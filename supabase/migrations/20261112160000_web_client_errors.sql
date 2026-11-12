-- What breaks in the CRM for the people using it, written down.
--
-- The student app reports its own errors (app_events: app_error) and that is
-- how most of this cycle's app faults were found. The site had nothing of
-- the kind: a page that crashed for an operator showed "Something went
-- wrong" and left no trace anywhere — the console of their browser aside.
--
-- web_client_errors keeps one row per person, error and hour:
--   kind       'crash'     a page fell over (React error boundary)
--              'error'     an uncaught error outside React's render
--              'rejection' a promise nobody caught
--   hits       how many times within that hour
--
-- Written only through web_error_log(), by someone signed in (visitors are
-- not logged: anyone could fill the table). At most 40 distinct errors per
-- person per hour; texts are cut to size. Owners and admins read it; the
-- hourly infra-health-check reads crashes through the service key.
create table if not exists public.web_client_errors (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  hour_bucket   timestamptz not null default date_trunc('hour', now()),
  user_id       uuid not null,
  kind          text not null check (kind in ('crash', 'error', 'rejection')),
  message       text not null,
  stack         text,
  path          text,
  build         text,
  user_agent    text,
  fingerprint   text not null,
  hits          integer not null default 1
);

create unique index if not exists web_client_errors_once_an_hour
  on public.web_client_errors (user_id, fingerprint, hour_bucket);
create index if not exists web_client_errors_recent
  on public.web_client_errors (last_seen_at desc);

alter table public.web_client_errors enable row level security;

revoke all on public.web_client_errors from anon, authenticated;
grant select on public.web_client_errors to authenticated;
grant all on public.web_client_errors to service_role;

do $$ begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'web_client_errors' and policyname = 'Admins read web errors'
  ) then
    create policy "Admins read web errors" on public.web_client_errors
      for select to authenticated
      using (
        public.has_role((select auth.uid()), 'owner'::public.app_role)
        or public.has_role((select auth.uid()), 'admin'::public.app_role)
      );
  end if;
end $$;

create or replace function public.web_error_log(
  p_kind text,
  p_message text,
  p_stack text default null,
  p_path text default null,
  p_build text default null,
  p_user_agent text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_per_hour constant int := 40;
  v_uid uuid := auth.uid();
  v_kind text := lower(btrim(coalesce(p_kind, '')));
  v_message text := left(btrim(coalesce(p_message, '')), 500);
  -- The page without what follows "?" or "#": ids in a path are ours, what
  -- comes after may be anything.
  v_path text := nullif(left(split_part(split_part(btrim(coalesce(p_path, '')), '?', 1), '#', 1), 300), '');
  v_bucket timestamptz := date_trunc('hour', now());
  v_fingerprint text;
begin
  if v_uid is null or v_kind not in ('crash', 'error', 'rejection') or v_message = '' then
    return false;
  end if;
  v_fingerprint := md5(v_kind || '|' || v_message || '|' || coalesce(v_path, ''));

  -- Seen this hour already: one more hit, nothing else.
  update public.web_client_errors e
     set hits = e.hits + 1, last_seen_at = now()
   where e.user_id = v_uid and e.fingerprint = v_fingerprint and e.hour_bucket = v_bucket;
  if found then
    return true;
  end if;

  if (select count(*) from public.web_client_errors e
       where e.user_id = v_uid and e.hour_bucket = v_bucket) >= c_per_hour then
    return false;
  end if;

  insert into public.web_client_errors (user_id, kind, message, stack, path, build, user_agent, fingerprint, hour_bucket)
  values (
    v_uid, v_kind, v_message,
    nullif(left(coalesce(p_stack, ''), 4000), ''),
    v_path,
    nullif(left(btrim(coalesce(p_build, '')), 40), ''),
    nullif(left(btrim(coalesce(p_user_agent, '')), 300), ''),
    v_fingerprint, v_bucket
  )
  on conflict (user_id, fingerprint, hour_bucket)
  do update set hits = public.web_client_errors.hits + 1, last_seen_at = now();
  return true;
end $$;

revoke all on function public.web_error_log(text, text, text, text, text, text) from public, anon;
grant execute on function public.web_error_log(text, text, text, text, text, text) to authenticated, service_role;
