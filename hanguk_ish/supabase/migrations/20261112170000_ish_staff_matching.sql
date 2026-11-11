-- Hanguk Ish — Hanguk's staff match jobs found outside the app (Telegram
-- groups and channels) with workers, through hanguk.uz (CRM → «Hanguk Ish»).
-- Plan: docs/operator-reja.md.
--
--   staff_members     who the staff are (added by an admin, service role)
--   managed_by_staff  an employer outside the app, kept by the staff: no
--                     사업자등록번호 needed, no 국세청 check
--   business_contacts the employer's phone, Telegram, where the job was found,
--   shift_notes       notes — staff only (no table rights; staff_* functions)
--   invite_only       a job only invited workers see and take: not in the feed,
--                     the map or the «new shift nearby» messages
--   job_offers        «Sizga ish taklif qilindi»: sent, declined, applied
--
-- On a business they manage, the staff stand in for the owner: the 사장님
-- functions (확정/거절, cancelling, QR, paid, chat) work for them. The hourly
-- job leaves such shifts' attendance to them (staff_mark_attendance) — an
-- employer outside the app may not have put up the QR, and the worker must
-- not lose 20 points for it.

-- ---------------------------------------------------------------------------
-- Staff
-- ---------------------------------------------------------------------------

create table public.staff_members (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  role text not null default 'operator' check (role in ('operator', 'admin')),
  created_at timestamptz not null default now()
);
alter table public.staff_members enable row level security;
create policy staff_members_own on public.staff_members
  for select to authenticated using (user_id = auth.uid());
-- New tables get every right by default (Supabase); only what is needed stays.
revoke all on public.staff_members from anon, authenticated;
grant select on public.staff_members to authenticated;

create function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.staff_members where user_id = auth.uid())
$$;
revoke execute on function public.is_staff() from public, anon;
grant execute on function public.is_staff() to authenticated;

-- The caller, who must be staff.
create function public.require_staff()
returns uuid
language plpgsql
stable
set search_path = public
as $$
declare
  v_uid uuid := public.require_uid();
begin
  if not public.is_staff() then
    raise exception 'FORBIDDEN';
  end if;
  return v_uid;
end
$$;
revoke execute on function public.require_staff() from public, anon;

-- ---------------------------------------------------------------------------
-- Employers outside the app, and what only the staff see
-- ---------------------------------------------------------------------------

alter table public.businesses add column managed_by_staff boolean not null default false;
alter table public.businesses alter column biz_no drop not null;
alter table public.businesses add constraint businesses_biz_no_or_managed
  check (biz_no is not null or managed_by_staff);

create table public.business_contacts (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  contact_name text not null default '' check (char_length(contact_name) <= 80),
  phone text not null default '' check (char_length(phone) <= 32),
  telegram text not null default '' check (char_length(telegram) <= 64),
  -- Where the job was found: a Telegram post, a group, a call.
  source text not null default '' check (char_length(source) <= 300),
  notes text not null default '' check (char_length(notes) <= 2000),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);
alter table public.business_contacts enable row level security;
revoke all on public.business_contacts from anon, authenticated;

create table public.shift_notes (
  shift_id uuid primary key references public.shifts (id) on delete cascade,
  source text not null default '' check (char_length(source) <= 300),
  notes text not null default '' check (char_length(notes) <= 2000),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);
alter table public.shift_notes enable row level security;
revoke all on public.shift_notes from anon, authenticated;

alter table public.shifts add column invite_only boolean not null default false;

create table public.job_offers (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts (id) on delete cascade,
  worker_id uuid not null references public.profiles (id) on delete cascade,
  sent_by uuid references public.profiles (id) on delete set null,
  note text not null default '' check (char_length(note) <= 300),
  status text not null default 'sent' check (status in ('sent', 'declined', 'applied')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (shift_id, worker_id)
);
create index job_offers_worker_idx on public.job_offers (worker_id, created_at desc);
alter table public.job_offers enable row level security;
create policy job_offers_own on public.job_offers
  for select to authenticated using (worker_id = auth.uid());
revoke all on public.job_offers from anon, authenticated;
grant select on public.job_offers to authenticated;

-- A12: «Sizga ish taklif qilindi» (data: offer_id, shift_id, business_id, note).
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'shift_reminder', 'application_confirmed', 'application_rejected',
  'new_shift_match', 'nearby_digest', 'new_applicant', 'worker_cancelled',
  'no_show', 'request_again', 'chat_message', 'payment_marked', 'job_offer'
));

