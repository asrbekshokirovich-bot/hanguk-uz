-- Hanguk Ish: yellow and red cards, and a reward for bringing an employer
-- (Davrbek, 2026-11-25).
--
-- Workers. A no-show (the staff mark «kelmadi», or a business shift closes
-- with the worker never there) is a card:
--   1st: yellow — a warning, nothing is closed;
--   2nd: red — no new job for 14 days (apply, unlock, offers);
--   3rd: blocked — no new job until the staff lift it.
-- Every 5 jobs done since the last card take one step back (red → yellow →
-- none), so one mistake does not follow a worker for ever. The staff can
-- clear a card given by mistake (with a note).
--
-- Employers. Cancelling a job a worker had booked (confirmed, or paid for)
-- is a card; the staff can also give one («worse than promised»). Yellow,
-- then red (no new job for 14 days), then blocked. The worker's puyl came
-- back already (cancel_shift_now).
--
-- Employer invite. A business enters a worker's invite code once, in its
-- first 30 days and before its first finished job; when that first job is
-- done the worker gets 200 P («brought an employer»). Fake employers earn
-- nothing: the reward waits for a real finished job.

-- ---------------------------------------------------------------------
-- Cards
-- ---------------------------------------------------------------------
create table ish.cards (
  subject_id uuid primary key,
  -- 'worker' (subject = the worker) or 'business' (subject = the business).
  subject text not null check (subject in ('worker', 'business')),
  -- 0 none, 1 yellow, 2 red, 3 blocked.
  level smallint not null default 0 check (level between 0 and 3),
  red_until timestamptz,
  -- Jobs done since the last card (workers): 5 take one step back.
  good_jobs smallint not null default 0 check (good_jobs >= 0),
  updated_at timestamptz not null default now()
);
alter table ish.cards enable row level security;
revoke all on ish.cards from public, anon, authenticated;

create table ish.card_events (
  id bigint generated always as identity primary key,
  subject_id uuid not null,
  subject text not null check (subject in ('worker', 'business')),
  level smallint not null,
  why text not null check (why in ('no_show', 'cancelled_booked', 'staff', 'good_jobs', 'cleared')),
  application_id uuid,
  shift_id uuid,
  staff_id uuid,
  note text not null default '' check (char_length(note) <= 300),
  created_at timestamptz not null default now()
);
create index card_events_subject_idx on ish.card_events (subject_id, created_at desc);
alter table ish.card_events enable row level security;
revoke all on ish.card_events from public, anon, authenticated;

alter table ish.notifications drop constraint notifications_kind_check;
alter table ish.notifications add constraint notifications_kind_check check (kind in (
  'shift_reminder', 'application_confirmed', 'application_rejected', 'new_shift_match', 'nearby_digest',
  'new_applicant', 'worker_cancelled', 'no_show', 'request_again', 'chat_message', 'payment_marked',
  'job_offer', 'shift_finished', 'coins_added', 'topup_rejected', 'card_given', 'business_card'));

create or replace function ish.push_app(p_kind text, p_data jsonb)
returns text
language sql
immutable
set search_path = ish
as $$
  select case
    when p_kind in ('new_applicant', 'worker_cancelled', 'no_show', 'business_card') then 'employer'
    when p_kind = 'chat_message' and coalesce(p_data, '{}'::jsonb) ? 'worker_id' then 'employer'
    when p_kind = 'payment_marked' and coalesce((p_data ->> 'paid')::boolean, false) is not true then null
    when p_kind in ('shift_reminder', 'application_confirmed', 'application_rejected', 'new_shift_match',
                    'nearby_digest', 'request_again', 'chat_message', 'payment_marked', 'job_offer',
                    'shift_finished', 'coins_added', 'topup_rejected', 'card_given') then 'worker'
  end
$$;

-- The card a worker or business has now: level, and until when red lasts.
-- A red card whose 14 days are over counts as yellow-plus (level 2, not
-- closing anything): the next one blocks.
create or replace function ish.card_of(p_subject uuid)
returns jsonb
language sql
stable
security definer
set search_path = ish
as $$
  select case when c.subject_id is null or c.level = 0 then jsonb_build_object('level', 'none')
    else jsonb_build_object(
      'level', case c.level when 1 then 'yellow' when 2 then 'red' else 'blocked' end,
      'red_until', case when c.level = 2 and c.red_until > now() then c.red_until end,
      'closed', c.level = 3 or (c.level = 2 and c.red_until > now()),
      'good_jobs', c.good_jobs,
      'good_jobs_needed', 5)
  end
  from (select 1) one
  left join ish.cards c on c.subject_id = p_subject
