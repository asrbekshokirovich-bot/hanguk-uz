-- HanPyol: what matters most for a free day (Asrbek / Davrbek, 2026-11-26).
-- When the worker marks a day free, the app also asks the time (day 주간 /
-- night 야간 / either) and what matters most, so the team searches the right
-- kind of job:
--   'pay'  — the most money (night parcel work, 상하차 … pays the most);
--   'easy' — lighter work (sorting, packing, light factory work);
--   'near' — close to home, a short trip;
--   'any'  — no preference.

alter table ish.worker_free_dates add column priority text not null default 'any'
  check (priority in ('any', 'pay', 'easy', 'near'));

create or replace function ish.my_free_dates()
returns jsonb
language sql
stable
security definer
set search_path = ish
as $$
  select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'part', d.part, 'district', d.district,
                                               'note', d.note, 'priority', d.priority) order by d.day), '[]'::jsonb)
  from ish.worker_free_dates d
  where d.worker_id = auth.uid() and d.day >= (now() at time zone 'Asia/Seoul')::date
$$;

-- p_days: [{"day", "part": "day"|"night"|"any", "district", "note", "priority": "any"|"pay"|"easy"|"near"}, …]
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
    if coalesce(nullif(r ->> 'part', ''), 'any') not in ('day', 'night', 'any')
       or coalesce(nullif(r ->> 'priority', ''), 'any') not in ('any', 'pay', 'easy', 'near') then
      raise exception 'INVALID';
    end if;
    insert into ish.worker_free_dates (worker_id, day, part, district, note, priority)
    values (v_uid, v_day, coalesce(nullif(r ->> 'part', ''), 'any'), btrim(r ->> 'district'),
            left(coalesce(r ->> 'note', ''), 200), coalesce(nullif(r ->> 'priority', ''), 'any'))
    on conflict (worker_id, day) do update
      set part = excluded.part, district = excluded.district, note = excluded.note,
          priority = excluded.priority, created_at = now();
  end loop;
  return ish.my_free_dates();
end
$$;

-- The team's list for a day shows it.
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
      'district', d.district, 'part', d.part, 'note', d.note, 'priority', d.priority,
      'languages', w.languages, 'topik', w.topik, 'reliability', w.reliability,
      'coins', coalesce(cw.balance, 0),
      'card', ish.card_of(d.worker_id) ->> 'level',
      'busy', ish.card_closed(d.worker_id)
              or exists (select 1 from ish.applications a join ish.shifts s on s.id = a.shift_id
                         where a.worker_id = d.worker_id and a.status in ('pending', 'confirmed')
                           and (s.starts_at at time zone 'Asia/Seoul')::date = d.day))
      order by ish.card_closed(d.worker_id), w.reliability desc, d.created_at)
    from ish.worker_free_dates d
    join ish.profiles p on p.id = d.worker_id
    join ish.worker_profiles w on w.user_id = d.worker_id
    left join ish.coin_wallets cw on cw.worker_id = d.worker_id
    where d.day = p_day
      and (p_district is null or d.district ilike '%' || btrim(p_district) || '%')), '[]'::jsonb);
end
$$;
