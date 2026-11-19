-- Hanguk Ish — a new shift reaches more of the workers who could take it.
--
-- Before: only workers with a saved position within 5 km were told. A worker
-- who never allowed the location (or whose position was never saved) heard
-- nothing, and a shift 6–10 km away reached nobody.
--
-- Now:
--   · a worker with a position is told for shifts within 10 km (was 5);
--   · a worker with no saved position is told when the A02 district they
--     chose is the business's district (both written the same way).
-- Everything else is as before (P32 box and index, P39 invite-only shifts
-- are never broadcast): onboarded, free at that time, no own application on
-- it, not a member of the business, at most 3 a day, 50 per shift, a
-- verified business, a shift still ahead. The digest stays at 3 km.

create index worker_profiles_district_idx on ish.worker_profiles (lower(btrim(district)))
  where onboarded_at is not null and (lat is null or lng is null);

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
    select s.id, s.business_id, s.starts_at, b.district,
           coalesce(s.lat, b.lat) as lat, coalesce(s.lng, b.lng) as lng,
           ish.availability_bit(s.starts_at) as bit
    from ish.shifts s join ish.businesses b on b.id = s.business_id
    where s.id = p_shift and s.status = 'open' and b.status = 'verified' and s.starts_at > now()
      and not s.invite_only
  ), picked as (
    -- With a position: a box a little wider than the circle first (plain
    -- comparisons, the index), then the distance.
    select w.user_id, ish.distance_km(w.lat, w.lng, shift.lat, shift.lng) as km
    from ish.worker_profiles w, shift
    where w.onboarded_at is not null
      and w.lat is not null and w.lng is not null and shift.lat is not null
      and w.lat between shift.lat - 10 / 110.0 and shift.lat + 10 / 110.0
      and w.lng between shift.lng - 10 / (110.0 * cos(radians(shift.lat)))
                    and shift.lng + 10 / (110.0 * cos(radians(shift.lat)))
      and ish.distance_km(w.lat, w.lng, shift.lat, shift.lng) <= 10
    union all
    -- Without one: the same district.
    select w.user_id, null::double precision
    from ish.worker_profiles w, shift
    where w.onboarded_at is not null and (w.lat is null or w.lng is null)
      and nullif(btrim(shift.district), '') is not null
      and lower(btrim(w.district)) = lower(btrim(shift.district))
  ), candidates as (
    select w.user_id, p.km, shift.id as shift_id
    from picked p
    join ish.worker_profiles w on w.user_id = p.user_id, shift
    where (w.availability = 0 or (w.availability >> shift.bit) & 1 = 1)
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
  select user_id, 'new_shift_match',
         -- Without a position there is no distance: the app ends the line at the wage.
         jsonb_strip_nulls(jsonb_build_object(
           'shift_id', shift_id, 'distance_km', case when km is not null then round(km::numeric, 1) end))
  from candidates
  order by km nulls last
  limit 50;
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

revoke execute on function ish.notify_shift_matches(uuid) from public, anon, authenticated;
