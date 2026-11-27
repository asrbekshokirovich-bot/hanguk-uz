-- HanPyol: buying puyl by Korean bank transfer (계좌이체) on the web app and
-- in the Telegram mini app (Davrbek, 2026-11-26). The phone apps sell through
-- Google Play / the App Store (20261125110000); the web has no store, so:
--
--   1. The worker picks a pack: an order with a short code (HP4K7Q) is made,
--      'unpaid'. The page shows the bank account (ish.payment_settings, set
--      by the staff in the CRM — never in the code) and asks for the code as
--      the sender's name (입금자명).
--   2. «Pul o'tkazdim»: the order is 'pending' and the staff are told on
--      Telegram (ish-staff-alerts, kind 'topup').
--   3. The staff check the bank and approve (the puyl come once, with the
--      «+100 puyl» notice) or reject. An order never marked paid expires
--      after 24 hours ('expired'); money that comes anyway can still be
--      approved.
--
-- Also: a Telegram mini app user is told on Telegram (the HanPyol bot), like
-- a phone is told by push: ish.push_tokens gets platform 'telegram' with the
-- token 'tg:<telegram id>' (written by ish-telegram-auth only).

-- ---------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------
alter table ish.topup_requests drop constraint topup_requests_status_check;
alter table ish.topup_requests add constraint topup_requests_status_check
  check (status in ('unpaid', 'pending', 'approved', 'rejected', 'expired'));
alter table ish.topup_requests add column code text check (code ~ '^HP[2-9A-HJ-NP-Z]{4}$');
alter table ish.topup_requests add column paid_at timestamptz;
create unique index topup_requests_code_key on ish.topup_requests (code) where code is not null;
create index topup_requests_unpaid_idx on ish.topup_requests (created_at) where status = 'unpaid';

-- The bank account, apart (each with its copy button), and the help contact.
alter table ish.payment_settings drop constraint payment_settings_key_check;
alter table ish.payment_settings add constraint payment_settings_key_check check (key in (
  'bank', 'kakaopay', 'toss', 'note', 'bank_name', 'bank_account', 'bank_holder', 'contact'));

create or replace function ish.staff_set_payment_setting(p_key text, p_value text)
returns void
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_staff uuid := ish.require_staff();
begin
  if p_key not in ('bank', 'kakaopay', 'toss', 'note', 'bank_name', 'bank_account', 'bank_holder', 'contact')
     or char_length(coalesce(p_value, '')) > 500 then
    raise exception 'INVALID';
  end if;
  insert into ish.payment_settings (key, value, updated_at, updated_by)
  values (p_key, btrim(coalesce(p_value, '')), now(), v_staff)
  on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = v_staff;
end
$$;

-- Unpaid orders older than a day: expired (pg_cron hourly, and before reads).
create or replace function ish.expire_topups()
returns integer
language plpgsql
security definer
set search_path = ish
as $$
declare
  n int;
begin
  update ish.topup_requests set status = 'expired', decided_at = now()
  where status = 'unpaid' and created_at < now() - interval '24 hours';
  get diagnostics n = row_count;
  return n;
end
$$;
revoke execute on function ish.expire_topups() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('ish-expire-topups', '17 * * * *', 'select ish.expire_topups()');
  end if;
end
$$;

-- A new order for a pack: its code and amount.
create or replace function ish.start_topup(p_pyols integer)
returns jsonb
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_uid uuid := ish.require_uid();
  v_won int;
  v_code text;
  v_row ish.topup_requests;
  v_letters constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
begin
  if not exists (select 1 from ish.worker_profiles where user_id = v_uid) then
    raise exception 'NOT_FOUND';
  end if;
  select (p ->> 'won')::int into v_won
  from jsonb_array_elements(ish.pyol_packs()) p where (p ->> 'pyols')::int = p_pyols;
  if v_won is null then
    raise exception 'INVALID';
  end if;
  perform ish.expire_topups();
  if (select count(*) from ish.topup_requests
      where worker_id = v_uid and status in ('unpaid', 'pending')) >= 3 then
    raise exception 'TOO_MANY';
  end if;
  loop
    v_code := 'HP' || (select string_agg(substr(v_letters, 1 + floor(random() * 32)::int, 1), '')
                       from generate_series(1, 4));
    exit when not exists (select 1 from ish.topup_requests where code = v_code);
  end loop;
  insert into ish.topup_requests (worker_id, pyols, amount_won, method, payer_name, status, code)
  values (v_uid, p_pyols, v_won, 'bank', v_code, 'unpaid', v_code)
  returning * into v_row;
  return ish.topup_json(v_row);
end
$$;
revoke execute on function ish.start_topup(integer) from public, anon;
grant execute on function ish.start_topup(integer) to authenticated;

-- One order as the worker sees it.
create or replace function ish.topup_json(t ish.topup_requests)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'id', t.id, 'code', t.code, 'pyols', t.pyols, 'amount_won', t.amount_won,
    'status', case when t.status = 'unpaid' and t.created_at < now() - interval '24 hours'
                   then 'expired' else t.status end,
    'created_at', t.created_at, 'expires_at', t.created_at + interval '24 hours',
    'paid_at', t.paid_at, 'decided_at', t.decided_at, 'note', t.note)
$$;
revoke execute on function ish.topup_json(ish.topup_requests) from public, anon, authenticated;

-- «Pul o'tkazdim»: the staff check now.
create or replace function ish.topup_paid(p_request uuid)
returns jsonb
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_uid uuid := ish.require_uid();
  v_row ish.topup_requests;
