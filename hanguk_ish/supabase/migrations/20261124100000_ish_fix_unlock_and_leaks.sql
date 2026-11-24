-- Hanguk Ish: money and privacy fixes (review of Nov 23, 2026).
--
--   1. Free unlock. apply_to_shift let a worker with an offer take an
--      invite-only job for free, and unlock_offer then gave the phone and
--      address without charging. Invite-only jobs are now taken only with
--      unlock_offer, and unlock_offer gives the card free only when this
--      worker already paid for it.
--   2. Place leak. Any signed-in user could read the address, map point
--      and name of staff jobs straight from ish.shifts and ish.businesses,
--      and shift_details showed them before payment. Row rules now hide
--      invite-only jobs and staff-kept businesses, and the job cards show
--      only the area and a rounded point (about 1 km) until the worker paid.
--   3. Staff phone. For a staff-kept business the "owner" is the staff
--      member, so an empty contact phone showed the staff member's own
--      phone. Now only the contact phone is used, and offers need one.
--   4. Paid offers for free jobs. Offers only go out for invite-only jobs.
--   5. Worker home. Employers could read a worker's home address and
--      exact point. worker_profiles is now readable only by its owner
--      and staff (employers get what they need through the RPC cards).
--   6. onboarded_at can no longer be set by the worker directly
--      (save_worker_profile sets it).
--   7. Long-term jobs. Company, address and the exact point were open to
--      everyone (even not signed in). Public reads now go through
--      public_monthly_jobs(), which hides them; staff read through
--      staff_monthly_jobs().

-- ---------------------------------------------------------------------
-- Who may see the exact place of a job.
-- ---------------------------------------------------------------------
create or replace function ish.can_see_place(p_shift uuid)
returns boolean
language sql
stable
security definer
set search_path = ish
as $$
  select exists (
    select 1
    from ish.shifts s join ish.businesses b on b.id = s.business_id
    where s.id = p_shift and (
      (not s.invite_only and not b.managed_by_staff)
      or ish.is_business_member(b.id)
      or (auth.uid() is not null and ish.is_staff())
      or exists (select 1 from ish.applications a
                 where a.shift_id = s.id and a.worker_id = auth.uid() and a.coins_paid > 0)))
$$;
revoke execute on function ish.can_see_place(uuid) from public, anon, authenticated;

-- A worker paid for at least one job of this business.
create or replace function ish.paid_at_business(p_business uuid)
returns boolean
language sql
stable
security definer
set search_path = ish
as $$
  select exists (
    select 1 from ish.applications a join ish.shifts s on s.id = a.shift_id
    where s.business_id = p_business and a.worker_id = auth.uid() and a.coins_paid > 0)
$$;
revoke execute on function ish.paid_at_business(uuid) from public, anon, authenticated;

-- A point rounded to 2 decimals: about 1 km.
create or replace function ish.round_point(p double precision)
returns double precision
language sql
immutable
as $$ select round(p::numeric, 2)::double precision $$;

-- ---------------------------------------------------------------------
-- Prices (business plan, Nov 2026): 20 / 30 / 40 pyols, 300 for a
-- long-term job. Under 5 hours or under ₩80,000 → 20; up to ₩150,000 → 30;
-- more → 40.
-- ---------------------------------------------------------------------
create or replace function ish.unlock_price(p_pay integer)
returns integer
language sql
immutable
as $$
  select case
    when coalesce(p_pay, 0) > 150000 then 40
    when coalesce(p_pay, 0) >= 80000 then 30
    else 20
  end
$$;

create or replace function ish.shift_unlock_price(p_shift uuid)
returns integer
language sql
stable
security definer
set search_path = ish
as $$
  select case when s.ends_at - s.starts_at < interval '5 hours' then 20
              else ish.unlock_price(ish.job_pay(s)) end
  from ish.shifts s where s.id = p_shift
$$;
revoke execute on function ish.shift_unlock_price(uuid) from public, anon, authenticated;

create or replace function ish.monthly_unlock_price()
returns integer
language sql
immutable
as $$ select 300 $$;
grant execute on function ish.monthly_unlock_price() to anon, authenticated;

