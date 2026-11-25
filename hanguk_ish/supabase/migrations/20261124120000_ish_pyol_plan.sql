-- Hanguk Ish: the pyol business plan (Nov 2026).
--
--   * Free pyols: 90 when a worker finishes sign-up (once per phone
--     number), and on the 1st of each month (Asia/Seoul) every active
--     worker is topped up to 90.
--   * Invite a friend: after the friend's first finished job, 60 pyols to
--     the inviter and 30 to the friend.
--   * Buying pyols outside the app stores: the worker asks for a pack
--     (bank transfer, KakaoPay or Toss), the staff check the money came and
--     approve it (reason 'topup', so sold pyols can be counted).
--   * Long-term hires: the staff mark a hire, check after 14 days that the
--     worker stayed, and mark the employer's ₩50,000 fee as paid.
--   * Staff gifts: at most ±300 per call and 1,000 per worker per day,
--     always with a note.

-- ---------------------------------------------------------------------
-- Free pyols at sign-up.
-- ---------------------------------------------------------------------
create table ish.signup_bonuses (
  phone text primary key,
  worker_id uuid references ish.profiles (id) on delete set null,
  given_at timestamptz not null default now()
);
alter table ish.signup_bonuses enable row level security;
revoke all on ish.signup_bonuses from public, anon, authenticated;

create or replace function ish.signup_bonus_amount() returns integer
language sql immutable as $$ select 90 $$;

-- Gives the sign-up pyols once per phone number; false if given before.
create or replace function ish.give_signup_bonus(p_worker uuid)
returns boolean
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_phone text;
begin
  select coalesce(nullif(u.phone, ''), 'user:' || u.id::text) into v_phone
  from auth.users u where u.id = p_worker;
  if v_phone is null then
    return false;
  end if;
  insert into ish.signup_bonuses (phone, worker_id) values (v_phone, p_worker)
  on conflict do nothing;
  if not found then
    return false;
  end if;
  perform ish.coin_move(p_worker, ish.signup_bonus_amount(), 'bonus', null, null, 'sign-up');
  return true;
end
$$;
revoke execute on function ish.give_signup_bonus(uuid) from public, anon, authenticated;

create or replace function ish.save_worker_profile(p_first_name text, p_last_name text, p_languages text[],
  p_topik integer, p_university text, p_district text, p_availability integer, p_visa text,
  p_avatar_path text default null)
returns jsonb
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_uid uuid := ish.require_uid();
  v_new boolean;
begin
  if coalesce(btrim(p_first_name), '') = '' or coalesce(btrim(p_last_name), '') = '' then
    raise exception 'NAME_REQUIRED';
  end if;
  if coalesce(cardinality(p_languages), 0) = 0 then
    raise exception 'LANGUAGES_REQUIRED';
  end if;
  if coalesce(btrim(p_district), '') = '' then
    raise exception 'DISTRICT_REQUIRED';
  end if;
  if p_avatar_path is not null and p_avatar_path !~ ('^' || v_uid::text || '/[^/]+$') then
    raise exception 'INVALID';
  end if;

  v_new := not exists (select 1 from ish.worker_profiles where user_id = v_uid and onboarded_at is not null);

  update ish.profiles
  set first_name = btrim(p_first_name),
      last_name = btrim(p_last_name),
      avatar_path = coalesce(p_avatar_path, avatar_path)
  where id = v_uid;

  insert into ish.worker_profiles (user_id, languages, topik, university, district, availability,
                                      visa, onboarded_at)
  values (v_uid, p_languages, coalesce(p_topik, 0), nullif(btrim(p_university), ''), btrim(p_district),
          coalesce(p_availability, 0), p_visa, now())
  on conflict (user_id) do update set
    languages = excluded.languages,
    topik = excluded.topik,
    university = excluded.university,
    district = excluded.district,
    availability = excluded.availability,
    visa = excluded.visa,
    onboarded_at = coalesce(ish.worker_profiles.onboarded_at, excluded.onboarded_at);

  if v_new then
    perform ish.give_signup_bonus(v_uid);
  end if;
  return ish.my_profile();
end
$$;

-- ---------------------------------------------------------------------
-- Monthly free pyols: on the 1st (Seoul), top up to 90.
-- ---------------------------------------------------------------------
create or replace function ish.monthly_bonus(p_force boolean default false)
returns integer
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_count int := 0;
  r record;