-- ---------------------------------------------------------------------------
-- On the businesses they manage, the staff stand in for the owner
-- ---------------------------------------------------------------------------

create or replace function public.is_business_member(p_business uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.business_members
    where business_id = p_business and user_id = auth.uid()
  ) or exists (
    select 1 from public.businesses b
    where b.id = p_business and b.managed_by_staff and public.is_staff()
  )
$$;

create or replace function public.is_shift_member(p_shift uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.shifts s
    join public.business_members m on m.business_id = s.business_id
    where s.id = p_shift and m.user_id = auth.uid()
  ) or exists (
    select 1
    from public.shifts s
    join public.businesses b on b.id = s.business_id
    where s.id = p_shift and b.managed_by_staff and public.is_staff()
  )
$$;

create or replace function public.is_application_party(p_application uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.applications a
    join public.shifts s on s.id = a.shift_id
    where a.id = p_application
      and (a.worker_id = auth.uid() or public.is_business_member(s.business_id))
  )
$$;

-- The staff read every worker's profile (matching is their job).
create or replace function public.is_my_applicant(p_worker uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.applications a
    join public.shifts s on s.id = a.shift_id
    join public.business_members m on m.business_id = s.business_id
    where a.worker_id = p_worker and m.user_id = auth.uid()
  ) or exists (
    select 1
    from public.favorites f
    join public.business_members m on m.business_id = f.business_id
    where f.worker_id = p_worker and m.user_id = auth.uid()
  ) or public.is_staff()
$$;

-- Staff changes to shifts go through the same checks and releases as the
-- 사장님 app's (shifts_guard, shifts_release_on_move): their functions mark
-- the change with ish.staff_edit (this transaction only).
create or replace function public.shifts_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_taken int;
begin
  if current_user <> 'authenticated' and current_setting('ish.staff_edit', true) is distinct from 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if not exists (
      select 1 from public.businesses b where b.id = new.business_id and b.status = 'verified'
    ) then
      raise exception 'BUSINESS_NOT_VERIFIED';
    end if;
    if new.starts_at <= now() then
      raise exception 'IN_THE_PAST';
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
  select count(*)::int into v_taken from public.applications
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

drop trigger shifts_release_on_move on public.shifts;
create trigger shifts_release_on_move after update of starts_at, ends_at on public.shifts
  for each row
  when ((new.starts_at, new.ends_at) is distinct from (old.starts_at, old.ends_at)
        and (current_user = 'authenticated' or current_setting('ish.staff_edit', true) = 'on'))
  execute function public.shifts_release_on_move();

-- ---------------------------------------------------------------------------
-- Invite-only jobs: out of the feed, the map and the matching messages; the
-- invited worker reads and takes them
-- ---------------------------------------------------------------------------

create or replace function public.shift_feed(
  p_from timestamptz, p_to timestamptz,
  p_lat double precision default null, p_lng double precision default null,
  p_max_km double precision default null, p_min_wage int default null,
  p_categories text[] default null)
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
      where s.status = 'open' and b.status = 'verified' and not s.invite_only
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