-- ---------------------------------------------------------------------
-- Business brief: a staff-kept business shows no name, exact address or
-- point to workers who have not paid for one of its jobs.
-- ---------------------------------------------------------------------
create or replace function ish.business_brief(p_business uuid)
returns jsonb
language sql
stable
security definer
set search_path = ish
as $$
  select case when b.managed_by_staff and not (
             ish.is_business_member(b.id)
             or (auth.uid() is not null and ish.is_staff())
             or ish.paid_at_business(b.id))
    then jsonb_build_object(
      'id', b.id, 'name', '', 'name_i18n', null, 'area', b.area,
      'address', ish.mask_address(b.address), 'address_detail', null,
      'translations', null, 'category', b.category, 'verified', b.status = 'verified',
      'lat', ish.round_point(b.lat), 'lng', ish.round_point(b.lng),
      'logo_path', null, 'photo_path', null, 'hidden', true)
    else jsonb_build_object(
      'id', b.id, 'name', b.name, 'name_i18n', b.name_i18n, 'area', b.area,
      'address', b.address, 'address_detail', b.address_detail,
      'translations', b.translations, 'category', b.category, 'verified', b.status = 'verified',
      'lat', b.lat, 'lng', b.lng, 'logo_path', b.logo_path, 'photo_path', b.photo_path)
    end
  from ish.businesses b
  where b.id = p_business
$$;

-- ---------------------------------------------------------------------
-- Shift card: before payment, an invite-only job shows the area only.
-- ---------------------------------------------------------------------
create or replace function ish.shift_card(p_shift uuid, p_lat double precision default null,
                                          p_lng double precision default null)
returns jsonb
language sql
stable
security definer
set search_path = ish
as $$
  with x as (
    select s.*, b.lat as b_lat, b.lng as b_lng, b.address as b_address,
           ish.can_see_place(s.id) as see
    from ish.shifts s join ish.businesses b on b.id = s.business_id
    where s.id = p_shift
  )
  select jsonb_build_object(
    'id', x.id,
    'business', case when x.see then ish.business_card(x.business_id)
                     else ish.business_card(x.business_id) || jsonb_build_object(
                       'address', ish.mask_address(x.b_address), 'address_detail', null,
                       'lat', ish.round_point(x.b_lat), 'lng', ish.round_point(x.b_lng)) end,
    'title', x.title,
    'duties', x.duties,
    'dress', x.dress,
    'address', case when x.see then x.address
                    else ish.mask_address(coalesce(nullif(x.address, ''), x.b_address)) end,
    'translations', x.translations,
    'starts_at', x.starts_at,
    'ends_at', x.ends_at,
    'hourly_wage', x.hourly_wage,
    'slots', x.slots,
    'slots_left', greatest(x.slots - ish.confirmed_count(x.id), 0),
    'auto_confirm', x.auto_confirm,
    'status', x.status,
    'invite_only', x.invite_only,
    'place_hidden', not x.see,
    'unlock_price', case when x.invite_only then ish.shift_unlock_price(x.id) end,
    'lat', case when x.see then coalesce(x.lat, x.b_lat) else ish.round_point(coalesce(x.lat, x.b_lat)) end,
    'lng', case when x.see then coalesce(x.lng, x.b_lng) else ish.round_point(coalesce(x.lng, x.b_lng)) end,
    'distance_km', round(ish.distance_km(p_lat, p_lng, coalesce(x.lat, x.b_lat),
                                            coalesce(x.lng, x.b_lng))::numeric,
                         case when x.see then 3 else 0 end),
    'my_application_id', my.id,
    'my_status', my.status,
    'offer', (select jsonb_build_object('id', o.id, 'status', o.status, 'note', o.note,
                                        'expires_at', o.expires_at)
              from ish.job_offers o where o.shift_id = x.id and o.worker_id = auth.uid())
  )
  from x
  left join lateral (
    select a.id, a.status from ish.applications a
    where a.shift_id = x.id and a.worker_id = auth.uid()
    order by a.created_at desc, a.id desc
    limit 1
  ) my on true
$$;

-- ---------------------------------------------------------------------
-- apply_to_shift: invite-only jobs are taken with unlock_offer only.
-- ---------------------------------------------------------------------
create or replace function ish.apply_to_shift(p_shift uuid)
returns ish.applications
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_uid uuid := ish.require_uid();
  v_shift ish.shifts;
  v_app ish.applications;