begin
  if not p_force and extract(day from now() at time zone 'Asia/Seoul') <> 1 then
    return 0;
  end if;
  for r in
    select w.user_id, coalesce(cw.balance, 0) as balance
    from ish.worker_profiles w
    left join ish.coin_wallets cw on cw.worker_id = w.user_id
    where w.onboarded_at is not null
      and coalesce(cw.balance, 0) < 90
      and (exists (select 1 from ish.profiles p where p.id = w.user_id
                   and p.created_at > now() - interval '60 days')
           or exists (select 1 from ish.applications a where a.worker_id = w.user_id
                      and a.created_at > now() - interval '60 days')
           or exists (select 1 from ish.job_offers o where o.worker_id = w.user_id
                      and o.created_at > now() - interval '60 days'))
      and not exists (select 1 from ish.coin_ledger l
                      where l.worker_id = w.user_id and l.reason = 'bonus'
                        and l.note = 'monthly ' || to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM'))
  loop
    perform ish.coin_move(r.user_id, 90 - r.balance, 'bonus', null, null,
                          'monthly ' || to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM'));
    v_count := v_count + 1;
  end loop;
  return v_count;
end
$$;
revoke execute on function ish.monthly_bonus(boolean) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- 15:05 UTC = 00:05 in Seoul; the function acts only on the 1st.
    perform cron.schedule('ish-monthly-bonus', '5 15 * * *', 'select ish.monthly_bonus()');
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- Invite a friend.
-- ---------------------------------------------------------------------
alter table ish.worker_profiles
  add column referral_code text unique,
  add column referred_by uuid references ish.profiles (id) on delete set null;
update ish.worker_profiles
set referral_code = upper(substr(md5(user_id::text || random()::text), 1, 6))
where referral_code is null;
alter table ish.worker_profiles
  alter column referral_code set default upper(substr(md5(gen_random_uuid()::text), 1, 6));

create table ish.referral_rewards (
  friend_id uuid primary key references ish.profiles (id) on delete cascade,
  inviter_id uuid not null references ish.profiles (id) on delete cascade,
  given_at timestamptz not null default now()
);
alter table ish.referral_rewards enable row level security;
revoke all on ish.referral_rewards from public, anon, authenticated;

-- The worker enters a friend's code (once, before their first finished job).
create or replace function ish.set_referrer(p_code text)
returns boolean
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_uid uuid := ish.require_uid();
  v_inviter uuid;
begin
  select user_id into v_inviter from ish.worker_profiles
  where referral_code = upper(btrim(coalesce(p_code, '')));
  if v_inviter is null then
    raise exception 'NOT_FOUND';
  end if;
  if v_inviter = v_uid then
    raise exception 'INVALID';
  end if;
  if exists (select 1 from ish.worker_profiles where user_id = v_uid and referred_by is not null)
     or exists (select 1 from ish.applications where worker_id = v_uid and status = 'completed') then
    raise exception 'TOO_LATE';
  end if;
  update ish.worker_profiles set referred_by = v_inviter where user_id = v_uid;
  return found;
end
$$;
revoke execute on function ish.set_referrer(text) from public, anon;
grant execute on function ish.set_referrer(text) to authenticated;

create or replace function ish.referral_on_completed()
returns trigger
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_inviter uuid;
begin
  if new.status <> 'completed' or old.status = 'completed' then
    return new;
  end if;
  select referred_by into v_inviter from ish.worker_profiles where user_id = new.worker_id;
  if v_inviter is null then
    return new;
  end if;
  insert into ish.referral_rewards (friend_id, inviter_id) values (new.worker_id, v_inviter)
  on conflict do nothing;
  if found then
    perform ish.coin_move(v_inviter, 60, 'bonus', null, null, 'invited a friend');
    perform ish.coin_move(new.worker_id, 30, 'bonus', null, null, 'came with a friend''s code');
  end if;
  return new;
end
$$;
create trigger applications_referral after update of status on ish.applications
  for each row execute function ish.referral_on_completed();

-- ---------------------------------------------------------------------
-- Buying pyols outside the app stores.
-- ---------------------------------------------------------------------
create or replace function ish.pyol_packs()
returns jsonb
language sql
immutable
as $$
  select '[{"pyols": 30, "won": 3300}, {"pyols": 100, "won": 9900}, {"pyols": 300, "won": 24000}]'::jsonb
$$;
grant execute on function ish.pyol_packs() to anon, authenticated;

create table ish.payment_settings (
  key text primary key check (key in ('bank', 'kakaopay', 'toss', 'note')),
  value text not null default '' check (char_length(value) <= 500),
  updated_at timestamptz not null default now(),
  updated_by uuid references ish.profiles (id) on delete set null
);
alter table ish.payment_settings enable row level security;
revoke all on ish.payment_settings from public, anon, authenticated;

create table ish.topup_requests (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references ish.profiles (id) on delete cascade,
  pyols integer not null check (pyols > 0),
  amount_won integer not null check (amount_won > 0),
  method text not null check (method in ('bank', 'kakaopay', 'toss')),
  payer_name text not null default '' check (char_length(payer_name) <= 100),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  staff_id uuid references ish.profiles (id) on delete set null,
  note text not null default '' check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index topup_requests_pending_idx on ish.topup_requests (created_at) where status = 'pending';
alter table ish.topup_requests enable row level security;
create policy topup_requests_read on ish.topup_requests
  for select to authenticated using (worker_id = auth.uid() or ish.is_staff());
revoke all on ish.topup_requests from public, anon, authenticated;
grant select on ish.topup_requests to authenticated;

-- What the worker sees on «Buy pyols».
create or replace function ish.payment_details()
returns jsonb
language sql
stable
security definer
set search_path = ish
as $$
  select jsonb_build_object(
    'packs', ish.pyol_packs(),
    'methods', coalesce((select jsonb_object_agg(key, value) from ish.payment_settings), '{}'::jsonb),
    'pending', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'pyols', t.pyols, 'amount_won', t.amount_won,
                                                             'method', t.method, 'created_at', t.created_at)
                                          order by t.created_at desc)
                         from ish.topup_requests t where t.worker_id = auth.uid() and t.status = 'pending'),
                        '[]'::jsonb))
