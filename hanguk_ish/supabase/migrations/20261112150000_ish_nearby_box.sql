-- Hanguk Ish — nearby workers at scale (P32, 2026-11-12).
--
-- Measured on 20 000 workers, 500 businesses, 40 000 shifts (tests/perf.sh):
-- a new shift looked at every worker before the distance (and counted each
-- one's notices of the day): 118 ms for each shift posted; the evening
-- digest paired every worker with every shift of the next two days: 6.9 s.
-- A box around the place first — plain comparisons an index can answer —
-- then the exact distance: 67 ms and 2.4 s on the same data. The box is a
-- little wider than the circle (110 km a degree instead of 111.2), so the
-- distance still decides who is in.

create index worker_profiles_place_idx on ish.worker_profiles (lat, lng)
  where onboarded_at is not null;

create or replace function ish.notify_shift_matches(p_shift uuid)
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
      -- A box a little wider than the circle first (plain comparisons, the
      -- index), then the distance, then the counting below — only for the
      -- workers inside 5 km.
      and w.lat between shift.lat - 5 / 110.0 and shift.lat + 5 / 110.0
      and w.lng between shift.lng - 5 / (110.0 * cos(radians(shift.lat)))
                    and shift.lng + 5 / (110.0 * cos(radians(shift.lat)))
      and ish.distance_km(w.lat, w.lng, shift.lat, shift.lng) <= 5
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

create or replace function ish.queue_nearby_digests()
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
      -- The box first (as above), then the distance.
      and w.lat between coalesce(s.lat, b.lat) - 3 / 110.0 and coalesce(s.lat, b.lat) + 3 / 110.0
      and w.lng between coalesce(s.lng, b.lng) - 3 / (110.0 * cos(radians(coalesce(s.lat, b.lat))))
                    and coalesce(s.lng, b.lng) + 3 / (110.0 * cos(radians(coalesce(s.lat, b.lat))))
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
