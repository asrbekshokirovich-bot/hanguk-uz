-- Hanguk Ish — functions the apps call (P1, 2026-11-10).
--
-- Every state change of a shift or an application happens here, under a row
-- lock on the shift, so the rules hold even when two people tap at the same
-- moment:
--   * confirmed workers never exceed the shift's slots;
--   * a worker never holds two shifts that overlap in time;
--   * QR check-in opens 30 min before the start and closes at the end;
--     check-out closes 2 h after the end (T6);
--   * pay = worked minutes inside the planned window × hourly wage, never
--     more than planned (T7);
--   * reliability: completed +1 (max 100), cancel with < 24 h to go −5,
--     no-show −20 (T5).
-- Errors are raised with a stable code in the message (e.g. 'SHIFT_FULL')
-- that the apps translate.

-- ---------------------------------------------------------------------------
-- Small helpers
-- ---------------------------------------------------------------------------

create function ish.require_uid()
returns uuid
language plpgsql
stable
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;
  return v_uid;
end
$$;

-- The QR token of a shift: HMAC of its id with its secret (first 24 hex).
create function ish.qr_token_for(p_shift uuid)
returns text
language sql
stable
security definer
set search_path = ish
as $$
  select left(encode(extensions.hmac(p_shift::text, qr_secret, 'sha256'), 'hex'), 24)
  from ish.shift_secrets
  where shift_id = p_shift
$$;

revoke execute on function ish.qr_token_for(uuid) from public, anon, authenticated;

create function ish.notify(p_user uuid, p_kind text, p_data jsonb)
returns void
language sql
security definer
set search_path = ish
as $$
  insert into ish.notifications (user_id, kind, data) values (p_user, p_kind, p_data)
$$;

revoke execute on function ish.notify(uuid, text, jsonb) from public, anon, authenticated;

-- Notifies every member of the business that runs [p_shift].
create function ish.notify_business(p_shift uuid, p_kind text, p_data jsonb)
returns void
language sql
security definer
set search_path = ish
as $$
  insert into ish.notifications (user_id, kind, data)
  select m.user_id, p_kind, p_data || jsonb_build_object('shift_id', p_shift)
  from ish.shifts s
  join ish.business_members m on m.business_id = s.business_id
  where s.id = p_shift
$$;

revoke execute on function ish.notify_business(uuid, text, jsonb) from public, anon, authenticated;

-- Confirmed (or further along) workers of a shift.
create function ish.confirmed_count(p_shift uuid)
returns int
language sql
stable
security definer
set search_path = ish
as $$
  select count(*)::int from ish.applications
  where shift_id = p_shift and status in ('confirmed', 'checked_in', 'completed')
$$;

