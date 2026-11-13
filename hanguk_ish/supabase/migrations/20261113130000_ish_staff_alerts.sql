-- Hanguk Ish — the staff hear at once (P57, 2026-11-13).
--
-- Two things the staff act on reached them only when someone opened the CRM:
--   * a business the 사장님 app opened (P50: at once, without a check — P52's
--     «Ilovadagi bizneslar» is where the staff name it or suspend it);
--   * a worker's complaint (A11; the plan's T9: «shikoyat bazaga + Asrbekka
--     Telegram xabar»).
-- Each now becomes a row of ish.staff_alerts, and the statement asks the edge
-- function `ish-staff-alerts` (ish.ask_function, P55) to send it to Telegram
-- — hanguk.uz's alert bot and chat (TELEGRAM_BOT_TOKEN, ALERT_TELEGRAM_CHAT_ID;
-- ISH_ALERT_CHAT_ID when set). A message that does not go is tried again
-- (1, 2, 4 … 60 minutes, 8 tries) by the pg_cron job `ish-staff-alerts`.
-- Businesses the staff keep themselves (managed_by_staff) are not news to them.

create table ish.staff_alerts (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('business_opened', 'report')),
  ref uuid not null,
  created_at timestamptz not null default now(),
  next_at timestamptz not null default now(),
  attempts smallint not null default 0,
  sent_at timestamptz,
  last_error text check (char_length(last_error) <= 500),
  unique (kind, ref)
);

comment on table ish.staff_alerts is
  'Telegram messages to Hanguk''s staff (P57), sent by ish-staff-alerts. Only the service role and the database''s own code use it.';

create index staff_alerts_due_idx on ish.staff_alerts (next_at) where sent_at is null and attempts < 8;

alter table ish.staff_alerts enable row level security;
revoke all on ish.staff_alerts from public, anon, authenticated;
grant all on ish.staff_alerts to service_role;

-- ---------------------------------------------------------------------------
-- Into the outbox
-- ---------------------------------------------------------------------------

create function ish.staff_alerts_row()
returns trigger
language plpgsql
security definer
set search_path = ish
as $$
begin
  if tg_table_name = 'businesses' then
    if new.managed_by_staff then
      return null;
    end if;
    insert into ish.staff_alerts (kind, ref) values ('business_opened', new.id) on conflict do nothing;
  elsif tg_table_name = 'reports' then
    insert into ish.staff_alerts (kind, ref) values ('report', new.id) on conflict do nothing;
  end if;
  return null;
end
$$;

-- Asks ish-staff-alerts to send, when something is due.
create function ish.staff_alerts_kick()
returns void
language plpgsql
security definer
set search_path = ish
as $$
begin
  if exists (select 1 from ish.staff_alerts a where a.sent_at is null and a.attempts < 8 and a.next_at <= now()) then
    perform ish.ask_function('ish-staff-alerts');
  end if;
end
$$;

create function ish.staff_alerts_kick_after()
returns trigger
language plpgsql
security definer
set search_path = ish
as $$
begin
  perform ish.staff_alerts_kick();
  return null;
end
$$;

create trigger businesses_staff_alert after insert on ish.businesses
  for each row execute function ish.staff_alerts_row();
create trigger businesses_staff_alert_kick after insert on ish.businesses
  for each statement execute function ish.staff_alerts_kick_after();

create trigger reports_staff_alert after insert on ish.reports
  for each row execute function ish.staff_alerts_row();
create trigger reports_staff_alert_kick after insert on ish.reports
  for each statement execute function ish.staff_alerts_kick_after();

-- ---------------------------------------------------------------------------
-- Out of it (the service role: ish-staff-alerts)
-- ---------------------------------------------------------------------------