$$;
revoke execute on function ish.card_of(uuid) from public, anon, authenticated;

-- True while the card closes new jobs (red for 14 days, or blocked).
create or replace function ish.card_closed(p_subject uuid)
returns boolean
language sql
stable
security definer
set search_path = ish
as $$
  select exists (select 1 from ish.cards c where c.subject_id = p_subject
                 and (c.level = 3 or (c.level = 2 and c.red_until > now())))
$$;
revoke execute on function ish.card_closed(uuid) from public, anon, authenticated;

-- One step up: yellow → red (14 days) → blocked. Tells the worker or the
-- business's people.
create or replace function ish.give_card(p_subject uuid, p_kind text, p_why text, p_application uuid,
                                         p_shift uuid, p_staff uuid, p_note text)
returns smallint
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_level smallint;
  v_until timestamptz;
begin
  insert into ish.cards (subject_id, subject, level, red_until, good_jobs, updated_at)
  values (p_subject, p_kind, 1, null, 0, now())
  on conflict (subject_id) do update
    set level = least(3, ish.cards.level + 1),
        red_until = case when ish.cards.level + 1 = 2 then now() + interval '14 days' else ish.cards.red_until end,
        good_jobs = 0,
        updated_at = now()
  returning level, red_until into v_level, v_until;
  insert into ish.card_events (subject_id, subject, level, why, application_id, shift_id, staff_id, note)
  values (p_subject, p_kind, v_level, p_why, p_application, p_shift, p_staff, left(coalesce(p_note, ''), 300));
  if p_kind = 'worker' then
    insert into ish.notifications (user_id, kind, data)
    values (p_subject, 'card_given', jsonb_strip_nulls(jsonb_build_object(
      'card', case v_level when 1 then 'yellow' when 2 then 'red' else 'blocked' end,
      'until', case when v_level = 2 then v_until end,
      'why', p_why, 'shift_id', p_shift, 'application_id', p_application)));
  else
    insert into ish.notifications (user_id, kind, data)
    select m.user_id, 'business_card', jsonb_strip_nulls(jsonb_build_object(
      'card', case v_level when 1 then 'yellow' when 2 then 'red' else 'blocked' end,
      'until', case when v_level = 2 then v_until end,
      'why', p_why, 'business_id', p_subject, 'shift_id', p_shift))
    from ish.business_members m where m.business_id = p_subject;
  end if;
  return v_level;
end
$$;
revoke execute on function ish.give_card(uuid, text, text, uuid, uuid, uuid, text) from public, anon, authenticated;

-- A worker with a closed card takes no new job: no application (apply,
-- unlock), no offer.
create or replace function ish.applications_card_guard()
returns trigger
language plpgsql
security definer
set search_path = ish
as $$
begin
  if new.status in ('pending', 'confirmed')
     and (tg_op = 'INSERT' or old.status not in ('pending', 'confirmed', 'checked_in'))
     and ish.card_closed(new.worker_id) then
    raise exception 'CARD_CLOSED';
  end if;
  return new;
end
$$;
revoke execute on function ish.applications_card_guard() from public, anon, authenticated;
create trigger applications_card_guard before insert or update of status on ish.applications
  for each row execute function ish.applications_card_guard();

create or replace function ish.monthly_applications_card_guard()
returns trigger
language plpgsql
security definer
set search_path = ish
as $$
begin
  if ish.card_closed(new.worker_id) then
    raise exception 'CARD_CLOSED';
  end if;
  return new;
end
$$;
revoke execute on function ish.monthly_applications_card_guard() from public, anon, authenticated;
create trigger monthly_applications_card_guard before insert on ish.monthly_applications
  for each row execute function ish.monthly_applications_card_guard();

-- Offers skip such workers (the rest of the list still goes).
create or replace function ish.job_offers_card_guard()
returns trigger
language plpgsql
security definer
set search_path = ish
as $$
begin
  if ish.card_closed(new.worker_id) then
    return null;
  end if;
  return new;