$$;
revoke execute on function ish.payment_details() from public, anon;
grant execute on function ish.payment_details() to authenticated;

create or replace function ish.request_topup(p_pyols integer, p_method text, p_payer_name text default '')
returns uuid
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_uid uuid := ish.require_uid();
  v_won int;
  v_id uuid;
begin
  if not exists (select 1 from ish.worker_profiles where user_id = v_uid) then
    raise exception 'NOT_FOUND';
  end if;
  select (p ->> 'won')::int into v_won
  from jsonb_array_elements(ish.pyol_packs()) p where (p ->> 'pyols')::int = p_pyols;
  if v_won is null or p_method not in ('bank', 'kakaopay', 'toss')
     or char_length(coalesce(p_payer_name, '')) > 100 then
    raise exception 'INVALID';
  end if;
  if (select count(*) from ish.topup_requests where worker_id = v_uid and status = 'pending') >= 3 then
    raise exception 'TOO_MANY';
  end if;
  insert into ish.topup_requests (worker_id, pyols, amount_won, method, payer_name)
  values (v_uid, p_pyols, v_won, p_method, btrim(coalesce(p_payer_name, '')))
  returning id into v_id;
  return v_id;
end
$$;
revoke execute on function ish.request_topup(integer, text, text) from public, anon;
grant execute on function ish.request_topup(integer, text, text) to authenticated;

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
      'payer_name', t.payer_name, 'status', t.status, 'note', t.note,
      'created_at', t.created_at, 'decided_at', t.decided_at) order by t.created_at desc)
    from (select * from ish.topup_requests
          where p_status is null or status = p_status
          order by created_at desc limit 300) t
    join ish.profiles p on p.id = t.worker_id), '[]'::jsonb);
end
$$;
revoke execute on function ish.staff_topups(text) from public, anon;
grant execute on function ish.staff_topups(text) to authenticated;

-- Approve once: a second click changes nothing.
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
  if v_req.status <> 'pending' then
    raise exception 'ALREADY_DECIDED';
  end if;
  update ish.topup_requests set status = 'approved', staff_id = v_staff, decided_at = now()
  where id = p_request;
  return ish.coin_move(v_req.worker_id, v_req.pyols, 'topup', null, v_staff,
                       'topup ' || v_req.amount_won || ' won by ' || v_req.method);