begin
  perform pg_advisory_xact_lock(hashtextextended('ish.apply:' || v_uid::text, 0));

  if not exists (
    select 1 from ish.worker_profiles where user_id = v_uid and onboarded_at is not null
  ) then
    raise exception 'PROFILE_INCOMPLETE';
  end if;

  select * into v_shift from ish.shifts where id = p_shift for update;
  if found and v_shift.invite_only then
    raise exception 'USE_UNLOCK';
  end if;
  if not found or v_shift.status <> 'open' or not exists (
    select 1 from ish.businesses b where b.id = v_shift.business_id and b.status = 'verified'
  ) then
    raise exception 'SHIFT_CLOSED';
  end if;
  if v_shift.starts_at <= now() then
    raise exception 'SHIFT_STARTED';
  end if;
  if exists (
    select 1 from ish.business_members m
    where m.business_id = v_shift.business_id and m.user_id = v_uid
  ) then
    raise exception 'OWN_SHIFT';
  end if;
  if exists (
    select 1 from ish.applications
    where shift_id = p_shift and worker_id = v_uid and status not in ('cancelled', 'rejected')
  ) then
    raise exception 'ALREADY_APPLIED';
  end if;
  if exists (
    select 1
    from ish.applications a
    join ish.shifts s on s.id = a.shift_id
    where a.worker_id = v_uid
      and a.status in ('pending', 'confirmed', 'checked_in')
      and tstzrange(s.starts_at, s.ends_at) && tstzrange(v_shift.starts_at, v_shift.ends_at)
  ) then
    raise exception 'TIME_CONFLICT';
  end if;
  if ish.confirmed_count(p_shift) >= v_shift.slots then
    raise exception 'SHIFT_FULL';
  end if;

  insert into ish.applications (shift_id, worker_id, status, decided_at)
  values (
    p_shift, v_uid,
    case when v_shift.auto_confirm then 'confirmed' else 'pending' end::ish.application_status,
    case when v_shift.auto_confirm then now() end
  )
  returning * into v_app;

  perform ish.notify_business(p_shift, 'new_applicant',
    jsonb_build_object('application_id', v_app.id, 'worker_id', v_uid,
                       'auto_confirmed', v_shift.auto_confirm));
  if v_shift.auto_confirm then
    perform ish.release_waiting_if_full(p_shift);
  end if;
  return v_app;
end
$$;

-- ---------------------------------------------------------------------
-- unlock_offer: the card is free again only for a worker who paid for
-- this job. Tells the employer, and closes the other offers when full.
-- ---------------------------------------------------------------------
create or replace function ish.unlock_offer(p_shift uuid)
returns jsonb
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_uid uuid := ish.require_uid();
  v_offer ish.job_offers;
  v_shift ish.shifts;
  v_app ish.applications;
  v_price int;