end
$$;
revoke execute on function ish.job_offers_card_guard() from public, anon, authenticated;
create trigger job_offers_card_guard before insert on ish.job_offers
  for each row execute function ish.job_offers_card_guard();

-- A business with a closed card posts no new job (the staff still can).
create or replace function ish.shifts_card_guard()
returns trigger
language plpgsql
security definer
set search_path = ish
as $$
begin
  if not ish.is_staff() and ish.card_closed(new.business_id) then
    raise exception 'BUSINESS_CARD';
  end if;
  return new;
end
$$;
revoke execute on function ish.shifts_card_guard() from public, anon, authenticated;
create trigger shifts_card_guard before insert on ish.shifts
  for each row execute function ish.shifts_card_guard();

-- ---------------------------------------------------------------------
-- Employer invite
-- ---------------------------------------------------------------------
alter table ish.businesses add column invited_by uuid references ish.profiles (id) on delete set null;
alter table ish.businesses add column invite_rewarded_at timestamptz;

-- The coin notice names the employer reward.
create or replace function ish.coin_ledger_notify()
returns trigger
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_why text;
begin
  if new.delta <= 0 then
    return null;
  end if;
  v_why := case
    when new.reason = 'topup' then 'topup'
    when new.reason = 'bonus' and new.note like 'monthly %' then 'monthly'
    when new.reason = 'bonus' and new.note in ('invited a friend', 'came with a friend''s code') then 'referral'
    when new.reason = 'bonus' and new.note = 'brought an employer' then 'employer'
    when new.reason = 'staff' then 'staff'
    -- A cancelled job says so itself (data.refunded).
    when new.reason = 'refund' and new.note <> 'shift_cancelled' then 'refund'
  end;
  if v_why is not null then
    insert into ish.notifications (user_id, kind, data)
    values (new.worker_id, 'coins_added', jsonb_strip_nulls(jsonb_build_object(
      'delta', new.delta, 'balance', new.balance, 'why', v_why, 'application_id', new.application_id)));
  end if;
  return null;
end
$$;

-- The business owner enters the worker's code: once, in the first 30 days,
-- before the first finished job; not one's own.
create or replace function ish.set_business_invite(p_business uuid, p_code text)
returns void
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_uid uuid := ish.require_uid();
  v_biz ish.businesses;
  v_worker uuid;
begin
  select * into v_biz from ish.businesses where id = p_business for update;
  if not found or not ish.is_business_member(p_business) then
    raise exception 'NOT_FOUND';
  end if;
  if v_biz.invited_by is not null or v_biz.created_at < now() - interval '30 days'
     or exists (select 1 from ish.applications a join ish.shifts s on s.id = a.shift_id
                where s.business_id = p_business and a.status = 'completed') then
    raise exception 'TOO_LATE';
  end if;
  select w.user_id into v_worker from ish.worker_profiles w
  where w.referral_code = upper(btrim(coalesce(p_code, '')));
  if v_worker is null then
    raise exception 'NOT_FOUND';
  end if;
  if v_worker = v_uid or exists (select 1 from ish.business_members m
                                 where m.business_id = p_business and m.user_id = v_worker) then
    raise exception 'INVALID';
  end if;
  update ish.businesses set invited_by = v_worker where id = p_business;
