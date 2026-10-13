-- Daily allowance for the app's AI university search (ai-university-search).
--
-- The search box calls a language model while the student types, guests
-- included (owner, 2026-10-13: for everyone, with a daily limit). Each call is
-- cheap, but an open endpoint needs a ceiling. One row per caller per Tashkent
-- day: `user:<id>` for a signed-in student, `ip:<address>` for a guest, and
-- `*` for the whole app. Over a limit the function answers with a plain name
-- search instead, so nothing breaks for the student.
--
-- Only the edge function (service role) touches this: RLS on with no
-- policies, and the RPC is not executable by anon or authenticated.

create table if not exists public.ai_search_usage (
  key   text not null,
  day   date not null,
  count integer not null default 0,
  primary key (key, day)
);

alter table public.ai_search_usage enable row level security;

comment on table public.ai_search_usage is
  'AI university search calls per caller per Tashkent day (ai-university-search). Service role only.';

-- Counts one call for p_key and for the whole app; true while both are within
-- their limits. Counting even a refused call keeps a flood from probing.
create or replace function public.ai_search_take(p_key text, p_limit integer, p_global_limit integer)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_day date := (now() at time zone 'Asia/Tashkent')::date;
  v_all integer;
  v_mine integer;
begin
  insert into public.ai_search_usage as u (key, day, count)
  values ('*', v_day, 1)
  on conflict (key, day) do update set count = u.count + 1
  returning u.count into v_all;

  -- The first call of a day clears out last week.
  if v_all = 1 then
    delete from public.ai_search_usage where day < v_day - 7;
  end if;

  insert into public.ai_search_usage as u (key, day, count)
  values (left(p_key, 120), v_day, 1)
  on conflict (key, day) do update set count = u.count + 1
  returning u.count into v_mine;

  return v_all <= p_global_limit and v_mine <= p_limit;
end;
$function$;

revoke all on function public.ai_search_take(text, integer, integer) from public, anon, authenticated;
grant execute on function public.ai_search_take(text, integer, integer) to service_role;
