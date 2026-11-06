-- Ushlab qolish rejasi P08 (U2): a guest's own deadline reminder. A phone
-- that said yes to notifications is told, 7, 3 and 1 day before, that the
-- online application of a university it saved (♥) closes — or, with no ♥,
-- 7 days before for the university it opened last. Built on P06
-- (app_install_interests, app_install_answers); sent by notify-guest-reminders
-- (P09) at 10:00 and 19:00 Tashkent.
--
-- * app_guest_push_tokens.reminders — the phone's «Muddat eslatmalari»
--   switch (P10); a campaign (send-guest-push) still reaches it.
-- * guest_push_queue — one row per phone, kind, university and deadline;
--   the same reminder is never queued twice.
-- * guest_deadline_reminders() — 04:30 UTC (09:30 Tashkent) queues today's.
-- * app_guest_push_set() — the app's switch, by install id and token.
-- * guest_push_pending() — what notify-guest-reminders sends next.

alter table public.app_guest_push_tokens
  add column if not exists reminders boolean not null default true;

create table if not exists public.guest_push_queue (
  id             bigserial primary key,
  install_id     uuid not null references public.app_installs (install_id) on delete cascade,
  kind           text not null check (kind in ('deadline_7', 'deadline_3', 'deadline_1', 'guideline_new')),
  institution_id uuid not null,
  ref_date       date not null,
  status         text not null default 'pending' check (status in ('pending', 'sent', 'skipped', 'failed')),
  note           text,
  attempts       smallint not null default 0,
  created_at     timestamptz not null default now(),
  sent_at        timestamptz
);
create unique index if not exists guest_push_queue_once
  on public.guest_push_queue (install_id, kind, institution_id, ref_date);
create index if not exists guest_push_queue_pending_idx
  on public.guest_push_queue (created_at) where status = 'pending';

alter table public.guest_push_queue enable row level security;
drop policy if exists guest_push_queue_staff_read on public.guest_push_queue;
create policy guest_push_queue_staff_read on public.guest_push_queue
  for select to authenticated using (public.app_events_staff_can_read());

-- Phones a reminder may go to: a guest token that is on, reminders on.
create or replace function public.fn_guest_reminder_installs()
returns table (install_id uuid)
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
  select distinct g.install_id
    from public.fn_guest_push_targets() g
    join public.app_guest_push_tokens t on t.token = g.token
   where t.reminders;
$$;
revoke all on function public.fn_guest_reminder_installs() from public, anon, authenticated;

create or replace function public.guest_deadline_reminders()
returns integer
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_today date := (now() at time zone 'Asia/Tashkent')::date;
  v_n int;
begin
  perform public.app_interests_refresh();

  -- yesterday's leftovers are no longer true
  update public.guest_push_queue set status = 'skipped', note = 'expired'
   where status = 'pending' and kind like 'deadline_%'
     and created_at < (v_today::timestamp at time zone 'Asia/Tashkent');

  with phones as (
    select r.install_id,
           case a.route
             when 'bachelor' then 'bakalavr'
             when 'master' then 'magistratura'
             when 'languageCourse' then 'til_kursi'
           end as daraja
      from public.fn_guest_reminder_installs() r
      left join public.app_install_answers a on a.install_id = r.install_id
  ),
  hearts as (
    select p.install_id, p.daraja, i.institution_id, array[7, 3, 1] as days
      from phones p
      join public.app_install_interests i on i.install_id = p.install_id and i.heart_slot is not null
  ),
  last_open as (
    select distinct on (p.install_id) p.install_id, p.daraja, i.institution_id, array[7] as days
      from phones p
      join public.app_install_interests i on i.install_id = p.install_id and i.last_open_at is not null
     where not exists (select 1 from hearts h where h.install_id = p.install_id)
     order by p.install_id, i.last_open_at desc
  ),
  picks as (
    select * from hearts union all select * from last_open
  ),
  due as (
    select distinct p.install_id, p.institution_id, r.tugash_sana, r.tugash_sana - v_today as days_left
      from picks p
      join public.university_guidelines g on g.institution_id = p.institution_id
      join public.university_guideline_rounds r on r.guideline_uuid = g.id
      cross join public.ai_uni_season() s
     where g.qabul_yili = s.qabul_yili and g.semestr = s.semestr
       and (p.daraja is null or g.daraja = p.daraja)
       and r.etap_nomi = 'Online hujjat topshirish'
       and coalesce(r.holat, '') <> 'etap_yoq'
       and (r.tugash_sana - v_today) = any (p.days)
  )
  insert into public.guest_push_queue (install_id, kind, institution_id, ref_date)
  select d.install_id, 'deadline_' || d.days_left, d.institution_id, d.tugash_sana from due d
  on conflict do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