create or replace function public.shift_details(
  p_shift uuid, p_lat double precision default null, p_lng double precision default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.require_uid();
begin
  if not exists (
    select 1
    from public.shifts s join public.businesses b on b.id = s.business_id
    where s.id = p_shift and (
      (s.status = 'open' and b.status = 'verified' and (not s.invite_only or exists (
        select 1 from public.job_offers o where o.shift_id = s.id and o.worker_id = v_uid)))
      or exists (select 1 from public.applications a where a.shift_id = s.id and a.worker_id = v_uid)
      or public.is_business_member(s.business_id))
  ) then
    raise exception 'NOT_FOUND';
  end if;
  return public.shift_card(p_shift, p_lat, p_lng);
end
$$;

-- The card tells the worker about an offer they have for it.
create or replace function public.shift_card(
  p_shift uuid, p_lat double precision default null, p_lng double precision default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', s.id,
    'business', public.business_card(s.business_id),
    'title', s.title,
    'duties', s.duties,
    'dress', s.dress,
    'address', s.address,
    'translations', s.translations,
    'starts_at', s.starts_at,
    'ends_at', s.ends_at,
    'hourly_wage', s.hourly_wage,
    'slots', s.slots,
    'slots_left', greatest(s.slots - public.confirmed_count(s.id), 0),
    'auto_confirm', s.auto_confirm,
    'status', s.status,
    'lat', coalesce(s.lat, b.lat),
    'lng', coalesce(s.lng, b.lng),
    'distance_km', round(public.distance_km(p_lat, p_lng, coalesce(s.lat, b.lat),
                                            coalesce(s.lng, b.lng))::numeric, 3),
    'my_application_id', my.id,
    'my_status', my.status,
    'offer', (select jsonb_build_object('id', o.id, 'status', o.status, 'note', o.note)
              from public.job_offers o where o.shift_id = s.id and o.worker_id = auth.uid())
  )
  from public.shifts s
  join public.businesses b on b.id = s.business_id
  left join lateral (
    select a.id, a.status from public.applications a
    where a.shift_id = s.id and a.worker_id = auth.uid()
    order by a.created_at desc, a.id desc
    limit 1
  ) my on true
  where s.id = p_shift
$$;

create or replace function public.notify_shift_matches(p_shift uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  with shift as (
    select s.id, s.business_id, s.starts_at, coalesce(s.lat, b.lat) as lat, coalesce(s.lng, b.lng) as lng,
           public.availability_bit(s.starts_at) as bit
    from public.shifts s join public.businesses b on b.id = s.business_id
    where s.id = p_shift and s.status = 'open' and b.status = 'verified' and s.starts_at > now()
      and not s.invite_only
  ), candidates as (
    select w.user_id, public.distance_km(w.lat, w.lng, shift.lat, shift.lng) as km, shift.id as shift_id
    from public.worker_profiles w, shift
    where w.onboarded_at is not null
      and w.lat is not null and w.lng is not null and shift.lat is not null
      -- A box a little wider than the circle first (plain comparisons, the
      -- index), then the distance, then the counting below — only for the
      -- workers inside 5 km.
      and w.lat between shift.lat - 5 / 110.0 and shift.lat + 5 / 110.0
      and w.lng between shift.lng - 5 / (110.0 * cos(radians(shift.lat)))
                    and shift.lng + 5 / (110.0 * cos(radians(shift.lat)))
      and public.distance_km(w.lat, w.lng, shift.lat, shift.lng) <= 5
      and (w.availability = 0 or (w.availability >> shift.bit) & 1 = 1)
      and not exists (select 1 from public.business_members m
                      where m.business_id = shift.business_id and m.user_id = w.user_id)
      and not exists (select 1 from public.applications a
                      where a.shift_id = shift.id and a.worker_id = w.user_id
                        and a.status not in ('cancelled', 'rejected'))
      and (select count(*) from public.notifications n
           where n.user_id = w.user_id and n.kind = 'new_shift_match'
             and n.created_at > now() - interval '1 day') < 3
  )
  insert into public.notifications (user_id, kind, data)
  select user_id, 'new_shift_match', jsonb_build_object('shift_id', shift_id, 'distance_km', round(km::numeric, 1))
  from candidates
  where km <= 5
  order by km
  limit 50;
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

create or replace function public.queue_nearby_digests()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  with nearby as (
    select w.user_id, w.district, w.lat as w_lat, w.lng as w_lng, s.hourly_wage, b.category
    from public.worker_profiles w
    join public.shifts s on s.status = 'open' and not s.invite_only
      and s.starts_at > now() and s.starts_at < now() + interval '2 days'
    join public.businesses b on b.id = s.business_id and b.status = 'verified'
    where w.onboarded_at is not null and w.lat is not null and w.lng is not null
      -- The box first (as above), then the distance.
      and w.lat between coalesce(s.lat, b.lat) - 3 / 110.0 and coalesce(s.lat, b.lat) + 3 / 110.0
      and w.lng between coalesce(s.lng, b.lng) - 3 / (110.0 * cos(radians(coalesce(s.lat, b.lat))))
                    and coalesce(s.lng, b.lng) + 3 / (110.0 * cos(radians(coalesce(s.lat, b.lat))))
      and public.distance_km(w.lat, w.lng, coalesce(s.lat, b.lat), coalesce(s.lng, b.lng)) <= 3
      and not exists (select 1 from public.applications a
                      where a.shift_id = s.id and a.worker_id = w.user_id
                        and a.status not in ('cancelled', 'rejected'))
      and not exists (select 1 from public.business_members m
                      where m.business_id = b.id and m.user_id = w.user_id)
  ), per_worker as (
    select user_id, min(district) as district, min(w_lat) as lat, min(w_lng) as lng,
           count(*)::int as shifts, min(hourly_wage) as wage_min, max(hourly_wage) as wage_max,
           to_jsonb(array_agg(distinct category order by category)) as categories
    from nearby
    group by user_id
  )
  insert into public.notifications (user_id, kind, data)
  select p.user_id, 'nearby_digest', jsonb_build_object(
           'count', p.shifts, 'area_code', p.district, 'categories', p.categories,
           'wage_min', p.wage_min, 'wage_max', p.wage_max, 'lat', p.lat, 'lng', p.lng)
  from per_worker p
  where not exists (select 1 from public.notifications n
                    where n.user_id = p.user_id and n.kind = 'nearby_digest'
                      and n.created_at > now() - interval '20 hours');
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

-- An invite-only job takes applications from invited workers only; taking it
-- answers the offer.
create or replace function public.apply_to_shift(p_shift uuid)
returns public.applications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.require_uid();
  v_shift public.shifts;
  v_app public.applications;
begin
  -- Until this transaction ends, the same worker's next request waits here,
  -- and then sees this one's application in the checks below.
  perform pg_advisory_xact_lock(hashtextextended('ish.apply:' || v_uid::text, 0));

  if not exists (
    select 1 from public.worker_profiles where user_id = v_uid and onboarded_at is not null
  ) then
    raise exception 'PROFILE_INCOMPLETE';
  end if;

  select * into v_shift from public.shifts where id = p_shift for update;
  if not found or v_shift.status <> 'open' or not exists (
    select 1 from public.businesses b where b.id = v_shift.business_id and b.status = 'verified'
  ) or (v_shift.invite_only and not exists (
    select 1 from public.job_offers o where o.shift_id = p_shift and o.worker_id = v_uid
  )) then
    raise exception 'SHIFT_CLOSED';
  end if;
  if v_shift.starts_at <= now() then
    raise exception 'SHIFT_STARTED';
  end if;
  if exists (
    select 1 from public.business_members m
    where m.business_id = v_shift.business_id and m.user_id = v_uid
  ) then
    raise exception 'OWN_SHIFT';
  end if;
  if exists (
    select 1 from public.applications
    where shift_id = p_shift and worker_id = v_uid and status not in ('cancelled', 'rejected')
  ) then
    raise exception 'ALREADY_APPLIED';
  end if;
  if exists (
    select 1
    from public.applications a
    join public.shifts s on s.id = a.shift_id
    where a.worker_id = v_uid
      and a.status in ('pending', 'confirmed', 'checked_in')
      and tstzrange(s.starts_at, s.ends_at) && tstzrange(v_shift.starts_at, v_shift.ends_at)
  ) then
    raise exception 'TIME_CONFLICT';
  end if;
  if public.confirmed_count(p_shift) >= v_shift.slots then
    raise exception 'SHIFT_FULL';
  end if;

  insert into public.applications (shift_id, worker_id, status, decided_at)
  values (
    p_shift, v_uid,
    case when v_shift.auto_confirm then 'confirmed' else 'pending' end::public.application_status,
    case when v_shift.auto_confirm then now() end
  )
  returning * into v_app;

  update public.job_offers set status = 'applied', responded_at = now()
  where shift_id = p_shift and worker_id = v_uid;

  perform public.notify_business(p_shift, 'new_applicant',
    jsonb_build_object('application_id', v_app.id, 'worker_id', v_uid,
                       'auto_confirmed', v_shift.auto_confirm));
  if v_shift.auto_confirm then
    perform public.release_waiting_if_full(p_shift);
  end if;
  return v_app;
end
$$;

-- «Qiziqmayman».
create function public.decline_job_offer(p_shift uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.require_uid();
begin
  update public.job_offers set status = 'declined', responded_at = now()
  where shift_id = p_shift and worker_id = v_uid and status = 'sent';
  if not found then
    raise exception 'NOT_FOUND';
  end if;
end
$$;
revoke execute on function public.decline_job_offer(uuid) from public, anon;
grant execute on function public.decline_job_offer(uuid) to authenticated;

-- The hourly job: a shift the staff keep waits for them to mark who came.
create or replace function public.close_finished_shifts()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  with gone as (
    update public.applications a
    set status = 'no_show'
    from public.shifts s
    join public.businesses b on b.id = s.business_id
    where s.id = a.shift_id and a.status = 'confirmed' and s.ends_at <= now() and not b.managed_by_staff
    returning a.id, a.worker_id, a.shift_id
  ), penalised as (
    update public.worker_profiles w
    set reliability = greatest(0, w.reliability - 20 * g.n)
    from (select worker_id, count(*) as n from gone group by worker_id) g
    where w.user_id = g.worker_id
    returning 1
  ), told as (
    insert into public.notifications (user_id, kind, data)
    select m.user_id, 'no_show', jsonb_build_object('application_id', g.id, 'shift_id', g.shift_id,
                                                    'worker_id', g.worker_id)
    from gone g
    join public.shifts s on s.id = g.shift_id
    join public.business_members m on m.business_id = s.business_id
    returning 1
  )
  select count(*)::int into v_count from gone;
  with expired as (
    update public.applications a
    set status = 'rejected', decided_at = now()
    from public.shifts s
    where s.id = a.shift_id and a.status = 'pending' and s.starts_at <= now()
    returning a.id, a.worker_id, a.shift_id
  )
  insert into public.notifications (user_id, kind, data)
  select worker_id, 'application_rejected',
         jsonb_build_object('application_id', id, 'shift_id', shift_id, 'reason', 'expired')
  from expired;
  return v_count;
end
$$;

-- ---------------------------------------------------------------------------
-- What the staff do on hanguk.uz
-- ---------------------------------------------------------------------------

-- An employer outside the app: new (p_business null) or one the staff keep.
-- p_contact: {contact_name, phone, telegram, source, notes}.
create function public.staff_save_business(
  p_business uuid, p_name text, p_category text default 'other',
  p_area text default '', p_address text default '', p_address_detail text default '',
  p_district text default null, p_lat double precision default null, p_lng double precision default null,
  p_name_i18n jsonb default '{}'::jsonb, p_contact jsonb default '{}'::jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.require_staff();
  v_id uuid;
begin
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'INVALID';
  end if;
  if p_business is null then
    insert into public.businesses (owner_id, name, name_i18n, status, managed_by_staff, category,
                                   area, address, address_detail, district, lat, lng)
    values (v_uid, btrim(p_name), coalesce(p_name_i18n, '{}'::jsonb), 'verified', true, p_category,
            coalesce(p_area, ''), coalesce(p_address, ''), coalesce(p_address_detail, ''), p_district, p_lat, p_lng)
    returning id into v_id;
  else
    update public.businesses
    set name = btrim(p_name), name_i18n = coalesce(p_name_i18n, '{}'::jsonb), category = p_category,
        area = coalesce(p_area, ''), address = coalesce(p_address, ''),
        address_detail = coalesce(p_address_detail, ''), district = p_district, lat = p_lat, lng = p_lng
    where id = p_business and managed_by_staff
    returning id into v_id;
    if v_id is null then
      raise exception 'NOT_FOUND';
    end if;
  end if;
  insert into public.business_contacts (business_id, contact_name, phone, telegram, source, notes,
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

create function public.staff_businesses()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_staff();
  return coalesce((
    select jsonb_agg(public.business_card(b.id) || jsonb_build_object(
             'category', b.category, 'area', b.area, 'address', b.address,
             'address_detail', b.address_detail, 'district', b.district, 'lat', b.lat, 'lng', b.lng,
             'name_i18n', b.name_i18n,
             'contact', jsonb_build_object('contact_name', c.contact_name, 'phone', c.phone,
                                           'telegram', c.telegram, 'source', c.source, 'notes', c.notes),
             'open_shifts', (select count(*) from public.shifts s
                             where s.business_id = b.id and s.status = 'open' and s.ends_at > now()),
             'shifts', (select count(*) from public.shifts s where s.business_id = b.id))
           order by b.created_at desc, b.id)
    from public.businesses b
    left join public.business_contacts c on c.business_id = b.id
    where b.managed_by_staff
  ), '[]'::jsonb);
end
$$;

-- A job of an employer the staff keep: new (p_shift null) or a change, with
-- the 사장님 app's rules (no start in the past, no moving a crewed shift, not
-- fewer places than confirmed) and its releases.
create function public.staff_save_shift(
  p_shift uuid, p_business uuid, p_title text, p_starts_at timestamptz, p_ends_at timestamptz,
  p_hourly_wage int, p_slots int,
  p_duties text default '', p_dress text default '', p_address text default '',
  p_lat double precision default null, p_lng double precision default null,
  p_auto_confirm boolean default false, p_invite_only boolean default true,
  p_source text default '', p_notes text default '')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.require_staff();
  v_id uuid;
begin
  if not exists (select 1 from public.businesses where id = p_business and managed_by_staff) then
    raise exception 'NOT_FOUND';
  end if;
  if p_ends_at <= p_starts_at then
    raise exception 'INVALID_TIME';
  end if;
  if p_ends_at - p_starts_at > interval '16 hours' then
    raise exception 'TOO_LONG';
  end if;
  perform set_config('ish.staff_edit', 'on', true);
  if p_shift is null then
    insert into public.shifts (business_id, title, duties, dress, address, lat, lng, starts_at, ends_at,
                               hourly_wage, slots, auto_confirm, invite_only, created_by)
    values (p_business, btrim(p_title), coalesce(p_duties, ''), coalesce(p_dress, ''), coalesce(p_address, ''),
            p_lat, p_lng, p_starts_at, p_ends_at, p_hourly_wage, p_slots, p_auto_confirm, p_invite_only, v_uid)
    returning id into v_id;
  else
    update public.shifts
    set title = btrim(p_title), duties = coalesce(p_duties, ''), dress = coalesce(p_dress, ''),
        address = coalesce(p_address, ''), lat = p_lat, lng = p_lng, starts_at = p_starts_at,
        ends_at = p_ends_at, hourly_wage = p_hourly_wage, slots = p_slots, auto_confirm = p_auto_confirm,
        invite_only = p_invite_only
    where id = p_shift and business_id = p_business
    returning id into v_id;
    if v_id is null then
      raise exception 'NOT_FOUND';
    end if;
  end if;
  perform set_config('ish.staff_edit', '', true);
  insert into public.shift_notes (shift_id, source, notes, updated_at, updated_by)
  values (v_id, coalesce(p_source, ''), coalesce(p_notes, ''), now(), v_uid)
  on conflict (shift_id) do update
  set source = excluded.source, notes = excluded.notes, updated_at = now(), updated_by = v_uid;
  return v_id;
end
$$;

-- A worker as the staff see them.
create function public.staff_worker_card(p_worker uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', p.id, 'first_name', p.first_name, 'last_name', p.last_name, 'phone', p.phone,
    'avatar_path', p.avatar_path, 'language', p.language,
    'languages', w.languages, 'topik', w.topik, 'university', w.university, 'district', w.district,
    'visa', w.visa, 'reliability', w.reliability, 'onboarded', w.onboarded_at is not null,
    'completed', (select count(*) from public.applications a
                  where a.worker_id = p.id and a.status = 'completed'),
    'no_shows', (select count(*) from public.applications a
                 where a.worker_id = p.id and a.status = 'no_show'))
  from public.profiles p
  left join public.worker_profiles w on w.user_id = p.id
  where p.id = p_worker
$$;
revoke execute on function public.staff_worker_card(uuid) from public, anon, authenticated;

-- The jobs the staff follow between two moments: those of the employers they
-- keep, and any other they sent offers for.
create function public.staff_board(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_staff();
  return coalesce((
    select jsonb_agg(public.shift_card(s.id) || jsonb_build_object(
             'invite_only', s.invite_only,
             'managed', b.managed_by_staff,
             'offers', (select jsonb_build_object(
                          'sent', count(*) filter (where o.status = 'sent'),
                          'declined', count(*) filter (where o.status = 'declined'),
                          'applied', count(*) filter (where o.status = 'applied'))
                        from public.job_offers o where o.shift_id = s.id),
             'applications', (select jsonb_build_object(
                                'pending', count(*) filter (where a.status = 'pending'),
                                'confirmed', count(*) filter (where a.status in ('confirmed', 'checked_in')),
                                'completed', count(*) filter (where a.status = 'completed'),
                                'no_show', count(*) filter (where a.status = 'no_show'),
                                'paid', count(*) filter (where a.paid_at is not null))
                              from public.applications a where a.shift_id = s.id),
             -- Finished, someone still to be marked (came or not).
             'attendance_due', s.ends_at <= now() and exists (
               select 1 from public.applications a
               where a.shift_id = s.id and a.status in ('confirmed', 'checked_in')))
           order by s.starts_at, s.id)
    from public.shifts s
    join public.businesses b on b.id = s.business_id
    where s.starts_at >= p_from and s.starts_at < p_to
      and (b.managed_by_staff or exists (select 1 from public.job_offers o where o.shift_id = s.id))
  ), '[]'::jsonb);
end
$$;

-- One job: its employer and what only the staff see, the offers and the
-- applications with the workers.
create function public.staff_shift(p_shift uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_staff();
  if not exists (select 1 from public.shifts where id = p_shift) then
    raise exception 'NOT_FOUND';
  end if;
  return (
    select public.shift_card(s.id) || jsonb_build_object(
      'invite_only', s.invite_only,
      'managed', b.managed_by_staff,
      'business_id', b.id,
      'contact', (select jsonb_build_object('contact_name', c.contact_name, 'phone', c.phone,
                                            'telegram', c.telegram, 'source', c.source, 'notes', c.notes)
                  from public.business_contacts c where c.business_id = b.id),
      'notes', (select jsonb_build_object('source', n.source, 'notes', n.notes)
                from public.shift_notes n where n.shift_id = s.id),
      'offers', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', o.id, 'status', o.status, 'note', o.note, 'created_at', o.created_at,
                 'responded_at', o.responded_at, 'worker', public.staff_worker_card(o.worker_id))
               order by o.created_at, o.id)
        from public.job_offers o where o.shift_id = s.id), '[]'::jsonb),
      'applications', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', a.id, 'status', a.status, 'created_at', a.created_at, 'decided_at', a.decided_at,
                 'check_in_at', a.check_in_at, 'check_out_at', a.check_out_at,
                 'worked_minutes', a.worked_minutes, 'pay_amount', a.pay_amount, 'paid_at', a.paid_at,
                 'worker', public.staff_worker_card(a.worker_id))
               order by a.created_at, a.id)
        from public.applications a where a.shift_id = s.id), '[]'::jsonb))
    from public.shifts s join public.businesses b on b.id = s.business_id
    where s.id = p_shift
  );