revoke execute on function ish.confirmed_count(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Worker: take, cancel
-- ---------------------------------------------------------------------------

-- A05 «Smenani olish» → «Tasdiqlash». Confirmed at once when the shift
-- auto-confirms, otherwise waits for the business.
create function ish.apply_to_shift(p_shift uuid)
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
  if not exists (
    select 1 from ish.worker_profiles where user_id = v_uid and onboarded_at is not null
  ) then
    raise exception 'PROFILE_INCOMPLETE';
  end if;

  select * into v_shift from ish.shifts where id = p_shift for update;
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
  return v_app;
end
$$;

-- A06 «Bekor qilish». Free until 24 h before the start; later costs 5
-- reliability points (T5). Not possible once the shift has started.
create function ish.cancel_application(p_application uuid)
returns ish.applications
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_uid uuid := ish.require_uid();
  v_app ish.applications;
  v_shift ish.shifts;
  v_late boolean;
begin
  select * into v_app from ish.applications
  where id = p_application and worker_id = v_uid
  for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  select * into v_shift from ish.shifts where id = v_app.shift_id for update;
  if v_app.status not in ('pending', 'confirmed') then
    raise exception 'CANNOT_CANCEL';
  end if;
  if v_shift.starts_at <= now() then
    raise exception 'SHIFT_STARTED';
  end if;

  v_late := v_app.status = 'confirmed' and v_shift.starts_at - now() < interval '24 hours';
  update ish.applications
  set status = 'cancelled', cancelled_at = now(), late_cancel = v_late
  where id = p_application
  returning * into v_app;

  if v_late then
    update ish.worker_profiles
    set reliability = greatest(0, reliability - 5)
    where user_id = v_uid;
  end if;
  perform ish.notify_business(v_shift.id, 'worker_cancelled',
    jsonb_build_object('application_id', v_app.id, 'worker_id', v_uid, 'late', v_late));
  return v_app;
end
$$;

-- ---------------------------------------------------------------------------
-- Business: decide, QR, payment, favourites
-- ---------------------------------------------------------------------------

-- BA3 거절 / 확정. When the last slot fills, the other waiting applicants are
-- turned down so nobody waits for a shift that is already full.
create function ish.decide_application(p_application uuid, p_accept boolean)
returns ish.applications
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_uid uuid := ish.require_uid();
  v_app ish.applications;
  v_shift ish.shifts;
begin
  select a.* into v_app from ish.applications a where a.id = p_application;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  select * into v_shift from ish.shifts where id = v_app.shift_id for update;
  if not ish.is_business_member(v_shift.business_id) then
    raise exception 'NOT_FOUND';
  end if;
  select * into v_app from ish.applications where id = p_application for update;
  if v_app.status <> 'pending' then
    raise exception 'NOT_PENDING';
  end if;
  if v_shift.ends_at <= now() then
    raise exception 'SHIFT_ENDED';
  end if;

  if p_accept then
    if ish.confirmed_count(v_shift.id) >= v_shift.slots then
      raise exception 'SHIFT_FULL';
    end if;
    update ish.applications set status = 'confirmed', decided_at = now()
    where id = p_application returning * into v_app;
    perform ish.notify(v_app.worker_id, 'application_confirmed',
      jsonb_build_object('application_id', v_app.id, 'shift_id', v_shift.id));

    if ish.confirmed_count(v_shift.id) >= v_shift.slots then
      with closed as (
        update ish.applications set status = 'rejected', decided_at = now()
        where shift_id = v_shift.id and status = 'pending'
        returning id, worker_id
      )
      insert into ish.notifications (user_id, kind, data)
      select worker_id, 'application_rejected',
             jsonb_build_object('application_id', id, 'shift_id', v_shift.id, 'reason', 'full')
      from closed;
    end if;
  else
    update ish.applications set status = 'rejected', decided_at = now()
    where id = p_application returning * into v_app;
    perform ish.notify(v_app.worker_id, 'application_rejected',
      jsonb_build_object('application_id', v_app.id, 'shift_id', v_shift.id));
  end if;
  return v_app;
end
$$;

-- BA3 출퇴근 QR: the payload printed in the code. Members only.
create function ish.shift_qr(p_shift uuid)
returns text
language plpgsql
stable
security definer
set search_path = ish
as $$
begin
  perform ish.require_uid();
  if not ish.is_shift_member(p_shift) then
    raise exception 'NOT_FOUND';
  end if;
  return 'hanguk-ish:v1:' || p_shift::text || ':' || ish.qr_token_for(p_shift);
end
$$;

-- Cancels a whole shift (employer); everyone still holding it is told.
create function ish.cancel_shift(p_shift uuid)
returns ish.shifts
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_shift ish.shifts;
begin
  perform ish.require_uid();
  select * into v_shift from ish.shifts where id = p_shift for update;
  if not found or not ish.is_business_member(v_shift.business_id) then
    raise exception 'NOT_FOUND';
  end if;
  if v_shift.starts_at <= now() then
    raise exception 'SHIFT_STARTED';
  end if;
  update ish.shifts set status = 'cancelled' where id = p_shift returning * into v_shift;
  with dropped as (
    update ish.applications set status = 'rejected', decided_at = now()
    where shift_id = p_shift and status in ('pending', 'confirmed')
    returning id, worker_id
  )
  insert into ish.notifications (user_id, kind, data)
  select worker_id, 'application_rejected',
         jsonb_build_object('application_id', id, 'shift_id', p_shift, 'reason', 'shift_cancelled')
  from dropped;
  return v_shift;
end
$$;

-- BA5 지급 대기 ⇄ 지급 완료 for every completed worker of a shift (T4).
create function ish.set_shift_paid(p_shift uuid, p_paid boolean)
returns int
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_count int;
begin
  perform ish.require_uid();
  if not ish.is_shift_member(p_shift) then
    raise exception 'NOT_FOUND';
  end if;
  with changed as (
    update ish.applications
    set paid_at = case when p_paid then coalesce(paid_at, now()) end
    where shift_id = p_shift and status = 'completed'
    returning worker_id, id
  ), told as (
    insert into ish.notifications (user_id, kind, data)
    select worker_id, 'payment_marked',
           jsonb_build_object('application_id', id, 'shift_id', p_shift, 'paid', p_paid)
    from changed
    returning 1
  )
  select count(*)::int into v_count from changed;
  return v_count;
end
$$;

-- BA4 즐겨찾기 star. Returns the new state.
create function ish.toggle_favorite(p_business uuid, p_worker uuid)
returns boolean
language plpgsql
security definer
set search_path = ish
as $$
begin
  perform ish.require_uid();
  if not ish.is_business_member(p_business) then
    raise exception 'NOT_FOUND';
  end if;
  if exists (select 1 from ish.favorites where business_id = p_business and worker_id = p_worker) then
    delete from ish.favorites where business_id = p_business and worker_id = p_worker;
    return false;
  end if;
  if not exists (
    select 1 from ish.applications a join ish.shifts s on s.id = a.shift_id
    where s.business_id = p_business and a.worker_id = p_worker
  ) then
    raise exception 'NOT_FOUND';
  end if;
  insert into ish.favorites (business_id, worker_id) values (p_business, p_worker);
  return true;
end
$$;

-- BA4 다시 요청: invites a worker who has worked here to a shift.
create function ish.request_again(p_shift uuid, p_worker uuid)
returns void
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_shift ish.shifts;
begin
  perform ish.require_uid();
  select * into v_shift from ish.shifts where id = p_shift;
  if not found or not ish.is_business_member(v_shift.business_id) then
    raise exception 'NOT_FOUND';
  end if;
  if v_shift.status <> 'open' or v_shift.starts_at <= now() then
    raise exception 'SHIFT_CLOSED';
  end if;
  if not exists (
    select 1 from ish.applications a join ish.shifts s on s.id = a.shift_id
    where s.business_id = v_shift.business_id and a.worker_id = p_worker and a.status = 'completed'
  ) then
    raise exception 'NOT_FOUND';
  end if;
  perform ish.notify(p_worker, 'request_again',
    jsonb_build_object('shift_id', p_shift, 'business_id', v_shift.business_id));
end
$$;

-- ---------------------------------------------------------------------------
-- Worker: QR check-in / check-out (A07)
-- ---------------------------------------------------------------------------

-- Splits 'hanguk-ish:v1:<shift>:<token>' and checks the token.
create function ish.read_qr(p_payload text)
returns uuid
language plpgsql
stable
security definer
set search_path = ish
as $$
declare
  v_parts text[] := string_to_array(coalesce(p_payload, ''), ':');
  v_shift uuid;
begin
  if array_length(v_parts, 1) <> 4 or v_parts[1] <> 'hanguk-ish' or v_parts[2] <> 'v1'
     or v_parts[3] !~ '^[0-9a-f-]{36}$' then
    raise exception 'QR_INVALID';
  end if;
  v_shift := v_parts[3]::uuid;
  if ish.qr_token_for(v_shift) is distinct from v_parts[4] then
    raise exception 'QR_INVALID';
  end if;
  return v_shift;
end
$$;

revoke execute on function ish.read_qr(text) from public, anon, authenticated;

create function ish.check_in(p_payload text)
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
  select * into v_shift from ish.shifts where id = ish.read_qr(p_payload) for update;
  select * into v_app from ish.applications
  where shift_id = v_shift.id and worker_id = v_uid and status in ('confirmed', 'checked_in', 'completed')
  for update;
  if not found then
    raise exception 'NOT_CONFIRMED';
  end if;
  if v_app.status <> 'confirmed' then
    raise exception 'ALREADY_CHECKED_IN';
  end if;
  if now() < v_shift.starts_at - interval '30 minutes' then
    raise exception 'TOO_EARLY';
  end if;
  if now() >= v_shift.ends_at then
    raise exception 'TOO_LATE';
  end if;

  update ish.applications
  set status = 'checked_in',
      check_in_at = now(),
      late_minutes = greatest(0, floor(extract(epoch from now() - v_shift.starts_at) / 60))::int
  where id = v_app.id
  returning * into v_app;
  return v_app;
end
$$;

create function ish.check_out(p_payload text)
returns ish.applications
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_uid uuid := ish.require_uid();
  v_shift ish.shifts;
  v_app ish.applications;
  v_worked int;
  v_planned int;
begin
  select * into v_shift from ish.shifts where id = ish.read_qr(p_payload) for update;
  select * into v_app from ish.applications
  where shift_id = v_shift.id and worker_id = v_uid and status in ('confirmed', 'checked_in', 'completed')
  for update;
  if not found then
    raise exception 'NOT_CONFIRMED';
  end if;
  if v_app.status = 'confirmed' then
    raise exception 'NOT_CHECKED_IN';
  end if;
  if v_app.status = 'completed' then
    raise exception 'ALREADY_CHECKED_OUT';
  end if;
  if now() > v_shift.ends_at + interval '2 hours' then
    raise exception 'TOO_LATE';
  end if;

  v_planned := (extract(epoch from v_shift.ends_at - v_shift.starts_at) / 60)::int;
  v_worked := floor(extract(epoch from
    least(now(), v_shift.ends_at) - greatest(v_app.check_in_at, v_shift.starts_at)) / 60)::int;
  v_worked := least(greatest(v_worked, 0), v_planned);

  update ish.applications
  set status = 'completed',
      check_out_at = now(),
      worked_minutes = v_worked,
      pay_amount = (v_shift.hourly_wage::bigint * v_worked / 60)::int
  where id = v_app.id
  returning * into v_app;

  update ish.worker_profiles
  set reliability = least(100, reliability + 1)
  where user_id = v_uid;
  return v_app;
end
$$;

-- ---------------------------------------------------------------------------
-- Rating (A08)
-- ---------------------------------------------------------------------------

create function ish.rate_business(p_application uuid, p_stars int, p_tags text[])
returns ish.ratings
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_uid uuid := ish.require_uid();
  v_rating ish.ratings;
begin
  if not exists (
    select 1 from ish.applications
    where id = p_application and worker_id = v_uid and status = 'completed'
  ) then
    raise exception 'NOT_FOUND';
  end if;
  insert into ish.ratings (application_id, direction, rater_id, stars, tags)
  values (p_application, 'worker_to_business', v_uid, p_stars, coalesce(p_tags, '{}'))
  on conflict (application_id, direction) do update
    set stars = excluded.stars, tags = excluded.tags, created_at = now()
  returning * into v_rating;
  return v_rating;
end
$$;

-- ---------------------------------------------------------------------------
-- Upkeep (pg_cron every 10 minutes in production; callable by service role)
-- ---------------------------------------------------------------------------

-- Confirmed workers who never checked in by the end → no_show (−20, T5);
-- applications still waiting when the shift starts → rejected.
create function ish.close_finished_shifts()
returns int
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_count int;
begin
  with gone as (
    update ish.applications a
    set status = 'no_show'
    from ish.shifts s
    where s.id = a.shift_id and a.status = 'confirmed' and s.ends_at <= now()
    returning a.id, a.worker_id, a.shift_id
  ), penalised as (
    update ish.worker_profiles w
    set reliability = greatest(0, w.reliability - 20 * g.n)
    from (select worker_id, count(*) as n from gone group by worker_id) g
    where w.user_id = g.worker_id
    returning 1
  ), told as (
    insert into ish.notifications (user_id, kind, data)
    select m.user_id, 'no_show', jsonb_build_object('application_id', g.id, 'shift_id', g.shift_id,
                                                    'worker_id', g.worker_id)
    from gone g
    join ish.shifts s on s.id = g.shift_id
    join ish.business_members m on m.business_id = s.business_id
    returning 1
  )
  select count(*)::int into v_count from gone;

  with expired as (
    update ish.applications a
    set status = 'rejected', decided_at = now()
    from ish.shifts s
    where s.id = a.shift_id and a.status = 'pending' and s.starts_at <= now()
    returning a.id, a.worker_id, a.shift_id
  )
  insert into ish.notifications (user_id, kind, data)
  select worker_id, 'application_rejected',
         jsonb_build_object('application_id', id, 'shift_id', shift_id, 'reason', 'expired')
  from expired;

  return v_count;
end
$$;

revoke execute on function ish.close_finished_shifts() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Registration helpers (called by edge functions with the service role)
-- ---------------------------------------------------------------------------

-- business-register: after the 국세청 check. 01 계속사업자 → verified at once
-- (T8); otherwise the business waits (pending) or is rejected (폐업).
create function ish.register_business(
  p_owner uuid, p_biz_no text, p_name text, p_nts_status text,
  p_category text default 'other', p_address text default '', p_district text default null,
  p_lat double precision default null, p_lng double precision default null
)
returns ish.businesses
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_business ish.businesses;
begin
  insert into ish.businesses (owner_id, name, biz_no, nts_status, nts_checked_at, status,
                                 category, address, district, lat, lng)
  values (p_owner, p_name, p_biz_no, p_nts_status, now(),
          case p_nts_status when '01' then 'verified' when '03' then 'rejected' else 'pending' end
            ::ish.business_status,
          p_category, coalesce(p_address, ''), p_district, p_lat, p_lng)
  returning * into v_business;
  insert into ish.business_members (business_id, user_id, role) values (v_business.id, p_owner, 'owner');
  return v_business;
end
$$;

revoke execute on function ish.register_business(uuid, text, text, text, text, text, text, double precision, double precision)
  from public, anon, authenticated;

create function ish.register_push_token(p_token text, p_app text, p_platform text default 'android')
returns void
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_uid uuid := ish.require_uid();
begin
  insert into ish.push_tokens (token, user_id, app, platform, updated_at)
  values (p_token, v_uid, p_app, coalesce(p_platform, 'android'), now())
  on conflict (token) do update
    set user_id = excluded.user_id, app = excluded.app, platform = excluded.platform, updated_at = now();
end
$$;

-- ---------------------------------------------------------------------------
-- Reads that need aggregates (lists the apps show)
-- ---------------------------------------------------------------------------

-- Haversine distance in km.
create function ish.distance_km(lat1 double precision, lng1 double precision,
                                   lat2 double precision, lng2 double precision)
returns double precision
language sql
immutable
as $$
  select case when lat1 is null or lng1 is null or lat2 is null or lng2 is null then null
  else 6371.0 * 2 * asin(sqrt(
      power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)))
  end
