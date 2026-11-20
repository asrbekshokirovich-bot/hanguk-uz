-- Hanguk Ish — the worker's Profil in the «10 qadam» design (2026-11-20).
--
-- «Qachon ishlay olaman» has three parts of the day: Ertalab 08–13, Kunduzi
-- 13–18, Kechqurun 18–23 (bits day*4 + 0..2; bit 3 is no longer used — a job
-- before 08:00 counts as the morning). The edit page adds the home address
-- and how far the worker will go (1, 3, 5 or 10 km). «Ishonch bali» shows
-- how many jobs they went to, how often on time, the employers' stars and
-- the no-shows (`my_trust`).

-- The part of the day a job starts in, as the worker's grid has it.
create or replace function ish.availability_bit(p_at timestamptz)
returns int
language sql
immutable
as $$
  select ((extract(isodow from p_at at time zone 'Asia/Seoul')::int - 1) * 4
         + case
             when extract(hour from p_at at time zone 'Asia/Seoul') >= 18 then 2
             when extract(hour from p_at at time zone 'Asia/Seoul') >= 13 then 1
             else 0
           end)
$$;

alter table ish.worker_profiles
  add column home_address text check (char_length(home_address) <= 200),
  add column max_km smallint not null default 5 check (max_km in (1, 3, 5, 10));

-- «Profilni o'zgartirish»: the home address and how far the worker goes.
create function ish.save_worker_place(p_home_address text, p_max_km int)
returns void
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_uid uuid := ish.require_uid();
begin
  if p_max_km is null or p_max_km not in (1, 3, 5, 10)
     or char_length(coalesce(p_home_address, '')) > 200 then
    raise exception 'INVALID';
  end if;
  update ish.worker_profiles
  set home_address = nullif(btrim(p_home_address), ''), max_km = p_max_km
  where user_id = v_uid;
  if not found then
    raise exception 'PROFILE_INCOMPLETE';
  end if;
end
$$;

-- The profile now also carries the home address and the distance.
create or replace function ish.my_profile()
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
        'home_address', w.home_address,
        'max_km', w.max_km,
        'onboarded_at', w.onboarded_at) end,
      'businesses', (select count(*)::int from ish.business_members m where m.user_id = p.id)
    )
    from ish.profiles p
    left join ish.worker_profiles w on w.user_id = p.id
    where p.id = v_uid
  );
end
$$;

-- «Ishonch bali»: the score and what it is made of. [went]: shifts finished
-- plus opened jobs the worker marked «Ishga chiqdim»; [on_time]: the share
-- of checked-in shifts with no lateness (null before the first one).
create function ish.my_trust()
returns jsonb
language sql
stable
security definer
set search_path = ish
as $$
  select jsonb_build_object(
    'reliability', w.reliability,
    'went', (select count(*)::int from ish.applications a
             where a.worker_id = w.user_id
               and (a.status = 'completed' or (a.coins_paid > 0 and a.worker_step = 2
                                               and a.status not in ('cancelled', 'rejected', 'no_show')))),
    'on_time', (select case when count(*) = 0 then null
                            else round(100.0 * count(*) filter (where coalesce(a.late_minutes, 0) = 0) / count(*))::int end
                from ish.applications a
                where a.worker_id = w.user_id and a.check_in_at is not null),
    'rating', (select round(avg(r.stars)::numeric, 1) from ish.ratings r
               join ish.applications a on a.id = r.application_id
               where a.worker_id = w.user_id and r.direction = 'business_to_worker'),
    'ratings', (select count(*)::int from ish.ratings r
                join ish.applications a on a.id = r.application_id
                where a.worker_id = w.user_id and r.direction = 'business_to_worker'),
    'no_shows', (select count(*)::int from ish.applications a
                 where a.worker_id = w.user_id and a.status = 'no_show'))
  from ish.worker_profiles w
  where w.user_id = auth.uid()
$$;

revoke execute on function ish.save_worker_place(text, int) from public, anon;
revoke execute on function ish.my_trust() from public, anon;
grant execute on function ish.save_worker_place(text, int) to authenticated;
grant execute on function ish.my_trust() to authenticated;