end
$$;

-- Who fits a job, best first: free at that time (no other shift then, the
-- hour in their A02 schedule), near it, reliable. A worker already busy at
-- that time comes last, marked.
create function public.staff_candidates(
  p_shift uuid, p_max_km double precision default 10, p_limit int default 100)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_shift public.shifts;
  v_lat double precision;
  v_lng double precision;
  v_bit int;
begin
  perform public.require_staff();
  select s.* into v_shift from public.shifts s where s.id = p_shift;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  select coalesce(v_shift.lat, b.lat), coalesce(v_shift.lng, b.lng) into v_lat, v_lng
  from public.businesses b where b.id = v_shift.business_id;
  v_bit := public.availability_bit(v_shift.starts_at);
  -- Free and willing first (not on another job at that time, the hour in
  -- their «Qachon ishlay olaman»), then the nearest, then the most reliable.
  return coalesce((
    with busy as (
      -- On another shift at the same time (shifts are 16 hours at most).
      select distinct a.worker_id
      from public.shifts s
      join public.applications a on a.shift_id = s.id
      where s.status = 'open' and s.id <> v_shift.id
        and s.starts_at > v_shift.starts_at - interval '16 hours'
        and s.starts_at < v_shift.ends_at and s.ends_at > v_shift.starts_at
        and a.status in ('pending', 'confirmed', 'checked_in')
    ), c as (
      select w.user_id, w.reliability, k.km,
             (w.availability = 0 or (w.availability >> v_bit) & 1 = 1) as available,
             w.user_id in (select worker_id from busy) as busy
      from public.worker_profiles w
      cross join lateral (select public.distance_km(w.lat, w.lng, v_lat, v_lng) as km) k
      where w.onboarded_at is not null
        and not exists (select 1 from public.business_members m
                        where m.business_id = v_shift.business_id and m.user_id = w.user_id)
        and (p_max_km is null or k.km is null or k.km <= p_max_km)
      order by 5, 4 desc, 3 nulls last, 2 desc, 1
      limit greatest(1, least(coalesce(p_limit, 100), 500))
    )
    select jsonb_agg(public.staff_worker_card(c.user_id) || jsonb_build_object(
             'distance_km', round(c.km::numeric, 1),
             'available', c.available,
             'busy', c.busy,
             'offer_status', (select o.status from public.job_offers o
                              where o.shift_id = v_shift.id and o.worker_id = c.user_id),
             'application_status', (select a.status::text from public.applications a
                                    where a.shift_id = v_shift.id and a.worker_id = c.user_id
                                    order by a.created_at desc limit 1))
           order by c.busy, c.available desc, c.km nulls last, c.reliability desc, c.user_id)
    from c
  ), '[]'::jsonb);
