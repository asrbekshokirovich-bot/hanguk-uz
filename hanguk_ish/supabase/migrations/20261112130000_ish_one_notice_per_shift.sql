-- Hanguk Ish: one notice per shift for an invited worker.
--
-- A shift posted from BA4 «다시 요청» first reaches nearby free workers as
-- «new shift nearby» (the insert trigger), the invited worker among them;
-- the invitation then came as a second, identical-looking A12 entry. The
-- invitation now replaces that earlier notice.

create or replace function public.request_again(p_shift uuid, p_worker uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shift public.shifts;
  v_km double precision;
begin
  perform public.require_uid();
  select * into v_shift from public.shifts where id = p_shift;
  if not found or not public.is_business_member(v_shift.business_id) then
    raise exception 'NOT_FOUND';
  end if;
  if v_shift.status <> 'open' or v_shift.starts_at <= now() then
    raise exception 'SHIFT_CLOSED';
  end if;
  if not exists (
    select 1 from public.applications a join public.shifts s on s.id = a.shift_id
    where s.business_id = v_shift.business_id and a.worker_id = p_worker and a.status = 'completed'
  ) then
    raise exception 'NOT_FOUND';
  end if;
  if exists (
    select 1 from public.notifications n
    where n.user_id = p_worker and n.kind = 'request_again' and n.data ->> 'shift_id' = p_shift::text
  ) then
    return;
  end if;
  -- The «new shift nearby» this shift may have sent the worker when it was
  -- posted gives way to the invitation: one notice per shift.
  delete from public.notifications n
  where n.user_id = p_worker and n.kind = 'new_shift_match' and n.data ->> 'shift_id' = p_shift::text;
  select public.distance_km(w.lat, w.lng, coalesce(v_shift.lat, b.lat), coalesce(v_shift.lng, b.lng))
    into v_km
  from public.worker_profiles w, public.businesses b
  where w.user_id = p_worker and b.id = v_shift.business_id;
  perform public.notify(p_worker, 'request_again', jsonb_strip_nulls(jsonb_build_object(
    'shift_id', p_shift, 'business_id', v_shift.business_id,
    'distance_km', round(v_km::numeric, 1))));
end
$$;
