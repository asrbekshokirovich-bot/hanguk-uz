-- Hanguk Ish — telling workers about shifts that suit them (P10, 2026-11-11).
--
--   * a new open shift of a verified business notifies the workers near it
--     (their last approximate position, 5 km) who are free at that time
--     (A02 availability) — `new_shift_match`, at most 3 a day each;
--   * every evening workers with open shifts within 3 km over the next two
--     days get one `nearby_digest` (A12 «… atrofida 3 ta yangi smena»).
-- The text is built by the app from the data (A12).

-- A02 availability bit of a moment: (Korean weekday, Monday = 0) × 4 + part
-- of the day (06–12, 12–18, 18–24, 00–06 → 0–3), the same as the app's
-- FeedQuery.dayPartOf.
create function ish.availability_bit(p_at timestamptz)
returns int
language sql
immutable
as $$
  select ((extract(isodow from p_at at time zone 'Asia/Seoul')::int - 1) * 4
         + case
             when extract(hour from p_at at time zone 'Asia/Seoul') >= 18 then 2
             when extract(hour from p_at at time zone 'Asia/Seoul') >= 12 then 1
             when extract(hour from p_at at time zone 'Asia/Seoul') >= 6 then 0
             else 3
           end)
$$;

-- Workers to tell about [p_shift]: onboarded, near (5 km), free then (no
-- availability given counts as any time), not members of the business, not
-- holding it already, under 3 matches today. The 50 nearest. Returns how many.
create function ish.notify_shift_matches(p_shift uuid)
returns int
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_count int;
begin
  with shift as (
    select s.id, s.business_id, s.starts_at, coalesce(s.lat, b.lat) as lat, coalesce(s.lng, b.lng) as lng,
           ish.availability_bit(s.starts_at) as bit
    from ish.shifts s join ish.businesses b on b.id = s.business_id
    where s.id = p_shift and s.status = 'open' and b.status = 'verified' and s.starts_at > now()
  ), candidates as (
    select w.user_id, ish.distance_km(w.lat, w.lng, shift.lat, shift.lng) as km, shift.id as shift_id
    from ish.worker_profiles w, shift
    where w.onboarded_at is not null
      and w.lat is not null and w.lng is not null and shift.lat is not null
      and (w.availability = 0 or (w.availability >> shift.bit) & 1 = 1)
      and not exists (select 1 from ish.business_members m
                      where m.business_id = shift.business_id and m.user_id = w.user_id)
      and not exists (select 1 from ish.applications a
                      where a.shift_id = shift.id and a.worker_id = w.user_id
                        and a.status not in ('cancelled', 'rejected'))
      and (select count(*) from ish.notifications n
           where n.user_id = w.user_id and n.kind = 'new_shift_match'
             and n.created_at > now() - interval '1 day') < 3
  )
  insert into ish.notifications (user_id, kind, data)
  select user_id, 'new_shift_match', jsonb_build_object('shift_id', shift_id, 'distance_km', round(km::numeric, 1))
  from candidates
  where km <= 5
  order by km
  limit 50;
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

create function ish.shifts_notify_matches()
returns trigger
language plpgsql
security definer
set search_path = ish
as $$
begin
  perform ish.notify_shift_matches(new.id);
  return null;
end
$$;

create trigger shifts_notify_matches after insert on ish.shifts
  for each row execute function ish.shifts_notify_matches();

-- The evening digest: for each onboarded worker with a position, the open
-- shifts within 3 km starting in the next two days that they have not
-- taken. Data: count, area_code (the worker's A02 district, named by the
-- app), categories, wage_min / wage_max, the worker's position. Once a day.
create function ish.queue_nearby_digests()
returns int
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_count int;
begin
  with nearby as (
    select w.user_id, w.district, w.lat as w_lat, w.lng as w_lng, s.hourly_wage, b.category
    from ish.worker_profiles w
    join ish.shifts s on s.status = 'open' and s.starts_at > now() and s.starts_at < now() + interval '2 days'
    join ish.businesses b on b.id = s.business_id and b.status = 'verified'
    where w.onboarded_at is not null and w.lat is not null and w.lng is not null
      and ish.distance_km(w.lat, w.lng, coalesce(s.lat, b.lat), coalesce(s.lng, b.lng)) <= 3
      and not exists (select 1 from ish.applications a
                      where a.shift_id = s.id and a.worker_id = w.user_id
                        and a.status not in ('cancelled', 'rejected'))
      and not exists (select 1 from ish.business_members m
                      where m.business_id = b.id and m.user_id = w.user_id)
  ), per_worker as (
    select user_id, min(district) as district, min(w_lat) as lat, min(w_lng) as lng,
           count(*)::int as shifts, min(hourly_wage) as wage_min, max(hourly_wage) as wage_max,
           to_jsonb(array_agg(distinct category order by category)) as categories
    from nearby
    group by user_id
  )
  insert into ish.notifications (user_id, kind, data)
  select p.user_id, 'nearby_digest', jsonb_build_object(
           'count', p.shifts, 'area_code', p.district, 'categories', p.categories,
           'wage_min', p.wage_min, 'wage_max', p.wage_max, 'lat', p.lat, 'lng', p.lng)
  from per_worker p
  where not exists (select 1 from ish.notifications n
                    where n.user_id = p.user_id and n.kind = 'nearby_digest'
                      and n.created_at > now() - interval '20 hours');
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

revoke execute on function ish.notify_shift_matches(uuid) from public, anon, authenticated;
revoke execute on function ish.queue_nearby_digests() from public, anon, authenticated;

-- 18:00 in Seoul is 09:00 UTC.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('ish-nearby-digests', '0 9 * * *', 'select ish.queue_nearby_digests()');
  end if;
end
$$;