end
$$;

-- «Taklif yuborish»: an offer to each worker, once per job, and a
-- notification. The job must still be open to applications; a worker who has
-- already applied to it gets none.
create function public.staff_send_offers(p_shift uuid, p_workers uuid[], p_note text default '')
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.require_staff();
  v_shift public.shifts;
  v_count int;
begin
  select * into v_shift from public.shifts where id = p_shift;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if v_shift.status <> 'open' or v_shift.starts_at <= now() then
    raise exception 'SHIFT_CLOSED';
  end if;
  if char_length(coalesce(btrim(p_note), '')) > 300 then
    raise exception 'INVALID';
  end if;
  with sent as (
    insert into public.job_offers (shift_id, worker_id, sent_by, note)
    select p_shift, w.user_id, v_uid, coalesce(btrim(p_note), '')
    from public.worker_profiles w
    where w.user_id = any (p_workers) and w.onboarded_at is not null
      and not exists (select 1 from public.business_members m
                      where m.business_id = v_shift.business_id and m.user_id = w.user_id)
      and not exists (select 1 from public.applications a
                      where a.shift_id = p_shift and a.worker_id = w.user_id
                        and a.status not in ('cancelled', 'rejected'))
    on conflict (shift_id, worker_id) do nothing
    returning id, worker_id
  )
  insert into public.notifications (user_id, kind, data)
  select worker_id, 'job_offer', jsonb_strip_nulls(jsonb_build_object(
           'offer_id', id, 'shift_id', p_shift, 'business_id', v_shift.business_id,
           'note', nullif(coalesce(btrim(p_note), ''), '')))
  from sent;
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

