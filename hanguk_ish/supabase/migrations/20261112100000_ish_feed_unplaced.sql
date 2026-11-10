-- Hanguk Ish: a shift whose place is not known yet still reaches the feed.
--
-- A business registered on BA0 has only its number: no address and no point
-- (where the store details are asked is still open). Under a distance filter
-- (the feed opens with 3 km) such a shift had no distance and was left out,
-- so no worker whose position was known ever saw it. It now comes after the
-- shifts in range (nearest first, unknown last), with no distance on the
-- card; its own address (BA2 «주소») is on the card as before.

create or replace function public.shift_feed(
  p_from timestamptz, p_to timestamptz,
  p_lat double precision default null, p_lng double precision default null,
  p_max_km double precision default null, p_min_wage int default null,
  p_categories text[] default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_uid();
  return coalesce((
    select jsonb_agg(public.shift_card(f.id, p_lat, p_lng) order by f.distance nulls last, f.starts_at, f.id)
    from (
      select s.id, s.starts_at,
             public.distance_km(p_lat, p_lng, coalesce(s.lat, b.lat), coalesce(s.lng, b.lng)) as distance
      from public.shifts s
      join public.businesses b on b.id = s.business_id
      where s.status = 'open' and b.status = 'verified'
        and s.starts_at > now()
        and s.starts_at >= p_from and s.starts_at < p_to
        and (p_min_wage is null or s.hourly_wage >= p_min_wage)
        and (p_categories is null or b.category = any (p_categories))
        and (p_max_km is null or p_lat is null or p_lng is null
             or coalesce(s.lat, b.lat) is null or coalesce(s.lng, b.lng) is null
             or public.distance_km(p_lat, p_lng, coalesce(s.lat, b.lat), coalesce(s.lng, b.lng)) <= p_max_km)
      order by 3 nulls last, s.starts_at, s.id
      limit 200
    ) f
  ), '[]'::jsonb);
end
$$;
