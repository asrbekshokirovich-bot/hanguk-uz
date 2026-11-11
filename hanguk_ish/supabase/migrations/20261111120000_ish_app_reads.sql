-- Hanguk Ish — what the two apps read in one round trip, as JSON in the
-- shapes their screens use (P7b, 2026-11-11).
--
--   * businesses get what the worker screens show: the neighbourhood (신촌),
--     the floor (2층), translations of both, a logo and a workplace photo;
--   * shift_feed() returns cards (A03 / A04) and shift_details() one card
--     (A05) — the shift, its business with rating, places left, distance and
--     the caller's own application;
--   * my_shifts() / my_shift(): the worker's applications with their shifts
--     (A06–A09);
--   * my_notifications(): notifications with the shift, business, pay and
--     worker names their sentence needs (A12, the bell on BA1);
--   * my_profile() / save_worker_profile(): A02 in one transaction;
--   * my_businesses(): the businesses the caller runs (BA1 store picker);
--   * a chat message notifies the other side (one unread notice per chat);
--   * the «ish-avatars» storage bucket (A02 photo).
-- Every function checks who is calling and raises the same stable codes as
-- the rest ('NOT_FOUND', …).

-- ---------------------------------------------------------------------------
-- Businesses: what the worker screens show
-- ---------------------------------------------------------------------------

alter table ish.businesses
  add column area text not null default '' check (char_length(area) <= 40),
  add column address_detail text not null default '' check (char_length(address_detail) <= 80),
  add column translations jsonb not null default '{}'::jsonb,
  add column logo_path text check (char_length(logo_path) <= 300),
  add column photo_path text check (char_length(photo_path) <= 300);

comment on column ish.businesses.name_i18n is
  'The name as workers read it, per app language: {"uz": "Dalbit Kafe"}. The neighbourhood is separate (area).';
comment on column ish.businesses.area is 'Neighbourhood in Korean, shown after the name: 신촌.';
comment on column ish.businesses.address_detail is 'Floor or unit in Korean: 2층.';
comment on column ish.businesses.translations is
  '{"uz": {"area": "Sinchon", "address": "Mapo-gu, Sinchon-ro 12-gil 15", "address_detail": "2-qavat"}, …} — written by the translate function.';
comment on column ish.businesses.logo_path is 'Logo in the public «businesses» bucket; null = the first syllable of the name.';
comment on column ish.businesses.photo_path is 'Workplace photo (A05 header) in the public «businesses» bucket.';

grant update (area, address_detail, logo_path, photo_path) on ish.businesses to authenticated;

-- A new Korean text makes the old translations wrong: drop them so the
-- translate function writes new ones (the same rule as for shifts).
create function ish.businesses_i18n_reset()
returns trigger
language plpgsql
set search_path = ish
as $$
begin
  if new.name is distinct from old.name and new.name_i18n = old.name_i18n then
    new.name_i18n := '{}'::jsonb;
  end if;
  if (new.area is distinct from old.area or new.address is distinct from old.address
      or new.address_detail is distinct from old.address_detail)
     and new.translations = old.translations then
    new.translations := '{}'::jsonb;
  end if;
  return new;
end
$$;

create trigger businesses_i18n_reset before update on ish.businesses
  for each row execute function ish.businesses_i18n_reset();