end
$$;
revoke execute on function ish.set_business_invite(uuid, text) from public, anon;
grant execute on function ish.set_business_invite(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- What a finished job or a no-show changes
-- ---------------------------------------------------------------------
create or replace function ish.applications_cards()
returns trigger
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_card ish.cards;
  v_biz ish.businesses;
begin
  if new.status = old.status then
    return null;
  end if;
  if new.status = 'no_show' then
    perform ish.give_card(new.worker_id, 'worker', 'no_show', new.id, new.shift_id, null, '');
  elsif new.status = 'completed' then
    -- Five good jobs: one step back.
    update ish.cards set good_jobs = good_jobs + 1, updated_at = now()
    where subject_id = new.worker_id and level between 1 and 3
    returning * into v_card;
    if found and v_card.good_jobs >= 5 and not (v_card.level = 2 and v_card.red_until > now()) then
      update ish.cards set level = level - 1, good_jobs = 0,
                           red_until = case when level - 1 = 2 then red_until end, updated_at = now()
      where subject_id = new.worker_id
      returning * into v_card;
      insert into ish.card_events (subject_id, subject, level, why, application_id, shift_id)
      values (new.worker_id, 'worker', v_card.level, 'good_jobs', new.id, new.shift_id);
    end if;
    -- The employer invite: the business's first finished job.
    select b.* into v_biz from ish.businesses b join ish.shifts s on s.business_id = b.id
    where s.id = new.shift_id for update of b;
    if v_biz.invited_by is not null and v_biz.invite_rewarded_at is null then
      update ish.businesses set invite_rewarded_at = now() where id = v_biz.id;
      perform ish.coin_move(v_biz.invited_by, 200, 'bonus', null, null, 'brought an employer');
    end if;
  end if;
  return null;
end
$$;
revoke execute on function ish.applications_cards() from public, anon, authenticated;
create trigger applications_cards after update of status on ish.applications
  for each row execute function ish.applications_cards();

-- An employer cancelling a job a worker had booked: a card.
create or replace function ish.cancel_shift(p_shift uuid)
returns ish.shifts
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_shift ish.shifts;
  v_booked boolean;
  v_result ish.shifts;
begin
  perform ish.require_uid();
  select * into v_shift from ish.shifts where id = p_shift for update;
  if not found or not ish.is_business_member(v_shift.business_id) then
    raise exception 'NOT_FOUND';
  end if;
  v_booked := exists (select 1 from ish.applications a where a.shift_id = p_shift
                      and (a.status in ('confirmed', 'checked_in')
                           or (a.status = 'pending' and a.coins_paid > 0)));
  v_result := ish.cancel_shift_now(p_shift, 'shift_cancelled');
  if v_booked and v_shift.status = 'open' then
    perform ish.give_card(v_shift.business_id, 'business', 'cancelled_booked', null, p_shift, null, '');
  end if;
  return v_result;
end
$$;

-- ---------------------------------------------------------------------
-- What the app and the staff see
-- ---------------------------------------------------------------------
create or replace function ish.my_card()
returns jsonb
language sql
stable
security definer
set search_path = ish
as $$
  select ish.card_of(auth.uid())
$$;
revoke execute on function ish.my_card() from public, anon;
grant execute on function ish.my_card() to authenticated;

create or replace function ish.my_business_card(p_business uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ish
as $$
begin
  if not (ish.is_business_member(p_business) or ish.is_staff()) then
    raise exception 'NOT_FOUND';
  end if;
  return ish.card_of(p_business) || jsonb_build_object(
    'invited', exists (select 1 from ish.businesses where id = p_business and invited_by is not null));
end
$$;
revoke execute on function ish.my_business_card(uuid) from public, anon;
grant execute on function ish.my_business_card(uuid) to authenticated;

-- The staff: a worker's or business's card and its history.
create or replace function ish.staff_card(p_subject uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ish
as $$
begin
  perform ish.require_staff();
  return ish.card_of(p_subject) || jsonb_build_object('events', coalesce((
    select jsonb_agg(jsonb_build_object('level', e.level, 'why', e.why, 'note', e.note,
                                        'shift_id', e.shift_id, 'created_at', e.created_at)
                     order by e.created_at desc)
    from ish.card_events e where e.subject_id = p_subject), '[]'::jsonb));
end
$$;
revoke execute on function ish.staff_card(uuid) from public, anon;
grant execute on function ish.staff_card(uuid) to authenticated;

-- The staff give a business a card (the job was worse than promised, …).
create or replace function ish.staff_give_business_card(p_business uuid, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_uid uuid := ish.require_staff();
begin
  if coalesce(btrim(p_note), '') = '' then
    raise exception 'NOTE_REQUIRED';
  end if;
  if not exists (select 1 from ish.businesses where id = p_business) then
    raise exception 'NOT_FOUND';
  end if;
  perform ish.give_card(p_business, 'business', 'staff', null, null, v_uid, btrim(p_note));
  return ish.card_of(p_business);
end
$$;
revoke execute on function ish.staff_give_business_card(uuid, text) from public, anon;
grant execute on function ish.staff_give_business_card(uuid, text) to authenticated;

-- The staff take a card back (given by mistake, the person explained, …).
create or replace function ish.staff_clear_card(p_subject uuid, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_uid uuid := ish.require_staff();
  v_card ish.cards;
begin
  if coalesce(btrim(p_note), '') = '' then
    raise exception 'NOTE_REQUIRED';
  end if;
  update ish.cards set level = 0, red_until = null, good_jobs = 0, updated_at = now()
  where subject_id = p_subject and level > 0
  returning * into v_card;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  insert into ish.card_events (subject_id, subject, level, why, staff_id, note)
  values (p_subject, v_card.subject, 0, 'cleared', v_uid, left(btrim(p_note), 300));
  return ish.card_of(p_subject);
end
$$;
revoke execute on function ish.staff_clear_card(uuid, text) from public, anon;
grant execute on function ish.staff_clear_card(uuid, text) to authenticated;

-- The nightly list shows the card, and a closed one is marked busy.
create or replace function ish.staff_free_workers(p_day date, p_district text default null)
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
      'worker_id', d.worker_id, 'first_name', p.first_name, 'last_name', p.last_name, 'phone', p.phone,
      'district', d.district, 'part', d.part, 'note', d.note,
      'languages', w.languages, 'topik', w.topik, 'reliability', w.reliability,
      'coins', coalesce(cw.balance, 0),
      'card', ish.card_of(d.worker_id) ->> 'level',
      'busy', ish.card_closed(d.worker_id)
              or exists (select 1 from ish.applications a join ish.shifts s on s.id = a.shift_id
                         where a.worker_id = d.worker_id and a.status in ('pending', 'confirmed')
                           and (s.starts_at at time zone 'Asia/Seoul')::date = d.day))
      order by ish.card_closed(d.worker_id), w.reliability desc, d.created_at)
    from ish.worker_free_dates d
    join ish.profiles p on p.id = d.worker_id
    join ish.worker_profiles w on w.user_id = d.worker_id
    left join ish.coin_wallets cw on cw.worker_id = d.worker_id
    where d.day = p_day
      and (p_district is null or d.district ilike '%' || btrim(p_district) || '%')), '[]'::jsonb);
end
$$;

-- The staff: everyone with a card now (CRM «Kartochkalar»).
create or replace function ish.staff_cards()
returns jsonb
language plpgsql
stable
security definer
set search_path = ish
as $$
begin
  perform ish.require_staff();
  return coalesce((
    select jsonb_agg(ish.card_of(c.subject_id) || jsonb_build_object(
      'subject_id', c.subject_id, 'subject', c.subject,
      'name', case when c.subject = 'worker'
                   then btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, ''))
                   else b.name end,
      'phone', p.phone,
      'updated_at', c.updated_at,
      'last_why', (select e.why from ish.card_events e where e.subject_id = c.subject_id
                   order by e.created_at desc limit 1))
      order by c.level desc, c.updated_at desc)
    from ish.cards c
    left join ish.profiles p on c.subject = 'worker' and p.id = c.subject_id
    left join ish.businesses b on c.subject = 'business' and b.id = c.subject_id
    where c.level > 0), '[]'::jsonb);
