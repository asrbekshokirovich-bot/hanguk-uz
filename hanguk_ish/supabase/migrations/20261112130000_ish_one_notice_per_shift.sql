-- Hanguk Ish: one notice per shift for an invited worker.
--
-- A shift posted from BA4 «다시 요청» first reaches nearby free workers as
-- «new shift nearby» (the insert trigger), the invited worker among them;
-- the invitation then came as a second, identical-looking A12 entry. The
-- invitation now replaces that earlier notice.

create or replace function ish.request_again(p_shift uuid, p_worker uuid)
returns void
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_shift ish.shifts;
  v_km double precision;
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
  if exists (
    select 1 from ish.notifications n
    where n.user_id = p_worker and n.kind = 'request_again' and n.data ->> 'shift_id' = p_shift::text
  ) then
    return;
  end if;
  -- The «new shift nearby» this shift may have sent the worker when it was
  -- posted gives way to the invitation: one notice per shift.
  delete from ish.notifications n
  where n.user_id = p_worker and n.kind = 'new_shift_match' and n.data ->> 'shift_id' = p_shift::text;
  select ish.distance_km(w.lat, w.lng, coalesce(v_shift.lat, b.lat), coalesce(v_shift.lng, b.lng))
    into v_km
  from ish.worker_profiles w, ish.businesses b
  where w.user_id = p_worker and b.id = v_shift.business_id;
  perform ish.notify(p_worker, 'request_again', jsonb_strip_nulls(jsonb_build_object(
    'shift_id', p_shift, 'business_id', v_shift.business_id,
    'distance_km', round(v_km::numeric, 1))));
end
$$;