begin
  select * into v_row from ish.topup_requests where id = p_request and worker_id = v_uid for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if v_row.status = 'unpaid' and v_row.created_at < now() - interval '24 hours' then
    update ish.topup_requests set status = 'expired', decided_at = now() where id = p_request;
    raise exception 'EXPIRED';
  end if;
  if v_row.status = 'unpaid' then
    update ish.topup_requests set status = 'pending', paid_at = now() where id = p_request
    returning * into v_row;
    insert into ish.staff_alerts (kind, ref) values ('topup', p_request) on conflict do nothing;
    perform ish.staff_alerts_kick();
  elsif v_row.status = 'expired' then
    raise exception 'EXPIRED';
  end if;
  -- Already pending or decided: nothing more (a second tap).
  return ish.topup_json(v_row);
end
$$;
revoke execute on function ish.topup_paid(uuid) from public, anon;
grant execute on function ish.topup_paid(uuid) to authenticated;

-- The worker's own orders, newest first.
create or replace function ish.my_topups()
returns jsonb
language sql
stable
security definer
set search_path = ish
as $$
  select coalesce(jsonb_agg(ish.topup_json(t) order by t.created_at desc), '[]'::jsonb)
  from (select * from ish.topup_requests where worker_id = auth.uid() order by created_at desc limit 20) t
$$;
revoke execute on function ish.my_topups() from public, anon;
grant execute on function ish.my_topups() to authenticated;

-- The staff: what the worker paid with (the code) and when they said so; an
-- order is approved whenever the money is seen — even unpaid or expired.
create or replace function ish.staff_topups(p_status text default 'pending')
returns jsonb
language plpgsql
stable
security definer
set search_path = ish
as $$
begin
  perform ish.require_staff();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', t.id, 'worker_id', t.worker_id, 'first_name', p.first_name, 'last_name', p.last_name,
      'phone', p.phone, 'pyols', t.pyols, 'amount_won', t.amount_won, 'method', t.method,
      'payer_name', t.payer_name, 'code', t.code, 'status', t.status, 'note', t.note,
      'created_at', t.created_at, 'paid_at', t.paid_at, 'decided_at', t.decided_at)
      order by coalesce(t.paid_at, t.created_at) desc)
    from (select * from ish.topup_requests
          where p_status is null or status = p_status
          order by coalesce(paid_at, created_at) desc limit 300) t
    join ish.profiles p on p.id = t.worker_id), '[]'::jsonb);
end
$$;

create or replace function ish.staff_approve_topup(p_request uuid)
returns integer
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_staff uuid := ish.require_staff();
  v_req ish.topup_requests;
begin
  select * into v_req from ish.topup_requests where id = p_request for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if v_req.status not in ('unpaid', 'pending', 'expired') then
    raise exception 'ALREADY_DECIDED';
  end if;
  update ish.topup_requests set status = 'approved', staff_id = v_staff, decided_at = now()
  where id = p_request;
  return ish.coin_move(v_req.worker_id, v_req.pyols, 'topup', null, v_staff,
                       'topup ' || v_req.amount_won || ' won by ' || v_req.method
                       || coalesce(' ' || v_req.code, ''));
end
$$;

create or replace function ish.staff_reject_topup(p_request uuid, p_note text default '')
returns void
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_staff uuid := ish.require_staff();
begin
  update ish.topup_requests
  set status = 'rejected', staff_id = v_staff, decided_at = now(), note = left(btrim(coalesce(p_note, '')), 300)
  where id = p_request and status in ('unpaid', 'pending');
  if not found then
    raise exception 'NOT_FOUND';
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- The staff's Telegram message
-- ---------------------------------------------------------------------
alter table ish.staff_alerts drop constraint staff_alerts_kind_check;
alter table ish.staff_alerts add constraint staff_alerts_kind_check
  check (kind in ('business_opened', 'report', 'topup'));

create or replace function ish.staff_alert_data(p_kind text, p_ref uuid)
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
  elsif p_kind = 'topup' then
    return (select jsonb_build_object(
              'code', t.code, 'pyols', t.pyols, 'amount_won', t.amount_won, 'status', t.status,
              'paid_at', t.paid_at,
              'worker', jsonb_build_object('first_name', p.first_name, 'last_name', p.last_name, 'phone', p.phone))
            from ish.topup_requests t join ish.profiles p on p.id = t.worker_id
            where t.id = p_ref);
  end if;
  return null;
end
$$;

-- ---------------------------------------------------------------------
-- Telegram as a «phone» for notifications
-- ---------------------------------------------------------------------
alter table ish.push_tokens drop constraint push_tokens_platform_check;
alter table ish.push_tokens add constraint push_tokens_platform_check
  check (platform in ('android', 'ios', 'telegram'));

-- The apps register FCM tokens only; 'tg:' tokens are written by
-- ish-telegram-auth (after Telegram's signature is checked).
create or replace function ish.register_push_token(p_token text, p_app text, p_platform text default 'android')
returns void
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_uid uuid := ish.require_uid();
begin
  if coalesce(p_platform, 'android') not in ('android', 'ios') or p_token like 'tg:%' then
    raise exception 'INVALID';
  end if;
  insert into ish.push_tokens (token, user_id, app, platform, updated_at)
  values (p_token, v_uid, p_app, coalesce(p_platform, 'android'), now())
  on conflict (token) do update
    set user_id = excluded.user_id, app = excluded.app, platform = excluded.platform, updated_at = now();
end
$$;