end
$$;
revoke execute on function ish.staff_cards() from public, anon;
grant execute on function ish.staff_cards() to authenticated;

-- «Ishonch bali» shows the card too.
create or replace function ish.my_trust()
returns jsonb
language sql
stable
security definer
set search_path = ish
as $$
  select jsonb_build_object(
    'reliability', w.reliability,
    'went', (select count(*)::int from ish.applications a
             where a.worker_id = w.user_id
               and (a.status = 'completed' or (a.coins_paid > 0 and a.worker_step = 2
                                               and a.status not in ('cancelled', 'rejected', 'no_show')))),
    'on_time', (select case when count(*) = 0 then null
                            else round(100.0 * count(*) filter (where coalesce(a.late_minutes, 0) = 0) / count(*))::int end
                from ish.applications a
                where a.worker_id = w.user_id and a.check_in_at is not null),
    'rating', (select round(avg(r.stars)::numeric, 1) from ish.ratings r
               join ish.applications a on a.id = r.application_id
               where a.worker_id = w.user_id and r.direction = 'business_to_worker'),
    'ratings', (select count(*)::int from ish.ratings r
                join ish.applications a on a.id = r.application_id
                where a.worker_id = w.user_id and r.direction = 'business_to_worker'),
    'no_shows', (select count(*)::int from ish.applications a
                 where a.worker_id = w.user_id and a.status = 'no_show'),
    'card', ish.card_of(w.user_id))
  from ish.worker_profiles w
  where w.user_id = auth.uid()
$$;
