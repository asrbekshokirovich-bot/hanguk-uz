-- Ushlab qolish rejasi P03 (U0.3): what happens to each push after it is sent.
--
-- * app_push_sends — one row per push (or Telegram message) the server sent
--   to a phone: the guest reminders (notify-guest-reminders, P09) write here;
--   student stage pushes and CRM campaigns keep their own tables
--   (student_stage_notifications, push_campaigns) and are read from there.
-- * The app's push_received / push_opened carry the kind and the university
--   (app P04): the registry lets those keys through.
-- * analytics_push_funnel(from, to) — per kind: sent → delivered → opened →
--   did something in the app within an hour of opening.

create table if not exists public.app_push_sends (
  id             bigint generated always as identity primary key,
  channel        text not null check (channel in ('fcm', 'telegram')),
  audience       text not null check (audience in ('guest', 'student')),
  install_id     uuid,
  user_id        uuid,
  kind           text not null,
  institution_id uuid,
  ref_date       date,
  campaign       text,
  status         text not null check (status in ('sent', 'failed', 'gone', 'skipped')),
  error          text,
  sent_at        timestamptz not null default now()
);

create index if not exists app_push_sends_install_idx on public.app_push_sends (install_id, sent_at desc);
create index if not exists app_push_sends_kind_idx on public.app_push_sends (kind, sent_at desc);

alter table public.app_push_sends enable row level security;
drop policy if exists app_push_sends_staff_read on public.app_push_sends;
create policy app_push_sends_staff_read on public.app_push_sends
  for select to authenticated using (public.app_events_staff_can_read());
-- written only by the service role (edge functions); no insert policy

update public.app_event_types set props = '{type,campaign,kind,institution_id}'
 where event in ('push_received', 'push_opened');

create or replace function public.analytics_push_funnel(p_from date default null, p_to date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_today date := (now() at time zone 'Asia/Tashkent')::date;
  v_t0 timestamptz := (coalesce(p_from, v_today - 28)::timestamp at time zone 'Asia/Tashkent');
  v_t1 timestamptz := ((coalesce(p_to, v_today) + 1)::timestamp at time zone 'Asia/Tashkent');
  v_out jsonb;
begin
  if not (public.app_events_staff_can_read() or auth.role() = 'service_role') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  with sends as (
    select kind, count(*) filter (where status in ('sent', 'failed', 'gone')) as sent,
           count(*) filter (where status = 'sent') as delivered,
           count(distinct install_id) filter (where status = 'sent') as phones
      from public.app_push_sends
     where sent_at >= v_t0 and sent_at < v_t1
     group by kind
  ),
  opens as (
    select coalesce(e.props ->> 'kind', e.props ->> 'campaign', e.props ->> 'type') as kind,
           e.install_id, e.occurred_at
      from public.app_events e
      join public.app_installs i using (install_id)
     where e.event = 'push_opened' and i.test_reason is null
       and e.occurred_at >= v_t0 and e.occurred_at < v_t1
  ),
  acted as (
    select o.kind, count(*) as opened, count(distinct o.install_id) as opened_phones,
           count(*) filter (where exists (
             select 1 from public.app_events a
              where a.install_id = o.install_id
                and a.occurred_at > o.occurred_at and a.occurred_at <= o.occurred_at + interval '1 hour'
                and a.event in ('tap', 'tab_open', 'university_open', 'slot_set', 'question_answer',
                                'form_open', 'contact_tap', 'lead_submit', 'interview_start', 'study_plan_test_open')
           )) as acted
      from opens o
     group by o.kind
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'kind', coalesce(s.kind, a.kind),
           'sent', coalesce(s.sent, 0), 'delivered', coalesce(s.delivered, 0), 'phones', coalesce(s.phones, 0),
           'opened', coalesce(a.opened, 0), 'opened_phones', coalesce(a.opened_phones, 0),
           'acted', coalesce(a.acted, 0)) order by coalesce(s.kind, a.kind)), '[]'::jsonb)
    into v_out
    from sends s
    full join acted a on a.kind = s.kind;
  return jsonb_build_object('from', v_t0, 'to', v_t1, 'rows', v_out);
end;
$$;

revoke all on function public.analytics_push_funnel(date, date) from public, anon;
grant execute on function public.analytics_push_funnel(date, date) to authenticated, service_role;