end
$$;
revoke execute on function ish.staff_approve_topup(uuid) from public, anon;
grant execute on function ish.staff_approve_topup(uuid) to authenticated;

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
  where id = p_request and status = 'pending';
  if not found then
    raise exception 'NOT_FOUND';
  end if;
end
$$;
revoke execute on function ish.staff_reject_topup(uuid, text) from public, anon;
grant execute on function ish.staff_reject_topup(uuid, text) to authenticated;

create or replace function ish.staff_set_payment_setting(p_key text, p_value text)
returns void
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_staff uuid := ish.require_staff();
begin
  if p_key not in ('bank', 'kakaopay', 'toss', 'note') or char_length(coalesce(p_value, '')) > 500 then
    raise exception 'INVALID';
  end if;
  insert into ish.payment_settings (key, value, updated_at, updated_by)
  values (p_key, btrim(coalesce(p_value, '')), now(), v_staff)
  on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = v_staff;
end
$$;
revoke execute on function ish.staff_set_payment_setting(text, text) from public, anon;
grant execute on function ish.staff_set_payment_setting(text, text) to authenticated;

-- Pyols by kind and day, so sold pyols can be counted.
create or replace function ish.staff_pyol_report(p_days integer default 30)
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
      'day', d, 'sold', sold, 'sold_won', sold_won, 'free', free, 'gift', gift,
      'refunded', refunded, 'spent', spent) order by d desc)
    from (
      select l.d, l.sold, t.sold_won, l.free, l.gift, l.refunded, l.spent
      from (
        select (created_at at time zone 'Asia/Seoul')::date as d,
               sum(delta) filter (where reason = 'topup') as sold,
               sum(delta) filter (where reason = 'bonus') as free,
               sum(delta) filter (where reason = 'staff') as gift,
               sum(delta) filter (where reason = 'refund') as refunded,
               -sum(delta) filter (where reason = 'unlock') as spent
        from ish.coin_ledger
        where created_at > now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 366)))
        group by 1) l
      left join (
        select (decided_at at time zone 'Asia/Seoul')::date as d, sum(amount_won) as sold_won
        from ish.topup_requests where status = 'approved'
        group by 1) t on t.d = l.d) x), '[]'::jsonb);
end
$$;
revoke execute on function ish.staff_pyol_report(integer) from public, anon;
grant execute on function ish.staff_pyol_report(integer) to authenticated;

-- ---------------------------------------------------------------------
-- Staff gifts: limits and a note.
-- ---------------------------------------------------------------------
create or replace function ish.staff_add_coins(p_worker uuid, p_delta integer, p_note text default '')
returns integer
language plpgsql
security definer
set search_path = ish
as $$
begin
  perform ish.require_staff();
  if p_delta is null or p_delta = 0 or p_delta not between -300 and 300
     or char_length(coalesce(p_note, '')) > 300 then
    raise exception 'INVALID';
  end if;
  if coalesce(btrim(p_note), '') = '' then
    raise exception 'NOTE_REQUIRED';
  end if;
  if not exists (select 1 from ish.worker_profiles where user_id = p_worker) then
    raise exception 'NOT_FOUND';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('ish.staff_coins:' || p_worker::text, 0));
  if (select coalesce(sum(abs(delta)), 0) from ish.coin_ledger
      where worker_id = p_worker and reason = 'staff' and created_at > now() - interval '1 day')
     + abs(p_delta) > 1000 then
    raise exception 'DAILY_LIMIT';
  end if;
  return ish.coin_move(p_worker, p_delta, 'staff', null, auth.uid(), btrim(p_note));
end
$$;

-- ---------------------------------------------------------------------
-- Long-term hires and the employer's fee.
-- ---------------------------------------------------------------------
create table ish.monthly_hires (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references ish.monthly_jobs (id) on delete cascade,
  worker_id uuid not null references ish.profiles (id) on delete cascade,
  hired_at date not null default (now() at time zone 'Asia/Seoul')::date,
  still_working_at_14_days boolean,
  checked_at timestamptz,
  fee_won integer not null default 50000 check (fee_won >= 0),
  fee_paid_at timestamptz,
  note text not null default '' check (char_length(note) <= 300),
  created_by uuid references ish.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (job_id, worker_id)
);
alter table ish.monthly_hires enable row level security;
revoke all on ish.monthly_hires from public, anon, authenticated;