$$;

-- A03 / A04: open shifts in a time range, nearest first, with what the card
-- shows. Distance from (p_lat, p_lng) when given.
create function ish.shift_feed(
  p_from timestamptz, p_to timestamptz,
  p_lat double precision default null, p_lng double precision default null,
  p_max_km double precision default null, p_min_wage int default null,
  p_categories text[] default null
)
returns table (
  id uuid, business_id uuid, business_name text, business_name_i18n jsonb,
  category text, business_verified boolean, title text, translations jsonb,
  address text, lat double precision, lng double precision,
  starts_at timestamptz, ends_at timestamptz, hourly_wage int, slots int,
  slots_left int, distance_km double precision, my_status ish.application_status
)
language sql
stable
security definer
set search_path = ish
as $$
  select s.id, b.id, b.name, b.name_i18n, b.category, b.status = 'verified', s.title, s.translations,
         s.address, coalesce(s.lat, b.lat), coalesce(s.lng, b.lng),
         s.starts_at, s.ends_at, s.hourly_wage, s.slots::int,
         greatest(s.slots - ish.confirmed_count(s.id), 0),
         ish.distance_km(p_lat, p_lng, coalesce(s.lat, b.lat), coalesce(s.lng, b.lng)),
         (select a.status from ish.applications a
          where a.shift_id = s.id and a.worker_id = auth.uid()
          order by a.created_at desc limit 1)
  from ish.shifts s
  join ish.businesses b on b.id = s.business_id
  where auth.uid() is not null
    and s.status = 'open' and b.status = 'verified'
    and s.starts_at > now()
    and s.starts_at >= p_from and s.starts_at < p_to
    and (p_min_wage is null or s.hourly_wage >= p_min_wage)
    and (p_categories is null or b.category = any (p_categories))
    and (p_max_km is null or p_lat is null or
         ish.distance_km(p_lat, p_lng, coalesce(s.lat, b.lat), coalesce(s.lng, b.lng)) <= p_max_km)
  order by 17 nulls last, s.starts_at