-- A11 «Shikoyat qilish» subjects (Ish beruvchi, To'lov, Xavfsizlik, Boshqa);
-- the detailed dispute reasons stay for later screens.
alter table ish.reports drop constraint reports_reason_check;
alter table ish.reports add constraint reports_reason_check check (reason in (
  'employer', 'payment', 'safety', 'other',
  'unpaid', 'not_as_described', 'time_dispute', 'no_show', 'behaviour'
));

-- Posting needs a verified business (국세청 check, T8): say so instead of a
-- bare row-level-security error.
create or replace function ish.shifts_guard()
returns trigger
language plpgsql
set search_path = ish
as $$
declare
  v_taken int;
begin
  if current_user <> 'authenticated' then
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

-- A10: a new chat message tells the other side — the business's members or
-- the worker — with one unread notice per chat, however many messages come.
create function ish.messages_notify()
returns trigger
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_worker uuid;
  v_shift uuid;
  v_business uuid;
begin
  select a.worker_id, s.id, s.business_id into v_worker, v_shift, v_business
  from ish.applications a join ish.shifts s on s.id = a.shift_id
  where a.id = new.application_id;
  insert into ish.notifications (user_id, kind, data)
  select r.user_id, 'chat_message', r.data
  from (
    select m.user_id, jsonb_build_object('application_id', new.application_id, 'shift_id', v_shift,
                                         'worker_id', v_worker) as data
    from ish.business_members m
    where new.sender_id = v_worker and m.business_id = v_business
    union all
    select v_worker, jsonb_build_object('application_id', new.application_id, 'shift_id', v_shift,
                                        'business_id', v_business)
    where new.sender_id is distinct from v_worker
  ) r
  where not exists (
    select 1 from ish.notifications n
    where n.user_id = r.user_id and n.kind = 'chat_message' and n.read_at is null
      and n.data ->> 'application_id' = new.application_id::text);
  return new;
end
$$;

create trigger messages_notify after insert on ish.messages
  for each row execute function ish.messages_notify();

-- ---------------------------------------------------------------------------
-- Building blocks (internal: not callable through the API)
-- ---------------------------------------------------------------------------

-- A business as a line of text needs it: names and places.
create function ish.business_brief(p_business uuid)
returns jsonb
language sql
stable
security definer
set search_path = ish
as $$
  select jsonb_build_object(
    'id', b.id,
    'name', b.name,
    'name_i18n', b.name_i18n,
    'area', b.area,
    'address', b.address,
    'address_detail', b.address_detail,
    'translations', b.translations,
    'category', b.category,
    'verified', b.status = 'verified',
    'lat', b.lat,
    'lng', b.lng,
    'logo_path', b.logo_path,
    'photo_path', b.photo_path
  )
  from ish.businesses b
  where b.id = p_business
$$;

-- … and with the numbers of the A05 rating line (4.8 · 128 smena).
create function ish.business_card(p_business uuid)
returns jsonb
language sql
stable
security definer
set search_path = ish
as $$
  select ish.business_brief(p_business) || jsonb_build_object(
    'rating', (
      select round(avg(r.stars)::numeric, 1)
      from ish.ratings r
      join ish.applications a on a.id = r.application_id
      join ish.shifts s on s.id = a.shift_id
      where s.business_id = p_business and r.direction = 'worker_to_business'),
    'rating_count', (
      select count(*)::int
      from ish.ratings r
      join ish.applications a on a.id = r.application_id
      join ish.shifts s on s.id = a.shift_id
      where s.business_id = p_business and r.direction = 'worker_to_business'),
    'completed_shifts', (
      select count(*)::int
      from ish.applications a join ish.shifts s on s.id = a.shift_id
      where s.business_id = p_business and a.status = 'completed')
  )
$$;

-- A shift as the worker app shows it, from the caller's point of view: their
-- latest application to it and the distance from (p_lat, p_lng).
create function ish.shift_card(p_shift uuid, p_lat double precision default null,
                                  p_lng double precision default null)
returns jsonb
language sql
stable
security definer
set search_path = ish
as $$
  select jsonb_build_object(
    'id', s.id,
    'business', ish.business_card(s.business_id),
    'title', s.title,
    'duties', s.duties,
    'dress', s.dress,
    'address', s.address,
    'translations', s.translations,
    'starts_at', s.starts_at,
    'ends_at', s.ends_at,
    'hourly_wage', s.hourly_wage,
    'slots', s.slots,
    'slots_left', greatest(s.slots - ish.confirmed_count(s.id), 0),
    'auto_confirm', s.auto_confirm,
    'status', s.status,
    'lat', coalesce(s.lat, b.lat),
    'lng', coalesce(s.lng, b.lng),
    'distance_km', round(ish.distance_km(p_lat, p_lng, coalesce(s.lat, b.lat),
                                            coalesce(s.lng, b.lng))::numeric, 3),
    'my_application_id', my.id,
    'my_status', my.status
  )
  from ish.shifts s
  join ish.businesses b on b.id = s.business_id
  left join lateral (
    select a.id, a.status from ish.applications a
    where a.shift_id = s.id and a.worker_id = auth.uid()
    order by a.created_at desc, a.id desc
    limit 1
  ) my on true
  where s.id = p_shift
$$;

-- One application of a worker with its shift and the worker's rating of it.
create function ish.application_card(p_application uuid)
returns jsonb
language sql
stable
security definer
set search_path = ish
as $$
  select jsonb_build_object(
    'application_id', a.id,
    'status', a.status,
    'created_at', a.created_at,
    'decided_at', a.decided_at,
    'cancelled_at', a.cancelled_at,
    'late_cancel', a.late_cancel,
    'check_in_at', a.check_in_at,
    'check_out_at', a.check_out_at,
    'late_minutes', a.late_minutes,
    'worked_minutes', a.worked_minutes,
    'pay_amount', a.pay_amount,
    'paid_at', a.paid_at,
    'my_stars', r.stars,
    'my_tags', coalesce(to_jsonb(r.tags), '[]'::jsonb),
    'shift', ish.shift_card(a.shift_id)
  )
  from ish.applications a
  left join ish.ratings r on r.application_id = a.id and r.direction = 'worker_to_business'
  where a.id = p_application
$$;

-- A notification with what its sentence is built from. [data] keys:
--   shift_id, application_id, worker_id, business_id — filled in below;
--   minutes_before (shift_reminder), distance_km (new_shift_match), reason
--   (application_rejected: full | expired | shift_cancelled), paid
--   (payment_marked), late (worker_cancelled), count / area / area_i18n /
--   categories / wage_min / wage_max / lat / lng (nearby_digest).
create function ish.notification_card(p_notification bigint)
returns jsonb
language sql
stable
security definer
set search_path = ish
as $$
  select jsonb_build_object(
    'id', n.id,
    'kind', n.kind,
    'data', n.data,
    'created_at', n.created_at,
    'read_at', n.read_at,
    'shift', (
      select jsonb_build_object(
        'id', s.id, 'title', s.title, 'translations', s.translations,
        'starts_at', s.starts_at, 'ends_at', s.ends_at, 'hourly_wage', s.hourly_wage,
        'lat', coalesce(s.lat, b.lat), 'lng', coalesce(s.lng, b.lng), 'status', s.status)
      from ish.shifts s join ish.businesses b on b.id = s.business_id
      where s.id = ref.shift_id),
    'business', ish.business_brief(coalesce(ref.business_id,
      (select s.business_id from ish.shifts s where s.id = ref.shift_id))),
    'application', (
      select jsonb_build_object('id', a.id, 'status', a.status, 'pay_amount', a.pay_amount,
                                'worked_minutes', a.worked_minutes)
      from ish.applications a where a.id = ref.application_id),
    'worker', (
      select jsonb_build_object('id', p.id, 'first_name', p.first_name, 'last_name', p.last_name)
      from ish.profiles p where p.id = ref.worker_id)
  )
  from ish.notifications n
  cross join lateral (
    select
      case when n.data ->> 'shift_id' ~ '^[0-9a-f-]{36}$' then (n.data ->> 'shift_id')::uuid end as shift_id,
      case when n.data ->> 'business_id' ~ '^[0-9a-f-]{36}$' then (n.data ->> 'business_id')::uuid end as business_id,
      case when n.data ->> 'application_id' ~ '^[0-9a-f-]{36}$' then (n.data ->> 'application_id')::uuid end as application_id,
      case when n.data ->> 'worker_id' ~ '^[0-9a-f-]{36}$' then (n.data ->> 'worker_id')::uuid end as worker_id
  ) ref
  where n.id = p_notification
$$;

revoke execute on function ish.business_brief(uuid) from public, anon, authenticated;
revoke execute on function ish.business_card(uuid) from public, anon, authenticated;
revoke execute on function ish.shift_card(uuid, double precision, double precision) from public, anon, authenticated;
revoke execute on function ish.application_card(uuid) from public, anon, authenticated;
revoke execute on function ish.notification_card(bigint) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Worker app
-- ---------------------------------------------------------------------------

-- A03 / A04: open shifts of verified businesses starting in [p_from, p_to),
-- nearest first (then the earliest), at most 200 cards.
drop function ish.shift_feed(timestamptz, timestamptz, double precision, double precision,
                                double precision, int, text[]);

create function ish.shift_feed(
  p_from timestamptz, p_to timestamptz,
  p_lat double precision default null, p_lng double precision default null,
  p_max_km double precision default null, p_min_wage int default null,
  p_categories text[] default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ish
as $$
begin
  perform ish.require_uid();
  return coalesce((
    select jsonb_agg(ish.shift_card(f.id, p_lat, p_lng) order by f.distance nulls last, f.starts_at, f.id)
    from (
      select s.id, s.starts_at,
             ish.distance_km(p_lat, p_lng, coalesce(s.lat, b.lat), coalesce(s.lng, b.lng)) as distance
      from ish.shifts s
      join ish.businesses b on b.id = s.business_id
      where s.status = 'open' and b.status = 'verified'
        and s.starts_at > now()
        and s.starts_at >= p_from and s.starts_at < p_to
        and (p_min_wage is null or s.hourly_wage >= p_min_wage)
        and (p_categories is null or b.category = any (p_categories))
        and (p_max_km is null or p_lat is null or p_lng is null or
             ish.distance_km(p_lat, p_lng, coalesce(s.lat, b.lat), coalesce(s.lng, b.lng)) <= p_max_km)
      order by 3 nulls last, s.starts_at, s.id
      limit 200
    ) f
  ), '[]'::jsonb);
end
$$;

-- A05: one shift — open ones of verified businesses, any the caller applied
-- to, and any of the caller's own businesses.
create function ish.shift_details(p_shift uuid, p_lat double precision default null,
                                     p_lng double precision default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ish
as $$
declare
  v_uid uuid := ish.require_uid();
begin
  if not exists (
    select 1
    from ish.shifts s join ish.businesses b on b.id = s.business_id
    where s.id = p_shift and (
      (s.status = 'open' and b.status = 'verified')
      or exists (select 1 from ish.applications a where a.shift_id = s.id and a.worker_id = v_uid)
      or ish.is_business_member(s.business_id))
  ) then
    raise exception 'NOT_FOUND';
  end if;
  return ish.shift_card(p_shift, p_lat, p_lng);
end
$$;

-- A06–A09: every application of the caller, the earliest shift first.
create function ish.my_shifts()
returns jsonb
language plpgsql
stable
security definer
set search_path = ish
as $$
declare
  v_uid uuid := ish.require_uid();
begin
  return coalesce((
    select jsonb_agg(ish.application_card(a.id) order by s.starts_at, a.created_at, a.id)
    from ish.applications a join ish.shifts s on s.id = a.shift_id
    where a.worker_id = v_uid
  ), '[]'::jsonb);
end
$$;

create function ish.my_shift(p_application uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ish
as $$
declare
  v_uid uuid := ish.require_uid();
begin
  if not exists (select 1 from ish.applications where id = p_application and worker_id = v_uid) then
    raise exception 'NOT_FOUND';
  end if;
  return ish.application_card(p_application);
end
$$;

-- A11 / A02: the caller's profile; [worker] is null before A02.
create function ish.my_profile()
returns jsonb
language plpgsql
stable
security definer
set search_path = ish
as $$
declare
  v_uid uuid := ish.require_uid();
begin
  return (
    select jsonb_build_object(
      'id', p.id,
      'first_name', p.first_name,
      'last_name', p.last_name,
      'avatar_path', p.avatar_path,
      'phone', p.phone,
      'telegram_username', p.telegram_username,
      'language', p.language,
      'worker', case when w.user_id is null then null else jsonb_build_object(
        'languages', to_jsonb(w.languages),
        'topik', w.topik,
        'university', w.university,
        'district', w.district,
        'availability', w.availability,
        'visa', w.visa,
        'reliability', w.reliability,
        'onboarded_at', w.onboarded_at) end,
      'businesses', (select count(*)::int from ish.business_members m where m.user_id = p.id)
    )
    from ish.profiles p
    left join ish.worker_profiles w on w.user_id = p.id
    where p.id = v_uid
  );
end
$$;

-- A02 «Saqlash va boshlash»: names, photo and the worker profile together;
-- the first save marks onboarding done (only then can the worker take shifts).
create function ish.save_worker_profile(
  p_first_name text, p_last_name text, p_languages text[], p_topik int,
  p_university text, p_district text, p_availability int, p_visa text,
  p_avatar_path text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_uid uuid := ish.require_uid();
begin
  if coalesce(btrim(p_first_name), '') = '' or coalesce(btrim(p_last_name), '') = '' then
    raise exception 'NAME_REQUIRED';
  end if;
  if coalesce(cardinality(p_languages), 0) = 0 then
    raise exception 'LANGUAGES_REQUIRED';
  end if;
  if coalesce(btrim(p_district), '') = '' then
    raise exception 'DISTRICT_REQUIRED';
  end if;
  if p_avatar_path is not null and p_avatar_path !~ ('^' || v_uid::text || '/[^/]+$') then
    raise exception 'INVALID';
  end if;

  update ish.profiles
  set first_name = btrim(p_first_name),
      last_name = btrim(p_last_name),
      avatar_path = coalesce(p_avatar_path, avatar_path)
  where id = v_uid;

  insert into ish.worker_profiles (user_id, languages, topik, university, district, availability,
                                      visa, onboarded_at)
  values (v_uid, p_languages, coalesce(p_topik, 0), nullif(btrim(p_university), ''), btrim(p_district),
          coalesce(p_availability, 0), p_visa, now())
  on conflict (user_id) do update set
    languages = excluded.languages,
    topik = excluded.topik,
    university = excluded.university,
    district = excluded.district,
    availability = excluded.availability,
    visa = excluded.visa,
    onboarded_at = coalesce(ish.worker_profiles.onboarded_at, excluded.onboarded_at);

  return ish.my_profile();
end
$$;

-- ---------------------------------------------------------------------------
-- Both apps
-- ---------------------------------------------------------------------------

-- A12 / the bell: the caller's notifications, newest first; [p_kinds] keeps
-- one app's kinds when the same person uses both apps.
create function ish.my_notifications(p_limit int default 100, p_kinds text[] default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ish
as $$
declare
  v_uid uuid := ish.require_uid();
begin
  return coalesce((
    select jsonb_agg(ish.notification_card(n.id) order by n.created_at desc, n.id desc)
    from (
      select id, created_at
      from ish.notifications
      where user_id = v_uid and (p_kinds is null or kind = any (p_kinds))
      order by created_at desc, id desc
      limit greatest(1, least(coalesce(p_limit, 100), 500))
    ) n
  ), '[]'::jsonb);
end
$$;

-- Opening A12 / the bell marks what it shows as read. Returns how many.
create function ish.mark_notifications_read(p_kinds text[] default null)
returns int
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_uid uuid := ish.require_uid();
  v_count int;
begin
  update ish.notifications
  set read_at = now()
  where user_id = v_uid and read_at is null and (p_kinds is null or kind = any (p_kinds));
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

-- ---------------------------------------------------------------------------
-- Employer app
-- ---------------------------------------------------------------------------

-- BA1 store picker: the businesses the caller owns or manages, with their
-- 국세청 state (a pending business cannot post yet).
create function ish.my_businesses()
returns jsonb
language plpgsql
stable
security definer
set search_path = ish
as $$
declare
  v_uid uuid := ish.require_uid();
begin
  return coalesce((
    select jsonb_agg(ish.business_card(b.id) || jsonb_build_object(
             'role', m.role, 'status', b.status, 'biz_no', b.biz_no)
           order by m.created_at, b.name, b.id)
    from ish.business_members m
    join ish.businesses b on b.id = m.business_id
    where m.user_id = v_uid
  ), '[]'::jsonb);
end
$$;

revoke execute on function ish.shift_feed(timestamptz, timestamptz, double precision, double precision,
                                            double precision, int, text[]) from public, anon;
revoke execute on function ish.shift_details(uuid, double precision, double precision) from public, anon;
revoke execute on function ish.my_shifts() from public, anon;
revoke execute on function ish.my_shift(uuid) from public, anon;
revoke execute on function ish.my_profile() from public, anon;
revoke execute on function ish.save_worker_profile(text, text, text[], int, text, text, int, text, text)
  from public, anon;
revoke execute on function ish.my_notifications(int, text[]) from public, anon;
revoke execute on function ish.mark_notifications_read(text[]) from public, anon;
revoke execute on function ish.my_businesses() from public, anon;
grant execute on function ish.shift_feed(timestamptz, timestamptz, double precision, double precision,
                                           double precision, int, text[]) to authenticated;
grant execute on function ish.shift_details(uuid, double precision, double precision) to authenticated;
grant execute on function ish.my_shifts() to authenticated;
grant execute on function ish.my_shift(uuid) to authenticated;
grant execute on function ish.my_profile() to authenticated;
grant execute on function ish.save_worker_profile(text, text, text[], int, text, text, int, text, text)
  to authenticated;
grant execute on function ish.my_notifications(int, text[]) to authenticated;
grant execute on function ish.mark_notifications_read(text[]) to authenticated;
grant execute on function ish.my_businesses() to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: profile photos (A02). Public bucket — the path is the user's id
-- and a random name, so a business can show its applicants' photos. Skipped
-- where Supabase Storage is not installed (the plain-PostgreSQL tests).
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass('storage.objects') is not null and to_regclass('storage.buckets') is not null
     and to_regprocedure('storage.foldername(text)') is not null then
    insert into storage.buckets (id, name) values ('ish-avatars', 'ish-avatars') on conflict (id) do nothing;
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'storage' and table_name = 'buckets' and column_name = 'public'
    ) then
      update storage.buckets set public = true where id = 'ish-avatars';
    end if;
    execute $p$create policy ish_avatars_read_own on storage.objects for select to authenticated
      using (bucket_id = 'ish-avatars' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
    execute $p$create policy ish_avatars_insert_own on storage.objects for insert to authenticated
      with check (bucket_id = 'ish-avatars' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
    execute $p$create policy ish_avatars_update_own on storage.objects for update to authenticated
      using (bucket_id = 'ish-avatars' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
    execute $p$create policy ish_avatars_delete_own on storage.objects for delete to authenticated
      using (bucket_id = 'ish-avatars' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
  end if;
end
$$;