create or replace function ish.staff_mark_hired(p_job uuid, p_worker uuid, p_hired_at date default null,
                                                p_fee_won integer default 50000)
returns uuid
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_staff uuid := ish.require_staff();
  v_id uuid;
begin
  if not exists (select 1 from ish.monthly_jobs where id = p_job)
     or not exists (select 1 from ish.worker_profiles where user_id = p_worker) then
    raise exception 'NOT_FOUND';
  end if;
  if coalesce(p_fee_won, 0) < 0 then
    raise exception 'INVALID';
  end if;
  insert into ish.monthly_hires (job_id, worker_id, hired_at, fee_won, created_by)
  values (p_job, p_worker, coalesce(p_hired_at, (now() at time zone 'Asia/Seoul')::date),
          coalesce(p_fee_won, 50000), v_staff)
  on conflict (job_id, worker_id) do update set hired_at = excluded.hired_at, fee_won = excluded.fee_won
  returning id into v_id;
  return v_id;
end
$$;
revoke execute on function ish.staff_mark_hired(uuid, uuid, date, integer) from public, anon;
grant execute on function ish.staff_mark_hired(uuid, uuid, date, integer) to authenticated;

create or replace function ish.staff_confirm_two_weeks(p_hire uuid, p_still_working boolean)
returns void
language plpgsql
security definer
set search_path = ish
as $$
begin
  perform ish.require_staff();
  update ish.monthly_hires set still_working_at_14_days = p_still_working, checked_at = now()
  where id = p_hire and hired_at + 14 <= (now() at time zone 'Asia/Seoul')::date;
  if not found then
    raise exception 'NOT_DUE';
  end if;
end
$$;
revoke execute on function ish.staff_confirm_two_weeks(uuid, boolean) from public, anon;
grant execute on function ish.staff_confirm_two_weeks(uuid, boolean) to authenticated;

create or replace function ish.staff_mark_fee_paid(p_hire uuid)
returns void
language plpgsql
security definer
set search_path = ish
as $$
begin
  perform ish.require_staff();
  update ish.monthly_hires set fee_paid_at = now()
  where id = p_hire and still_working_at_14_days and fee_paid_at is null;
  if not found then
    raise exception 'NOT_DUE';
  end if;
end
$$;
revoke execute on function ish.staff_mark_fee_paid(uuid) from public, anon;
grant execute on function ish.staff_mark_fee_paid(uuid) to authenticated;

-- Hires for the CRM: due for the 2-week check, fees not paid yet.
create or replace function ish.staff_monthly_hires()
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
      'id', h.id, 'job_id', h.job_id, 'title', j.title, 'company', j.company,
      'worker_id', h.worker_id, 'first_name', p.first_name, 'last_name', p.last_name, 'phone', p.phone,
      'hired_at', h.hired_at, 'check_due', h.hired_at + 14,
      'still_working', h.still_working_at_14_days, 'fee_won', h.fee_won, 'fee_paid_at', h.fee_paid_at,
      'state', case
        when h.still_working_at_14_days is null and h.hired_at + 14 <= (now() at time zone 'Asia/Seoul')::date then 'check_due'
        when h.still_working_at_14_days is null then 'waiting'
        when h.still_working_at_14_days and h.fee_paid_at is null then 'fee_unpaid'
        when h.still_working_at_14_days then 'fee_paid'
        else 'left' end)
      order by h.hired_at desc)
    from ish.monthly_hires h
    join ish.monthly_jobs j on j.id = h.job_id
    join ish.profiles p on p.id = h.worker_id), '[]'::jsonb);
end
$$;
revoke execute on function ish.staff_monthly_hires() from public, anon;
grant execute on function ish.staff_monthly_hires() to authenticated;

-- The worker's own invite code (for «Invite a friend»).
create or replace function ish.my_referral()
returns jsonb
language sql
stable
security definer
set search_path = ish
as $$
  select jsonb_build_object('code', w.referral_code, 'invited_by', w.referred_by is not null,
                            'friends_rewarded', (select count(*)::int from ish.referral_rewards r
                                                 where r.inviter_id = w.user_id),
                            'inviter_gets', 60, 'friend_gets', 30)
  from ish.worker_profiles w where w.user_id = auth.uid()
$$;
revoke execute on function ish.my_referral() from public, anon;
grant execute on function ish.my_referral() to authenticated;