revoke all on function public.guest_deadline_reminders() from public, anon, authenticated;

-- The app's «Muddat eslatmalari» switch. The token proves it is this phone.
create or replace function public.app_guest_push_set(p_install_id uuid, p_token text, p_enabled boolean)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
begin
  if p_install_id is null or p_token is null or p_enabled is null then
    return jsonb_build_object('status', 'bad_input');
  end if;
  if not exists (select 1 from public.app_guest_push_tokens t
                  where t.token = p_token and t.install_id = p_install_id) then
    return jsonb_build_object('status', 'unknown_token');
  end if;
  update public.app_guest_push_tokens set reminders = p_enabled, updated_at = now()
   where install_id = p_install_id;
  if not p_enabled then
    update public.guest_push_queue set status = 'skipped', note = 'switched_off'
     where install_id = p_install_id and status = 'pending';
  end if;
  return jsonb_build_object('status', 'ok', 'reminders', p_enabled);
end;
$$;
revoke all on function public.app_guest_push_set(uuid, text, boolean) from public;
grant execute on function public.app_guest_push_set(uuid, text, boolean) to anon, authenticated;

-- What notify-guest-reminders sends next: the pending rows of phones still
-- reachable, with the phone's language, tokens, test mark and what it was
-- already sent (Tashkent today, last 7 days) from app_push_sends.
create or replace function public.guest_push_pending(p_limit int default 500)
returns table (
  queue_id bigint, install_id uuid, kind text, institution_id uuid, ref_date date,
  lang text, tokens text[], is_test boolean, sent_today int, sent_7d int)
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
  with tok as (
    select g.install_id, array_agg(g.token order by t.updated_at desc) as tokens,
           (array_agg(g.preferred_lang order by t.updated_at desc))[1] as lang
      from public.fn_guest_push_targets() g
      join public.app_guest_push_tokens t on t.token = g.token
     where t.reminders
     group by g.install_id
  ),
  sent as (
    select s.install_id,
           count(*) filter (where (s.sent_at at time zone 'Asia/Tashkent')::date
                                  = (now() at time zone 'Asia/Tashkent')::date)::int as today,
           count(*)::int as d7
      from public.app_push_sends s
     where s.audience = 'guest' and s.status = 'sent' and s.campaign is null
       and s.sent_at > now() - interval '7 days'
     group by s.install_id
  )
  select q.id, q.install_id, q.kind, q.institution_id, q.ref_date,
         tok.lang, tok.tokens, (i.test_reason is not null),
         coalesce(sent.today, 0), coalesce(sent.d7, 0)
    from public.guest_push_queue q
    join tok on tok.install_id = q.install_id
    join public.app_installs i on i.install_id = q.install_id
    left join sent on sent.install_id = q.install_id
   where q.status = 'pending'
   order by q.install_id, q.ref_date, q.kind
   limit greatest(1, least(coalesce(p_limit, 500), 5000));
$$;
revoke all on function public.guest_push_pending(int) from public, anon, authenticated;
grant execute on function public.guest_push_pending(int) to service_role;

do $$
begin
  perform cron.unschedule('guest-deadline-reminders')
    where exists (select 1 from cron.job where jobname = 'guest-deadline-reminders');
end $$;
-- 04:30 UTC = 09:30 Toshkent; yuborish 05:00 va 14:00 UTC (P09).
select cron.schedule('guest-deadline-reminders', '30 4 * * *', 'select public.guest_deadline_reminders()');
