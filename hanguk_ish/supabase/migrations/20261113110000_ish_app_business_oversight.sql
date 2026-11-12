-- P52 (2026-11-12): the staff watch over the businesses the 사장님 app opens
-- without a check (P50). Asrbek chose «no check, at once»; the safeguard
-- against a fake employer is the staff: they see every app business, give
-- it its real name, and suspend it (its shifts leave the feed, nobody can
-- apply) or let it back. And one app business cannot flood the feed.

-- The app's businesses (not the employers the staff keep), newest first,
-- with what the staff need to judge one.
create function ish.staff_app_businesses()
returns jsonb
language plpgsql
stable
security definer
set search_path = ish
as $$
begin
  perform ish.require_staff();
  return coalesce((
    select jsonb_agg(ish.business_card(b.id) || jsonb_build_object(
             'status', b.status, 'biz_no', b.biz_no, 'created_at', b.created_at,
             'category', b.category, 'area', b.area, 'address', b.address,
             'address_detail', b.address_detail, 'name_i18n', b.name_i18n,
             'open_shifts', (select count(*) from ish.shifts s
                             where s.business_id = b.id and s.status = 'open' and s.ends_at > now()),
             'shifts', (select count(*) from ish.shifts s where s.business_id = b.id),
             'shifts_24h', (select count(*) from ish.shifts s
                            where s.business_id = b.id and s.created_at > now() - interval '24 hours'),
             'last_shift_at', (select max(s.created_at) from ish.shifts s where s.business_id = b.id))
           order by b.created_at desc, b.id)
    from ish.businesses b
    where not b.managed_by_staff
  ), '[]'::jsonb);
end
$$;

-- The name the staff give for the workers ({"uz": …}) stands. A new Korean
-- name drops the old translations (businesses_i18n_reset) — also the Uzbek
-- name the staff typed again unchanged in the same form — so it is written
-- after the Korean one, by a second update the reset leaves alone. The other
-- languages stay unless the Korean name changed.
create function ish.staff_set_worker_name(p_business uuid, p_name_i18n jsonb)
returns void
language sql
set search_path = ish
as $$
  update ish.businesses
  set name_i18n = (name_i18n - 'uz') || coalesce(p_name_i18n, '{}'::jsonb)
  where id = p_business;
$$;

revoke execute on function ish.staff_set_worker_name(uuid, jsonb) from public, anon, authenticated;

-- The employers the staff keep (P39) had the same loss: a corrected Korean
-- name dropped the Uzbek one. Otherwise as in 20261112170000.
create or replace function ish.staff_save_business(
  p_business uuid, p_name text, p_category text default 'other',
  p_area text default '', p_address text default '', p_address_detail text default '',
  p_district text default null, p_lat double precision default null, p_lng double precision default null,
  p_name_i18n jsonb default '{}'::jsonb, p_contact jsonb default '{}'::jsonb)
returns uuid
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_uid uuid := ish.require_staff();
  v_id uuid;
begin
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'INVALID';
  end if;
  if p_business is null then
    insert into ish.businesses (owner_id, name, name_i18n, status, managed_by_staff, category,
                                   area, address, address_detail, district, lat, lng)
    values (v_uid, btrim(p_name), coalesce(p_name_i18n, '{}'::jsonb), 'verified', true, p_category,
            coalesce(p_area, ''), coalesce(p_address, ''), coalesce(p_address_detail, ''), p_district, p_lat, p_lng)
    returning id into v_id;
  else
    update ish.businesses
    set name = btrim(p_name), category = p_category,
        area = coalesce(p_area, ''), address = coalesce(p_address, ''),
        address_detail = coalesce(p_address_detail, ''), district = p_district, lat = p_lat, lng = p_lng
    where id = p_business and managed_by_staff
    returning id into v_id;
    if v_id is null then
      raise exception 'NOT_FOUND';
    end if;
    perform ish.staff_set_worker_name(v_id, p_name_i18n);
  end if;
  insert into ish.business_contacts (business_id, contact_name, phone, telegram, source, notes,
                                        updated_at, updated_by)
  values (v_id, coalesce(p_contact ->> 'contact_name', ''), coalesce(p_contact ->> 'phone', ''),
          coalesce(p_contact ->> 'telegram', ''), coalesce(p_contact ->> 'source', ''),
          coalesce(p_contact ->> 'notes', ''), now(), v_uid)
  on conflict (business_id) do update
  set contact_name = excluded.contact_name, phone = excluded.phone, telegram = excluded.telegram,
      source = excluded.source, notes = excluded.notes, updated_at = now(), updated_by = v_uid;
  return v_id;