-- What a message says, as the staff read it in the CRM: the business's name
-- and kind; a complaint's subject, text, worker, business and shift.
create function ish.staff_alert_data(p_kind text, p_ref uuid)
returns jsonb
language plpgsql
stable
set search_path = ish
as $$
begin
  if p_kind = 'business_opened' then
    return (select jsonb_build_object('name', b.name, 'name_uz', b.name_i18n ->> 'uz', 'category', b.category,
                                      'status', b.status, 'created_at', b.created_at)
            from ish.businesses b where b.id = p_ref);
  elsif p_kind = 'report' then
    return (select jsonb_build_object(
              'reason', r.reason, 'body', r.body, 'created_at', r.created_at,
              'worker', (select jsonb_build_object('first_name', p.first_name, 'last_name', p.last_name)
                         from ish.profiles p where p.id = r.reporter_id),
              'business', (select jsonb_build_object('name', b.name, 'name_uz', b.name_i18n ->> 'uz')
                           from ish.businesses b where b.id = coalesce(r.business_id, s.business_id)),
              'shift', case when s.id is not null
                         then jsonb_build_object('title', s.title, 'starts_at', s.starts_at) end)
            from ish.reports r
            left join ish.applications a on a.id = r.application_id
            left join ish.shifts s on s.id = a.shift_id
            where r.id = p_ref);
  end if;
  return null;
end
$$;

-- Up to [p_limit] messages due, each pushed back before it is returned
-- (1, 2, 4 … 60 minutes): one that fails or never reports back goes again then.
create function ish.staff_alerts_claim(p_limit int default 10)
returns table (id bigint, kind text, attempts int, data jsonb)
language plpgsql
set search_path = ish
as $$
#variable_conflict use_column
declare
  r record;
  v_data jsonb;
begin
  for r in
    with due as (
      select a.id
      from ish.staff_alerts a
      where a.sent_at is null and a.attempts < 8 and a.next_at <= now()
      order by a.next_at, a.id
      limit greatest(1, least(coalesce(p_limit, 10), 50))
      for update skip locked
    )
    update ish.staff_alerts a
    set attempts = a.attempts + 1,
        next_at = now() + make_interval(mins => least(60, (2 ^ a.attempts)::int))
    from due
    where a.id = due.id
    returning a.id as alert_id, a.kind as alert_kind, a.ref as alert_ref, a.attempts as alert_attempts
  loop
    v_data := ish.staff_alert_data(r.alert_kind, r.alert_ref);
    if v_data is null then
      -- Gone before it was told (a deleted business): nothing to say.
      update ish.staff_alerts a set sent_at = now(), last_error = 'gone' where a.id = r.alert_id;
      continue;
    end if;
    id := r.alert_id;
    kind := r.alert_kind;
    attempts := r.alert_attempts;
    data := v_data;
    return next;
  end loop;
end
$$;

create function ish.staff_alerts_done(p_id bigint)
returns void
language sql
set search_path = ish
as $$
  update ish.staff_alerts a set sent_at = now(), last_error = null where a.id = p_id;
$$;

create function ish.staff_alerts_fail(p_id bigint, p_error text)
returns void
language sql
set search_path = ish
as $$
  update ish.staff_alerts a set last_error = left(coalesce(nullif(p_error, ''), 'unknown'), 500) where a.id = p_id;
$$;

-- Every minute (pg_cron): what waits for a retry; sent or given up a month ago goes.
create function ish.staff_alerts_tick()
returns void
language plpgsql
security definer
set search_path = ish
as $$
begin
  delete from ish.staff_alerts a
  where (a.sent_at is not null or a.attempts >= 8) and a.created_at < now() - interval '30 days';
  perform ish.staff_alerts_kick();
end
$$;

revoke execute on function ish.staff_alerts_kick(), ish.staff_alert_data(text, uuid), ish.staff_alerts_claim(int),
  ish.staff_alerts_done(bigint), ish.staff_alerts_fail(bigint, text), ish.staff_alerts_tick()
  from public, anon, authenticated;
grant execute on function ish.staff_alert_data(text, uuid), ish.staff_alerts_claim(int),
  ish.staff_alerts_done(bigint), ish.staff_alerts_fail(bigint, text)
  to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('ish-staff-alerts', '* * * * *', 'select ish.staff_alerts_tick()');
  end if;
end
$$;
