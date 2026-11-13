-- Hanguk Ish — push notifications (P56, 2026-11-13).
--
-- A12 (worker app) and 알림 (사장님 app) were seen only with the app open
-- (Realtime). Now a notification for someone with a phone registered for
-- that app (ish.push_tokens, register_push_token — the apps register once
-- Firebase is set up) goes into ish.push_queue, and the statement asks the
-- edge function `ish-push` (ish.ask_function, P55) to send it through FCM:
-- the A12 / 알림 title and line, in the reader's language. The pg_cron job
-- `ish-push` asks again every minute while something is due.
--
--   * A notification read, or older than 30 minutes, is not pushed any more
--     («your shift starts in 2 hours» an hour late would be wrong).
--   * Tries: 1, 2, 4, 8, 16 minutes apart, 5 at most.
--   * A token FCM no longer knows is dropped (push_drop_token).
--   * Which app: 사장님's kinds and a chat message to a business go to the
--     사장님 app, the rest to the worker app — as the apps show them.

create table ish.push_queue (
  notification_id bigint primary key references ish.notifications (id) on delete cascade,
  created_at timestamptz not null default now(),
  next_at timestamptz not null default now(),
  attempts smallint not null default 0,
  last_error text check (char_length(last_error) <= 500)
);

comment on table ish.push_queue is
  'Notifications waiting for ish-push (P56). Only the service role and the database''s own code use it.';

create index push_queue_due_idx on ish.push_queue (next_at) where attempts < 5;

alter table ish.push_queue enable row level security;
revoke all on ish.push_queue from public, anon, authenticated;
grant all on ish.push_queue to service_role;

-- The app that shows a notification of [p_kind] (null: none shows it).
create function ish.push_app(p_kind text, p_data jsonb)
returns text
language sql
immutable
set search_path = ish
as $$
  select case
    when p_kind in ('new_applicant', 'worker_cancelled', 'no_show') then 'employer'
    when p_kind = 'chat_message' and coalesce(p_data, '{}'::jsonb) ? 'worker_id' then 'employer'
    when p_kind = 'payment_marked' and coalesce((p_data ->> 'paid')::boolean, false) is not true then null
    when p_kind in ('shift_reminder', 'application_confirmed', 'application_rejected', 'new_shift_match',
                    'nearby_digest', 'request_again', 'chat_message', 'payment_marked', 'job_offer') then 'worker'
  end
$$;

create function ish.push_queue_row()
returns trigger
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_app text := ish.push_app(new.kind, new.data);
begin
  if v_app is not null and new.read_at is null
     and exists (select 1 from ish.push_tokens t where t.user_id = new.user_id and t.app = v_app) then
    insert into ish.push_queue (notification_id) values (new.id) on conflict do nothing;
  end if;
  return null;
end
$$;

create function ish.push_kick()
returns void
language plpgsql
security definer
set search_path = ish
as $$
begin
  if exists (select 1 from ish.push_queue q where q.attempts < 5 and q.next_at <= now()) then
    perform ish.ask_function('ish-push');
  end if;
end
$$;

create function ish.push_kick_after()
returns trigger
language plpgsql
security definer
set search_path = ish
as $$
begin
  perform ish.push_kick();
  return null;
end
$$;

create trigger notifications_push after insert on ish.notifications
  for each row execute function ish.push_queue_row();
create trigger notifications_push_kick after insert on ish.notifications
  for each statement execute function ish.push_kick_after();

-- Up to [p_limit] pushes due, each pushed back before it is returned
-- (1, 2, 4, 8, 16 minutes): its card (what my_notifications returns), the
-- reader's language and their phones for that app. Read, stale (30 minutes)
-- or phone-less ones leave the queue instead.
create function ish.push_claim(p_limit int default 20)
returns table (id bigint, attempts int, app text, lang text, tokens text[], card jsonb)
language plpgsql
set search_path = ish
as $$
#variable_conflict use_column
declare
  r record;
  v_n ish.notifications;
  v_app text;
  v_lang text;
  v_tokens text[];
begin
  for r in
    with due as (
      select q.notification_id
      from ish.push_queue q
      where q.attempts < 5 and q.next_at <= now()
      order by q.next_at, q.notification_id
      limit greatest(1, least(coalesce(p_limit, 20), 100))
      for update skip locked
    )
    update ish.push_queue q
    set attempts = q.attempts + 1,
        next_at = now() + make_interval(mins => (2 ^ q.attempts)::int)
    from due
    where q.notification_id = due.notification_id
    returning q.notification_id as job_id, q.attempts as job_attempts
  loop
    select * into v_n from ish.notifications n where n.id = r.job_id;
    v_app := case when v_n.id is null then null else ish.push_app(v_n.kind, v_n.data) end;
    select p.language::text into v_lang from ish.profiles p where p.id = v_n.user_id;
    select coalesce(array_agg(t.token order by t.updated_at desc), '{}') into v_tokens
    from ish.push_tokens t where t.user_id = v_n.user_id and t.app = v_app;
    if v_n.id is null or v_app is null or v_n.read_at is not null
       or v_n.created_at < now() - interval '30 minutes' or cardinality(v_tokens) = 0 then
      delete from ish.push_queue q where q.notification_id = r.job_id;
      continue;
    end if;
    id := r.job_id;
    attempts := r.job_attempts;
    app := v_app;
    lang := coalesce(v_lang, 'uz');
    tokens := v_tokens;
    card := ish.notification_card(r.job_id);
    return next;
  end loop;
end
$$;

create function ish.push_done(p_id bigint)
returns void
language sql
set search_path = ish
as $$
  delete from ish.push_queue q where q.notification_id = p_id;
$$;

create function ish.push_fail(p_id bigint, p_error text)
returns void
language sql
set search_path = ish
as $$
  update ish.push_queue q set last_error = left(coalesce(nullif(p_error, ''), 'unknown'), 500)
  where q.notification_id = p_id;
$$;

create function ish.push_drop_token(p_token text)
returns void
language sql
set search_path = ish
as $$
  delete from ish.push_tokens t where t.token = p_token;
$$;

-- Every minute (pg_cron): what waits for a retry; what was given up a day ago goes.
create function ish.push_tick()
returns void
language plpgsql
security definer
set search_path = ish
as $$
begin
  delete from ish.push_queue q where q.created_at < now() - interval '1 day';
  perform ish.push_kick();
end
$$;

revoke execute on function ish.push_app(text, jsonb), ish.push_kick(), ish.push_claim(int), ish.push_done(bigint),
  ish.push_fail(bigint, text), ish.push_drop_token(text), ish.push_tick()
  from public, anon, authenticated;
grant execute on function ish.push_app(text, jsonb), ish.push_claim(int), ish.push_done(bigint),
  ish.push_fail(bigint, text), ish.push_drop_token(text), ish.notification_card(bigint)
  to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('ish-push', '* * * * *', 'select ish.push_tick()');
  end if;
end
$$;
