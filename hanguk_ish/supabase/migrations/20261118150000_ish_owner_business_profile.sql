-- Hanguk Ish — the owner names their own business (2026-11-18).
--
-- The 사장님 app opened a business as «사업장 XXXX» and only the staff could give
-- it the real name. Right after signing in the owner now fills in the
-- profile: name, kind of work, neighbourhood and street address. Only the
-- owner of an app business (not one the staff keep) can change it.

create function ish.update_my_business(
  p_business uuid, p_name text, p_category text default 'other',
  p_area text default '', p_address text default '')
returns uuid
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_uid uuid := ish.require_uid();
  v_id uuid;
begin
  if coalesce(btrim(p_name), '') = '' or char_length(btrim(p_name)) > 80
     or p_category is null
     or p_category not in ('cafe', 'restaurant', 'retail', 'logistics', 'event', 'office', 'other')
     or char_length(coalesce(p_address, '')) > 200 or char_length(coalesce(p_area, '')) > 40 then
    raise exception 'INVALID';
  end if;
  update ish.businesses b
  set name = btrim(p_name), category = p_category,
      area = btrim(coalesce(p_area, '')), address = btrim(coalesce(p_address, ''))
  where b.id = p_business and not b.managed_by_staff
    and exists (select 1 from ish.business_members m
                where m.business_id = b.id and m.user_id = v_uid and m.role = 'owner')
  returning b.id into v_id;
  if v_id is null then
    raise exception 'NOT_FOUND';
  end if;
  return v_id;
end
$$;

revoke execute on function ish.update_my_business(uuid, text, text, text, text) from public, anon;
grant execute on function ish.update_my_business(uuid, text, text, text, text) to authenticated;
