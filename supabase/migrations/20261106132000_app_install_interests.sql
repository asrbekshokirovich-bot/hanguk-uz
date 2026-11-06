-- Ushlab qolish rejasi P06 (U1.2): which universities a phone cares about,
-- kept from the app's own events so a guest's reminder (P08/P09) can name
-- them — the app is not changed for it.
--
-- * app_install_interests — per phone and university: the ♥ slot it sits in
--   now (null = not saved), how often its page was opened, when last.
--   A ♥ is the latest slot_set of that university, unless a later
--   slot_remove of it, or a later slot_set of another university into the
--   same slot, took it out.
-- * app_install_answers — the route the phone last answered
--   (question_answer q = 'route': bachelor, master, languageCourse), so a
--   bachelor's reminder is not sent for a master's deadline.
-- * app_interests_refresh() — every 5 minutes, the phones that sent such an
--   event since the last run are rebuilt; the migration builds every phone
--   once.

create table if not exists public.app_install_interests (
  install_id     uuid not null references public.app_installs (install_id) on delete cascade,
  institution_id uuid not null,
  heart_slot     smallint check (heart_slot between 1 and 3),
  hearted_at     timestamptz,
  opens          int not null default 0,
  last_open_at   timestamptz,
  updated_at     timestamptz not null default now(),
  primary key (install_id, institution_id)
);
create index if not exists app_install_interests_inst_idx on public.app_install_interests (institution_id);
create index if not exists app_install_interests_heart_idx on public.app_install_interests (install_id) where heart_slot is not null;

create table if not exists public.app_install_answers (
  install_id uuid primary key references public.app_installs (install_id) on delete cascade,
  route      text,
  updated_at timestamptz not null default now()
);

alter table public.app_install_interests enable row level security;
alter table public.app_install_answers enable row level security;
drop policy if exists app_install_interests_staff_read on public.app_install_interests;
create policy app_install_interests_staff_read on public.app_install_interests
  for select to authenticated using (public.app_events_staff_can_read());
drop policy if exists app_install_answers_staff_read on public.app_install_answers;
create policy app_install_answers_staff_read on public.app_install_answers
  for select to authenticated using (public.app_events_staff_can_read());

-- Rebuilds the given phones from their events.
create or replace function public.app_interests_rebuild(p_installs uuid[])
returns int
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_n int;
begin
  if p_installs is null or cardinality(p_installs) = 0 then return 0; end if;

  delete from public.app_install_interests where install_id = any (p_installs);

  with ev as (
    select e.install_id, e.event, e.occurred_at,
           (e.props ->> 'institution_id')::uuid as inst,
           case when e.props ->> 'slot' ~ '^[1-3]$' then (e.props ->> 'slot')::smallint end as slot
      from public.app_events e
     where e.install_id = any (p_installs)
       and e.event in ('slot_set', 'slot_remove', 'university_open')
       and e.props ->> 'institution_id' ~ '^[0-9a-fA-F-]{36}$'
  ),
  last_set as (
    select distinct on (install_id, inst) install_id, inst, slot, occurred_at
      from ev where event = 'slot_set' and slot is not null
     order by install_id, inst, occurred_at desc
  ),
  hearts as (
    select s.install_id, s.inst, s.slot, s.occurred_at
      from last_set s
     where not exists (select 1 from ev r where r.install_id = s.install_id and r.event = 'slot_remove'
                         and r.inst = s.inst and r.occurred_at > s.occurred_at)
       and not exists (select 1 from ev o where o.install_id = s.install_id and o.event = 'slot_set'
                         and o.slot = s.slot and o.inst <> s.inst and o.occurred_at > s.occurred_at)
  ),
  opens as (
    select install_id, inst, count(*)::int as n, max(occurred_at) as last_at
      from ev where event = 'university_open'
     group by install_id, inst
  )
  insert into public.app_install_interests (install_id, institution_id, heart_slot, hearted_at, opens, last_open_at)
  select coalesce(h.install_id, o.install_id), coalesce(h.inst, o.inst), h.slot, h.occurred_at,
         coalesce(o.n, 0), o.last_at
    from hearts h
    full join opens o on o.install_id = h.install_id and o.inst = h.inst
   where exists (select 1 from public.app_installs i where i.install_id = coalesce(h.install_id, o.install_id));
  get diagnostics v_n = row_count;

  insert into public.app_install_answers (install_id, route, updated_at)
  select distinct on (e.install_id) e.install_id, e.props ->> 'band', now()
    from public.app_events e
   where e.install_id = any (p_installs) and e.event = 'question_answer' and e.props ->> 'q' = 'route'
   order by e.install_id, e.occurred_at desc
  on conflict (install_id) do update set route = excluded.route, updated_at = excluded.updated_at;

  return v_n;
end;
$$;

-- The 5-minute pass: phones with a new such event since the last run.
create or replace function public.app_interests_refresh()
returns int
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_since timestamptz;
  v_now   timestamptz := now();
  v_ids   uuid[];
begin
  select s.at into v_since from public.app_analytics_state s where s.key = 'interests';
  v_since := coalesce(v_since, v_now - interval '1 day') - interval '1 minute';
  select array_agg(distinct e.install_id) into v_ids
    from public.app_events e
   where e.received_at > v_since
     and (e.event in ('slot_set', 'slot_remove', 'university_open')
          or (e.event = 'question_answer' and e.props ->> 'q' = 'route'));
  insert into public.app_analytics_state (key, at) values ('interests', v_now)
  on conflict (key) do update set at = excluded.at;
  return public.app_interests_rebuild(coalesce(v_ids, '{}'));
end;
$$;

revoke all on function public.app_interests_rebuild(uuid[]) from public, anon, authenticated;
revoke all on function public.app_interests_refresh() from public, anon, authenticated;

-- Every phone once, now.
select public.app_interests_rebuild(array(select install_id from public.app_installs));

do $$
begin
  perform cron.unschedule('app-interests-refresh')
    where exists (select 1 from cron.job where jobname = 'app-interests-refresh');
end $$;
select cron.schedule('app-interests-refresh', '*/5 * * * *', 'select public.app_interests_refresh();');