begin
  perform pg_advisory_xact_lock(hashtextextended('ish.apply:' || v_uid::text, 0));
  select * into v_shift from ish.shifts where id = p_shift for update;
  select * into v_offer from ish.job_offers where shift_id = p_shift and worker_id = v_uid for update;
  if v_offer.id is null or v_shift.id is null then
    raise exception 'NOT_FOUND';
  end if;
  -- Paid before: open the card again, free.
  select * into v_app from ish.applications
  where shift_id = p_shift and worker_id = v_uid and coins_paid > 0
    and status not in ('cancelled', 'rejected')
  order by created_at desc limit 1;
  if v_app.id is not null then
    return ish.my_job_card(v_app.id);
  end if;
  if v_offer.status not in ('sent', 'applied', 'declined') or v_offer.expires_at <= now() then
    raise exception 'OFFER_EXPIRED';
  end if;
  if v_shift.status <> 'open' or v_shift.starts_at <= now() then
    raise exception 'SHIFT_CLOSED';
  end if;
  if ish.confirmed_count(p_shift) >= v_shift.slots then
    -- The offers were already closed when the job filled (release_waiting_if_full).
    raise exception 'SHIFT_FULL';
  end if;
  if exists (
    select 1 from ish.applications a join ish.shifts s on s.id = a.shift_id
    where a.worker_id = v_uid and a.status in ('pending', 'confirmed', 'checked_in')
      and tstzrange(s.starts_at, s.ends_at) && tstzrange(v_shift.starts_at, v_shift.ends_at)
  ) then
    raise exception 'TIME_CONFLICT';
  end if;

  v_price := ish.shift_unlock_price(p_shift);
  -- An old free application (before this fix) is replaced by the paid one.
  update ish.applications set status = 'cancelled', cancelled_at = now()
  where shift_id = p_shift and worker_id = v_uid and coins_paid = 0
    and status not in ('cancelled', 'rejected');
  insert into ish.applications (shift_id, worker_id, status, decided_at, coins_paid)
  values (p_shift, v_uid, 'confirmed', now(), v_price)
  returning * into v_app;
  perform ish.coin_move(v_uid, -v_price, 'unlock', v_app.id, null, '');
  update ish.job_offers set status = 'applied', responded_at = now() where id = v_offer.id;
  perform ish.notify_business(p_shift, 'new_applicant',
    jsonb_build_object('application_id', v_app.id, 'worker_id', v_uid, 'auto_confirmed', true,
                       'unlocked', true));
  perform ish.release_waiting_if_full(p_shift);
  return ish.my_job_card(v_app.id);
end
$$;

-- ---------------------------------------------------------------------
-- my_job_card: a staff-kept business gives only its contact phone.
-- ---------------------------------------------------------------------
create or replace function ish.my_job_card(p_application uuid)
returns jsonb
language sql
stable
security definer
set search_path = ish
as $$
  select jsonb_build_object(
    'application_id', a.id, 'shift_id', s.id, 'title', s.title, 'translations', s.translations,
    'pay', ish.job_pay(s), 'hourly_wage', s.hourly_wage, 'starts_at', s.starts_at, 'ends_at', s.ends_at,
    'phone', case when b.managed_by_staff then coalesce(c.phone, '')
                  else coalesce(nullif(c.phone, ''), p.phone, '') end,
    'address', btrim(concat_ws(', ', nullif(coalesce(nullif(s.address, ''), b.address), ''), nullif(b.address_detail, ''))),
    'lat', coalesce(s.lat, b.lat), 'lng', coalesce(s.lng, b.lng),
    'business', b.name, 'step', a.worker_step, 'price', a.coins_paid, 'opened_at', a.created_at,
    'status', a.status,
    'refunded', exists (select 1 from ish.coin_ledger l where l.application_id = a.id and l.reason = 'refund'),
    'stars', (select r.stars from ish.ratings r where r.application_id = a.id and r.direction = 'worker_to_business'),
    'distance_km', case when w.lat is not null and coalesce(s.lat, b.lat) is not null
                        then round(ish.distance_km(w.lat, w.lng, coalesce(s.lat, b.lat), coalesce(s.lng, b.lng))::numeric, 1) end)
  from ish.applications a
  join ish.shifts s on s.id = a.shift_id
  join ish.businesses b on b.id = s.business_id
  left join ish.business_contacts c on c.business_id = b.id
  left join ish.profiles p on p.id = b.owner_id
  left join ish.worker_profiles w on w.user_id = a.worker_id
  where a.id = p_application
$$;

-- ---------------------------------------------------------------------
-- Offers: only for invite-only jobs, and a staff-kept business needs a
-- contact phone (what the worker pays for).
-- ---------------------------------------------------------------------
create or replace function ish.staff_send_offers(p_shift uuid, p_workers uuid[], p_note text default '')
returns integer
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_uid uuid := ish.require_staff();
  v_shift ish.shifts;
  v_live int;
  v_count int;