$$;

-- A05 rating line: stars and completed shifts of a business.
create function ish.business_stats(p_business uuid)
returns table (rating numeric, ratings int, completed_shifts int)
language sql
stable
security definer
set search_path = ish
as $$
  select
    (select round(avg(r.stars)::numeric, 1)
     from ish.ratings r join ish.applications a on a.id = r.application_id
     join ish.shifts s on s.id = a.shift_id
     where s.business_id = p_business and r.direction = 'worker_to_business'),
    (select count(*)::int
     from ish.ratings r join ish.applications a on a.id = r.application_id
     join ish.shifts s on s.id = a.shift_id
     where s.business_id = p_business and r.direction = 'worker_to_business'),
    (select count(*)::int
     from ish.applications a join ish.shifts s on s.id = a.shift_id
     where s.business_id = p_business and a.status = 'completed')
  where auth.uid() is not null
$$;

-- A11 and BA3/BA4: what is shown about a worker. [p_business] adds how many
-- times the worker completed a shift there (우리 매장 N회).
create function ish.worker_stats(p_worker uuid, p_business uuid default null)
returns table (reliability int, completed_shifts int, rating numeric, ratings int, shifts_here int)
language sql
stable
security definer
set search_path = ish
as $$
  select
    w.reliability::int,
    (select count(*)::int from ish.applications where worker_id = p_worker and status = 'completed'),
    (select round(avg(r.stars)::numeric, 1) from ish.ratings r
     join ish.applications a on a.id = r.application_id
     where a.worker_id = p_worker and r.direction = 'business_to_worker'),
    (select count(*)::int from ish.ratings r
     join ish.applications a on a.id = r.application_id
     where a.worker_id = p_worker and r.direction = 'business_to_worker'),
    case when p_business is null then null else
      (select count(*)::int from ish.applications a join ish.shifts s on s.id = a.shift_id
       where a.worker_id = p_worker and s.business_id = p_business and a.status = 'completed') end
  from ish.worker_profiles w
  where w.user_id = p_worker
    and (p_worker = auth.uid() or ish.is_my_applicant(p_worker))
    and (p_business is null or ish.is_business_member(p_business))
