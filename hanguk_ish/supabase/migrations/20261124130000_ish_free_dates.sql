-- Hanguk Ish: «my free dates». The worker posts the days they can work and
-- where; the staff search jobs for those days at night and send offers
-- (the job alert); the worker pays pyols to unlock (unlock_offer).

create table ish.worker_free_dates (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references ish.profiles (id) on delete cascade,
  day date not null,
  part text not null default 'any' check (part in ('day', 'night', 'any')),
  district text not null check (char_length(btrim(district)) between 1 and 60),
  note text not null default '' check (char_length(note) <= 200),
  created_at timestamptz not null default now(),
  unique (worker_id, day)
);
create index worker_free_dates_day_idx on ish.worker_free_dates (day, district);
alter table ish.worker_free_dates enable row level security;
create policy worker_free_dates_read on ish.worker_free_dates
  for select to authenticated using (worker_id = auth.uid() or ish.is_staff());
revoke all on ish.worker_free_dates from public, anon, authenticated;
grant select on ish.worker_free_dates to authenticated;

-- The worker's coming free dates.
create or replace function ish.my_free_dates()
returns jsonb
language sql
stable
security definer
set search_path = ish
as $$
  select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'part', d.part, 'district', d.district,
                                               'note', d.note) order by d.day), '[]'::jsonb)
  from ish.worker_free_dates d
  where d.worker_id = auth.uid() and d.day >= (now() at time zone 'Asia/Seoul')::date
$$;
revoke execute on function ish.my_free_dates() from public, anon;
grant execute on function ish.my_free_dates() to authenticated;

-- Replaces the worker's coming free dates with p_days:
-- [{"day": "2026-11-27", "part": "day"|"night"|"any", "district": "Ansan", "note": ""}, …]
-- Up to 31 days ahead, at most 31 entries.
create or replace function ish.set_free_dates(p_days jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_uid uuid := ish.require_uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  r jsonb;
  v_day date;
begin
  if not exists (select 1 from ish.worker_profiles where user_id = v_uid and onboarded_at is not null) then
    raise exception 'PROFILE_INCOMPLETE';
  end if;
  if jsonb_typeof(coalesce(p_days, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_days, '[]'::jsonb)) > 31 then
    raise exception 'INVALID';
  end if;
  delete from ish.worker_free_dates where worker_id = v_uid and day >= v_today;
  for r in select * from jsonb_array_elements(coalesce(p_days, '[]'::jsonb)) loop
    begin
      v_day := (r ->> 'day')::date;
    exception when others then
      raise exception 'INVALID';
    end;
    if v_day < v_today or v_day > v_today + 31 then
      raise exception 'INVALID';
    end if;
    if coalesce(btrim(r ->> 'district'), '') = '' then
      raise exception 'DISTRICT_REQUIRED';
    end if;
    insert into ish.worker_free_dates (worker_id, day, part, district, note)
    values (v_uid, v_day, coalesce(nullif(r ->> 'part', ''), 'any'), btrim(r ->> 'district'),
            left(coalesce(r ->> 'note', ''), 200))
    on conflict (worker_id, day) do update
      set part = excluded.part, district = excluded.district, note = excluded.note, created_at = now();
  end loop;
  return ish.my_free_dates();
end
$$;
revoke execute on function ish.set_free_dates(jsonb) from public, anon;
grant execute on function ish.set_free_dates(jsonb) to authenticated;

-- For the nightly search: how many workers are free, by day and place.
create or replace function ish.staff_free_dates_summary(p_days integer default 7)
returns jsonb
language plpgsql
stable
security definer
set search_path = ish
as $$
begin
  perform ish.require_staff();
  return coalesce((
    select jsonb_agg(jsonb_build_object('day', day, 'district', district, 'part', part, 'workers', n)
                     order by day, n desc)
    from (select d.day, d.district, d.part, count(*)::int as n
          from ish.worker_free_dates d
          where d.day between (now() at time zone 'Asia/Seoul')::date
                          and (now() at time zone 'Asia/Seoul')::date + greatest(1, least(coalesce(p_days, 7), 31))
            and not exists (select 1 from ish.applications a join ish.shifts s on s.id = a.shift_id
                            where a.worker_id = d.worker_id and a.status in ('pending', 'confirmed')
                              and (s.starts_at at time zone 'Asia/Seoul')::date = d.day)
          group by 1, 2, 3) x), '[]'::jsonb);
end
$$;
revoke execute on function ish.staff_free_dates_summary(integer) from public, anon;
grant execute on function ish.staff_free_dates_summary(integer) to authenticated;

-- Who is free on a day (to choose whom to send a job to).
create or replace function ish.staff_free_workers(p_day date, p_district text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ish
as $$
begin
  perform ish.require_staff();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'worker_id', d.worker_id, 'first_name', p.first_name, 'last_name', p.last_name, 'phone', p.phone,
      'district', d.district, 'part', d.part, 'note', d.note,
      'languages', w.languages, 'topik', w.topik, 'reliability', w.reliability,
      'coins', coalesce(cw.balance, 0),
      'busy', exists (select 1 from ish.applications a join ish.shifts s on s.id = a.shift_id
                      where a.worker_id = d.worker_id and a.status in ('pending', 'confirmed')
                        and (s.starts_at at time zone 'Asia/Seoul')::date = d.day))
      order by w.reliability desc, d.created_at)
    from ish.worker_free_dates d
    join ish.profiles p on p.id = d.worker_id
    join ish.worker_profiles w on w.user_id = d.worker_id
    left join ish.coin_wallets cw on cw.worker_id = d.worker_id
    where d.day = p_day
      and (p_district is null or d.district ilike '%' || btrim(p_district) || '%')), '[]'::jsonb);
end
$$;
revoke execute on function ish.staff_free_workers(date, text) from public, anon;
grant execute on function ish.staff_free_workers(date, text) to authenticated;