begin
  select * into v_shift from ish.shifts where id = p_shift for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if v_shift.status <> 'open' or v_shift.starts_at <= now() then
    raise exception 'SHIFT_CLOSED';
  end if;
  if not v_shift.invite_only then
    raise exception 'NOT_INVITE_ONLY';
  end if;
  if exists (select 1 from ish.businesses b
             left join ish.business_contacts c on c.business_id = b.id
             where b.id = v_shift.business_id and b.managed_by_staff
               and coalesce(btrim(c.phone), '') = '') then
    raise exception 'NO_CONTACT_PHONE';
  end if;
  if ish.confirmed_count(p_shift) >= v_shift.slots then
    raise exception 'SHIFT_FULL';
  end if;
  if char_length(coalesce(btrim(p_note), '')) > 300 then
    raise exception 'INVALID';
  end if;
  select count(*) into v_live from ish.job_offers
  where shift_id = p_shift and status = 'sent' and expires_at > now();
  if v_live + coalesce(cardinality(p_workers), 0) > 4 then
    raise exception 'TOO_MANY';
  end if;
  with sent as (
    insert into ish.job_offers (shift_id, worker_id, sent_by, note, expires_at)
    select p_shift, w.user_id, v_uid, coalesce(btrim(p_note), ''), now() + interval '30 minutes'
    from ish.worker_profiles w
    where w.user_id = any (p_workers) and w.onboarded_at is not null
      and not exists (select 1 from ish.business_members m
                      where m.business_id = v_shift.business_id and m.user_id = w.user_id)
      and not exists (select 1 from ish.applications a
                      where a.shift_id = p_shift and a.worker_id = w.user_id
                        and a.status not in ('cancelled', 'rejected'))
    on conflict (shift_id, worker_id) do nothing
    returning id, worker_id
  )
  insert into ish.notifications (user_id, kind, data)
  select worker_id, 'job_offer', jsonb_strip_nulls(jsonb_build_object(
           'offer_id', id, 'shift_id', p_shift, 'business_id', v_shift.business_id,
           'note', nullif(coalesce(btrim(p_note), ''), '')))
  from sent;
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

-- ---------------------------------------------------------------------
-- Row rules.
-- ---------------------------------------------------------------------
drop policy shifts_read on ish.shifts;
create policy shifts_read on ish.shifts
  for select to authenticated
  using (
    (status = 'open' and not invite_only and exists (
      select 1 from ish.businesses b
      where b.id = shifts.business_id and b.status = 'verified' and not b.managed_by_staff))
    or ish.is_business_member(business_id)
    or exists (select 1 from ish.applications a
               where a.shift_id = shifts.id and a.worker_id = auth.uid()
                 and (a.coins_paid > 0 or not shifts.invite_only))
    or ish.is_staff()
  );

drop policy businesses_read on ish.businesses;
create policy businesses_read on ish.businesses
  for select to authenticated
  using ((status = 'verified' and not managed_by_staff) or ish.is_business_member(id) or ish.is_staff());

drop policy worker_profiles_read on ish.worker_profiles;
create policy worker_profiles_read on ish.worker_profiles
  for select to authenticated
  using (user_id = auth.uid() or ish.is_staff());

revoke update (onboarded_at) on ish.worker_profiles from authenticated;

-- ---------------------------------------------------------------------
-- Long-term jobs: no direct reads of the hidden columns.
-- ---------------------------------------------------------------------
alter table ish.monthly_jobs add column if not exists contact_phone text not null default ''
  check (char_length(contact_phone) <= 40);
comment on column ish.monthly_jobs.contact_phone is
  'Who the worker calls after paying to unlock (staff only until then).';

revoke select on ish.monthly_jobs from anon, authenticated;
grant select (id, status) on ish.monthly_jobs to authenticated;
drop policy if exists monthly_jobs_public_read on ish.monthly_jobs;

create table if not exists ish.monthly_unlocks (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references ish.monthly_jobs (id) on delete cascade,
  worker_id uuid not null references ish.profiles (id) on delete cascade,
  coins_paid integer not null check (coins_paid >= 0),
  created_at timestamptz not null default now(),
  unique (job_id, worker_id)
);
alter table ish.monthly_unlocks enable row level security;
create policy monthly_unlocks_read on ish.monthly_unlocks
  for select to authenticated using (worker_id = auth.uid() or ish.is_staff());
revoke all on ish.monthly_unlocks from public, anon, authenticated;
grant select on ish.monthly_unlocks to authenticated;