$$;

-- A09: the worker's pay for completed shifts in [p_from, p_to) (Korean dates).
create function ish.worker_earnings(p_from date, p_to date)
returns table (
  application_id uuid, shift_id uuid, business_name text, business_name_i18n jsonb,
  starts_at timestamptz, worked_minutes int, hourly_wage int, pay_amount int, paid boolean
)
language sql
stable
security definer
set search_path = ish
as $$
  select a.id, s.id, b.name, b.name_i18n, s.starts_at, a.worked_minutes, s.hourly_wage,
         a.pay_amount, a.paid_at is not null
  from ish.applications a
  join ish.shifts s on s.id = a.shift_id
  join ish.businesses b on b.id = s.business_id
  where a.worker_id = auth.uid() and a.status = 'completed'
    and (s.starts_at at time zone 'Asia/Seoul')::date >= p_from
    and (s.starts_at at time zone 'Asia/Seoul')::date < p_to
  order by s.starts_at desc
$$;

-- BA5: per shift, for the business's completed work in [p_from, p_to).
create function ish.business_report(p_business uuid, p_from date, p_to date)
returns table (
  shift_id uuid, title text, starts_at timestamptz, ends_at timestamptz, hourly_wage int,
  workers int, worked_minutes int, total_pay int, paid boolean
)
language sql
stable
security definer
set search_path = ish
as $$
  select s.id, s.title, s.starts_at, s.ends_at, s.hourly_wage,
         count(a.id)::int, coalesce(sum(a.worked_minutes), 0)::int, coalesce(sum(a.pay_amount), 0)::int,
         bool_and(a.paid_at is not null)
  from ish.shifts s
  join ish.applications a on a.shift_id = s.id and a.status = 'completed'
  where s.business_id = p_business and ish.is_business_member(p_business)
    and (s.starts_at at time zone 'Asia/Seoul')::date >= p_from
    and (s.starts_at at time zone 'Asia/Seoul')::date < p_to
  group by s.id
  order by s.starts_at desc