-- Who came, on a job the staff keep: worked (minutes; the planned time when
-- not given) or did not come. As check-out and the hourly job would record.
create function public.staff_mark_attendance(
  p_application uuid, p_came boolean, p_worked_minutes int default null)
returns public.applications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.require_staff();
  v_app public.applications;
  v_shift public.shifts;
  v_planned int;
  v_worked int;
begin
  select a.* into v_app from public.applications a where a.id = p_application for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  select s.* into v_shift from public.shifts s
  join public.businesses b on b.id = s.business_id
  where s.id = v_app.shift_id and b.managed_by_staff
  for update of s;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if v_app.status not in ('confirmed', 'checked_in') then
    raise exception 'NOT_CONFIRMED';
  end if;
  if v_shift.starts_at > now() then
    raise exception 'TOO_EARLY';
  end if;
  if p_came then
    v_planned := (extract(epoch from v_shift.ends_at - v_shift.starts_at) / 60)::int;
    v_worked := least(greatest(coalesce(p_worked_minutes, v_planned), 0), v_planned);
    update public.applications
    set status = 'completed',
        check_in_at = coalesce(check_in_at, v_shift.starts_at),
        late_minutes = coalesce(late_minutes, 0),
        check_out_at = least(now(), v_shift.ends_at),
        worked_minutes = v_worked,
        pay_amount = (v_shift.hourly_wage::bigint * v_worked / 60)::int
    where id = p_application
    returning * into v_app;
    update public.worker_profiles set reliability = least(100, reliability + 1) where user_id = v_app.worker_id;
  else
    if v_app.status = 'checked_in' then
      raise exception 'ALREADY_CHECKED_IN';
    end if;
    update public.applications set status = 'no_show' where id = p_application returning * into v_app;
    update public.worker_profiles set reliability = greatest(0, reliability - 20) where user_id = v_app.worker_id;
  end if;
  return v_app;