end
$$;

-- The real name and place of an app business (it opens as «사업장 XXXX»).
-- The employers the staff keep are saved with staff_save_business.
create function ish.staff_update_app_business(
  p_business uuid, p_name text, p_category text default 'other',
  p_area text default '', p_address text default '', p_address_detail text default '',
  p_name_i18n jsonb default '{}'::jsonb)
returns uuid
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_id uuid;
begin
  perform ish.require_staff();
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'INVALID';
  end if;
  update ish.businesses
  set name = btrim(p_name), category = p_category,
      area = coalesce(p_area, ''), address = coalesce(p_address, ''),
      address_detail = coalesce(p_address_detail, '')
  where id = p_business and not managed_by_staff
  returning id into v_id;
  if v_id is null then
    raise exception 'NOT_FOUND';
  end if;
  perform ish.staff_set_worker_name(v_id, p_name_i18n);
  return v_id;
end
$$;

-- Suspend an app business (rejected: out of the feed and the map, nobody can
-- apply; BA1 tells the owner) or let it back (verified). Confirmed workers
-- keep their shift: the staff call them.
create function ish.staff_set_app_business_blocked(p_business uuid, p_blocked boolean)
returns text
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_status ish.business_status;
begin
  perform ish.require_staff();
  if p_blocked is null then
    raise exception 'INVALID';
  end if;
  update ish.businesses
  set status = case when p_blocked then 'rejected' else 'verified' end::ish.business_status
  where id = p_business and not managed_by_staff
  returning status into v_status;
  if v_status is null then
    raise exception 'NOT_FOUND';
  end if;
  return v_status::text;
end
$$;

revoke execute on function ish.staff_app_businesses() from public, anon;
revoke execute on function ish.staff_update_app_business(uuid, text, text, text, text, text, jsonb) from public, anon;
revoke execute on function ish.staff_set_app_business_blocked(uuid, boolean) from public, anon;
grant execute on function ish.staff_app_businesses() to authenticated;
grant execute on function ish.staff_update_app_business(uuid, text, text, text, text, text, jsonb) to authenticated;
grant execute on function ish.staff_set_app_business_blocked(uuid, boolean) to authenticated;

-- One business posts at most 30 shifts a day from the app (TOO_MANY_REQUESTS,
-- which the 사장님 app explains). The staff's own changes are not counted.
create or replace function ish.shifts_guard()
returns trigger
language plpgsql
set search_path = ish
as $$
declare
  v_taken int;
begin
  if current_user <> 'authenticated' and current_setting('ish.staff_edit', true) is distinct from 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if not exists (
      select 1 from ish.businesses b where b.id = new.business_id and b.status = 'verified'
    ) then
      raise exception 'BUSINESS_NOT_VERIFIED';
    end if;
    if new.starts_at <= now() then
      raise exception 'IN_THE_PAST';
    end if;
    if current_setting('ish.staff_edit', true) is distinct from 'on' and (
      select count(*) from ish.shifts s
      where s.business_id = new.business_id and s.created_at > now() - interval '24 hours'
    ) >= 30 then
      raise exception 'TOO_MANY_REQUESTS';
    end if;
    return new;
  end if;
  if old.status <> 'open' then
    raise exception 'SHIFT_CLOSED';
  end if;
  if old.ends_at <= now() then
    raise exception 'SHIFT_ENDED';
  end if;
  -- Members see their shift's applications (RLS), so the count is complete.
  select count(*)::int into v_taken from ish.applications
  where shift_id = old.id and status in ('confirmed', 'checked_in', 'completed');
  if (new.starts_at, new.ends_at) is distinct from (old.starts_at, old.ends_at) then
    if v_taken > 0 then
      raise exception 'HAS_CREW';
    end if;
    if new.starts_at <= now() then
      raise exception 'IN_THE_PAST';
    end if;
  end if;
  if new.slots < v_taken then
    raise exception 'SLOTS_BELOW_CREW';
  end if;
  return new;
end
$$;