$$;

-- ---------------------------------------------------------------------------
-- Who may call what
-- ---------------------------------------------------------------------------

revoke execute on function ish.require_uid() from public, anon;
revoke execute on function ish.apply_to_shift(uuid) from public, anon;
revoke execute on function ish.cancel_application(uuid) from public, anon;
revoke execute on function ish.decide_application(uuid, boolean) from public, anon;
revoke execute on function ish.shift_qr(uuid) from public, anon;
revoke execute on function ish.cancel_shift(uuid) from public, anon;
revoke execute on function ish.set_shift_paid(uuid, boolean) from public, anon;
revoke execute on function ish.toggle_favorite(uuid, uuid) from public, anon;
revoke execute on function ish.request_again(uuid, uuid) from public, anon;
revoke execute on function ish.check_in(text) from public, anon;
revoke execute on function ish.check_out(text) from public, anon;
revoke execute on function ish.rate_business(uuid, int, text[]) from public, anon;
revoke execute on function ish.register_push_token(text, text, text) from public, anon;
revoke execute on function ish.shift_feed(timestamptz, timestamptz, double precision, double precision, double precision, int, text[]) from public, anon;
revoke execute on function ish.business_stats(uuid) from public, anon;
revoke execute on function ish.worker_stats(uuid, uuid) from public, anon;
revoke execute on function ish.worker_earnings(date, date) from public, anon;
revoke execute on function ish.business_report(uuid, date, date) from public, anon;
revoke execute on function ish.minimum_wage(timestamptz) from anon;
revoke execute on function ish.distance_km(double precision, double precision, double precision, double precision) from anon;