end
$$;

revoke execute on function public.staff_save_business(uuid, text, text, text, text, text, text,
  double precision, double precision, jsonb, jsonb) from public, anon;
revoke execute on function public.staff_businesses() from public, anon;
revoke execute on function public.staff_save_shift(uuid, uuid, text, timestamptz, timestamptz, int, int,
  text, text, text, double precision, double precision, boolean, boolean, text, text) from public, anon;
revoke execute on function public.staff_board(timestamptz, timestamptz) from public, anon;
revoke execute on function public.staff_shift(uuid) from public, anon;
revoke execute on function public.staff_candidates(uuid, double precision, int) from public, anon;
revoke execute on function public.staff_send_offers(uuid, uuid[], text) from public, anon;
revoke execute on function public.staff_mark_attendance(uuid, boolean, int) from public, anon;
grant execute on function public.staff_save_business(uuid, text, text, text, text, text, text,
  double precision, double precision, jsonb, jsonb) to authenticated;
grant execute on function public.staff_businesses() to authenticated;
grant execute on function public.staff_save_shift(uuid, uuid, text, timestamptz, timestamptz, int, int,
  text, text, text, double precision, double precision, boolean, boolean, text, text) to authenticated;
grant execute on function public.staff_board(timestamptz, timestamptz) to authenticated;
grant execute on function public.staff_shift(uuid) to authenticated;
grant execute on function public.staff_candidates(uuid, double precision, int) to authenticated;
grant execute on function public.staff_send_offers(uuid, uuid[], text) to authenticated;
grant execute on function public.staff_mark_attendance(uuid, boolean, int) to authenticated;