-- Translations without the company and address keys.
create or replace function ish.strip_place_keys(p jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce((
    select jsonb_object_agg(k, case when jsonb_typeof(v) = 'object' then v - 'company' - 'address' else v end)
    from jsonb_each(p) as e(k, v)), '{}'::jsonb)
$$;

-- One long-term job as the worker may see it.
create or replace function ish.monthly_job_card(p_job uuid)
returns jsonb
language sql
stable
security definer
set search_path = ish
as $$
  select case when u.id is not null or (auth.uid() is not null and ish.is_staff()) then
    jsonb_build_object(
      'id', j.id, 'title', j.title, 'company', j.company, 'area', j.area, 'address', j.address,
      'lat', j.lat, 'lng', j.lng, 'monthly_wage', j.monthly_wage, 'days_per_week', j.days_per_week,
      'hours_per_day', j.hours_per_day, 'description', j.description, 'translations', j.translations,
      'status', j.status, 'created_at', j.created_at, 'category', j.category, 'work_time', j.work_time,
      'contact_phone', j.contact_phone, 'unlocked', true, 'unlock_price', ish.monthly_unlock_price())
  else
    jsonb_build_object(
      'id', j.id, 'title', j.title, 'company', '', 'area', j.area, 'address', '',
      'lat', ish.round_point(j.lat), 'lng', ish.round_point(j.lng), 'monthly_wage', j.monthly_wage,
      'days_per_week', j.days_per_week, 'hours_per_day', j.hours_per_day,
      'description', j.description, 'translations', ish.strip_place_keys(j.translations),
      'status', j.status, 'created_at', j.created_at, 'category', j.category, 'work_time', j.work_time,
      'contact_phone', '', 'unlocked', false, 'unlock_price', ish.monthly_unlock_price())
  end
  from ish.monthly_jobs j
  left join ish.monthly_unlocks u on u.job_id = j.id and u.worker_id = auth.uid()
  where j.id = p_job
$$;
revoke execute on function ish.monthly_job_card(uuid) from public, anon, authenticated;

-- The open long-term jobs, for the app and the public web page.
create or replace function ish.public_monthly_jobs()
returns jsonb
language sql
stable
security definer
set search_path = ish
as $$
  select coalesce(jsonb_agg(ish.monthly_job_card(j.id) order by j.created_at desc), '[]'::jsonb)
  from (select id, created_at from ish.monthly_jobs where status = 'open'
        order by created_at desc limit 200) j
$$;
revoke execute on function ish.public_monthly_jobs() from public;
grant execute on function ish.public_monthly_jobs() to anon, authenticated;

-- All long-term jobs, for the CRM.
create or replace function ish.staff_monthly_jobs()
returns setof ish.monthly_jobs
language plpgsql
stable
security definer
set search_path = ish
as $$
begin
  perform ish.require_staff();
  return query select * from ish.monthly_jobs order by created_at desc limit 500;
end
$$;
revoke execute on function ish.staff_monthly_jobs() from public, anon;
grant execute on function ish.staff_monthly_jobs() to authenticated;

-- Pay 300 pyols to see the company, address and contact of a long-term job.
create or replace function ish.unlock_monthly_job(p_job uuid)
returns jsonb
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_uid uuid := ish.require_uid();
  v_job ish.monthly_jobs;
  v_price int := ish.monthly_unlock_price();
begin
  perform pg_advisory_xact_lock(hashtextextended('ish.apply:' || v_uid::text, 0));
  if not exists (select 1 from ish.worker_profiles where user_id = v_uid and onboarded_at is not null) then
    raise exception 'PROFILE_INCOMPLETE';
  end if;
  select * into v_job from ish.monthly_jobs where id = p_job;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if exists (select 1 from ish.monthly_unlocks where job_id = p_job and worker_id = v_uid) then
    return ish.monthly_job_card(p_job);
  end if;
  if v_job.status <> 'open' then
    raise exception 'JOB_CLOSED';
  end if;
  insert into ish.monthly_unlocks (job_id, worker_id, coins_paid) values (p_job, v_uid, v_price);
  perform ish.coin_move(v_uid, -v_price, 'unlock', null, null, 'monthly:' || p_job::text);
  insert into ish.monthly_applications (job_id, worker_id) values (p_job, v_uid)
  on conflict do nothing;
  return ish.monthly_job_card(p_job);
end
$$;
revoke execute on function ish.unlock_monthly_job(uuid) from public, anon;
grant execute on function ish.unlock_monthly_job(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- The offer list and the CRM job page use the new price (hours too).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ish.my_offers()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'ish'
AS $function$
declare
  v_uid uuid := ish.require_uid();
begin
  return coalesce((
    select jsonb_agg(card order by live desc, ends_in, created_at desc)
    from (
      select
        (o.status = 'sent' and o.expires_at > now()) as live,
        o.expires_at as ends_in,
        o.created_at,
        jsonb_build_object(
          'offer_id', o.id, 'shift_id', s.id,
          'status', case when o.status = 'sent' and o.expires_at <= now() then 'expired' else o.status end,
          'expires_at', o.expires_at, 'title', s.title, 'translations', s.translations,
          'pay', ish.job_pay(s), 'hourly_wage', s.hourly_wage,
          'starts_at', s.starts_at, 'ends_at', s.ends_at,
          'price', ish.shift_unlock_price(s.id),
          'sent_count', (select count(*) from ish.job_offers x
                         where x.shift_id = s.id and abs(extract(epoch from (x.created_at - o.created_at))) < 120),
          'slots', s.slots, 'taken', ish.confirmed_count(s.id),
          'checked_at', s.checked_at, 'note', o.note,
          'area', b.area, 'address', ish.mask_address(coalesce(nullif(s.address, ''), b.address)),
          'phone', '010-••••-••••',
          'distance_km', case when w.lat is not null and coalesce(s.lat, b.lat) is not null
                              then round(ish.distance_km(w.lat, w.lng, coalesce(s.lat, b.lat), coalesce(s.lng, b.lng))::numeric, 1) end
        ) as card
      from ish.job_offers o
      join ish.shifts s on s.id = o.shift_id
      join ish.businesses b on b.id = s.business_id
      left join ish.worker_profiles w on w.user_id = o.worker_id
      where o.worker_id = v_uid and o.status in ('sent', 'expired', 'closed')
        and (o.status = 'sent' or o.created_at > now() - interval '2 days')
    ) t
  ), '[]'::jsonb);
end
$function$;

CREATE OR REPLACE FUNCTION ish.staff_shift(p_shift uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'ish'
AS $function$
begin
  perform ish.require_staff();
  if not exists (select 1 from ish.shifts where id = p_shift) then
    raise exception 'NOT_FOUND';
  end if;
  return (
    select ish.shift_card(s.id) || jsonb_build_object(
      'invite_only', s.invite_only,
      'managed', b.managed_by_staff,
      'business_id', b.id,
      'total_pay', s.total_pay,
      'job_pay', ish.job_pay(s),
      'unlock_price', ish.shift_unlock_price(s.id),
      'checked_at', s.checked_at,
      'contact', (select jsonb_build_object('contact_name', c.contact_name, 'phone', c.phone,
                                            'telegram', c.telegram, 'source', c.source, 'notes', c.notes)
                  from ish.business_contacts c where c.business_id = b.id),
      'notes', (select jsonb_build_object('source', n.source, 'notes', n.notes)
                from ish.shift_notes n where n.shift_id = s.id),
      'offers', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', o.id,
                 'status', case when o.status = 'sent' and o.expires_at <= now() then 'expired' else o.status end,
                 'note', o.note, 'created_at', o.created_at, 'expires_at', o.expires_at,
                 'responded_at', o.responded_at,
                 'worker', ish.staff_worker_card(o.worker_id))
               order by o.created_at, o.id)
        from ish.job_offers o where o.shift_id = s.id), '[]'::jsonb),
      'applications', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', a.id, 'status', a.status, 'created_at', a.created_at, 'decided_at', a.decided_at,
                 'check_in_at', a.check_in_at, 'check_out_at', a.check_out_at,
                 'worked_minutes', a.worked_minutes, 'pay_amount', a.pay_amount, 'paid_at', a.paid_at,
                 'coins_paid', a.coins_paid, 'worker_step', a.worker_step,
                 'worker', ish.staff_worker_card(a.worker_id))
               order by a.created_at, a.id)
        from ish.applications a where a.shift_id = s.id), '[]'::jsonb))
    from ish.shifts s join ish.businesses b on b.id = s.business_id
    where s.id = p_shift
  );
end
$function$;