grant execute on function ish.require_uid() to authenticated;
grant execute on function ish.apply_to_shift(uuid) to authenticated;
grant execute on function ish.cancel_application(uuid) to authenticated;
grant execute on function ish.decide_application(uuid, boolean) to authenticated;
grant execute on function ish.shift_qr(uuid) to authenticated;
grant execute on function ish.cancel_shift(uuid) to authenticated;
grant execute on function ish.set_shift_paid(uuid, boolean) to authenticated;
grant execute on function ish.toggle_favorite(uuid, uuid) to authenticated;
grant execute on function ish.request_again(uuid, uuid) to authenticated;
grant execute on function ish.check_in(text) to authenticated;
grant execute on function ish.check_out(text) to authenticated;
grant execute on function ish.rate_business(uuid, int, text[]) to authenticated;
grant execute on function ish.register_push_token(text, text, text) to authenticated;
grant execute on function ish.shift_feed(timestamptz, timestamptz, double precision, double precision, double precision, int, text[]) to authenticated;
grant execute on function ish.business_stats(uuid) to authenticated;
grant execute on function ish.worker_stats(uuid, uuid) to authenticated;
grant execute on function ish.worker_earnings(date, date) to authenticated;
grant execute on function ish.business_report(uuid, date, date) to authenticated;
