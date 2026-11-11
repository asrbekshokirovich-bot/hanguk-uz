-- A shift that fills up another way than BA3's last confirmation — fewer
-- places on BA2, or 자동 확정 switched on and new applicants confirmed at once —
-- lets its waiting applicants go too, as BA3 does: they are told it is full,
-- instead of waiting until the start (kept meanwhile from any other shift at
-- the same time) and then hearing that nobody answered.
select tests.as_admin();
-- One more onboarded worker (a3 of the fixtures has not finished A02).
insert into auth.users (id, phone) values ('00000000-0000-0000-0000-0000000000a4', '+821000000004');
insert into public.worker_profiles (user_id, languages, topik, district, availability, onboarded_at)
values ('00000000-0000-0000-0000-0000000000a4', '{uz,ko}', 3, 'Mapo-gu', 268435455, now());
create temp table app_of (worker uuid, shift uuid, id uuid);
grant select, insert on app_of to authenticated;

create function pg_temp.apply_as(p_worker uuid, p_shift uuid) returns text
language plpgsql as $$
declare
  v public.applications;
begin
  perform tests.as_user(p_worker);
  v := public.apply_to_shift(p_shift);
  insert into app_of values (p_worker, p_shift, v.id);
  perform tests.as_admin();
  return v.status::text;
end $$;

create function pg_temp.status_of(p_worker uuid, p_shift uuid) returns text
language sql as $$
  select a.status::text from public.applications a join app_of o on o.id = a.id
  where o.worker = p_worker and o.shift = p_shift
$$;

create function pg_temp.told_full(p_worker uuid, p_shift uuid) returns boolean
language sql as $$
  select exists (select 1 from public.notifications
                 where user_id = p_worker and kind = 'application_rejected'
                   and data ->> 'shift_id' = p_shift::text and data ->> 'reason' = 'full')
$$;

-- 1. Fewer places on BA2. s2 (manual) gets two places; a1 and a2 wait; the
--    owner confirms a1; a2 still waits for the second place.
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
update public.shifts set slots = 2 where id = '20000000-0000-0000-0000-000000000002';
select tests.eq(pg_temp.apply_as('00000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-000000000002'),
                'pending', 'a1 waits');
select tests.eq(pg_temp.apply_as('00000000-0000-0000-0000-0000000000a2', '20000000-0000-0000-0000-000000000002'),
                'pending', 'a2 waits');
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
select public.decide_application((select id from app_of where worker = '00000000-0000-0000-0000-0000000000a1'
                                  and shift = '20000000-0000-0000-0000-000000000002'), true);
select tests.as_admin();
select tests.eq(pg_temp.status_of('00000000-0000-0000-0000-0000000000a2', '20000000-0000-0000-0000-000000000002'),
                'pending', 'one place left: a2 still waits');
-- The owner needs only one person now: the shift is full.
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
update public.shifts set slots = 1 where id = '20000000-0000-0000-0000-000000000002';
select tests.as_admin();
select tests.eq(pg_temp.status_of('00000000-0000-0000-0000-0000000000a2', '20000000-0000-0000-0000-000000000002'),
                'rejected', 'fewer places, full: the waiting applicant is let go');
select tests.ok(pg_temp.told_full('00000000-0000-0000-0000-0000000000a2', '20000000-0000-0000-0000-000000000002'),
                'and told the shift is full');
select tests.eq(pg_temp.status_of('00000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-000000000002'),
                'confirmed', 'the confirmed one stays');

-- 2. 자동 확정 switched on. A new shift with two places, manual: a1 waits.
insert into public.shifts (id, business_id, title, starts_at, ends_at, hourly_wage, slots, auto_confirm) values
  ('20000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000001', '주말 행사 보조',
   now() + interval '5 days', now() + interval '5 days 4 hours', 11000, 2, false);
select tests.eq(pg_temp.apply_as('00000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-000000000009'),
                'pending', 'a1 waits on s9');
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
update public.shifts set auto_confirm = true where id = '20000000-0000-0000-0000-000000000009';
select tests.eq(pg_temp.apply_as('00000000-0000-0000-0000-0000000000a2', '20000000-0000-0000-0000-000000000009'),
                'confirmed', 'a2 is confirmed at once');
select tests.eq(pg_temp.status_of('00000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-000000000009'),
                'pending', 'one place left: a1 still waits');
select tests.eq(pg_temp.apply_as('00000000-0000-0000-0000-0000000000a4', '20000000-0000-0000-0000-000000000009'),
                'confirmed', 'a4 takes the last place');
select tests.eq(pg_temp.status_of('00000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-000000000009'),
                'rejected', 'filled at once: the one still waiting is let go');
select tests.ok(pg_temp.told_full('00000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-000000000009'),
                'and told the shift is full');

-- 3. More places, or the same: nobody is let go.
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
update public.shifts set slots = 3, auto_confirm = false where id = '20000000-0000-0000-0000-000000000009';
select tests.eq(pg_temp.apply_as('00000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-000000000009'),
                'pending', 'a third place: a1 may apply again and waits');
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
update public.shifts set title = '주말 행사 보조 (실내)' where id = '20000000-0000-0000-0000-000000000009';
select tests.as_admin();
select tests.eq((select count(*)::int from public.applications
                 where shift_id = '20000000-0000-0000-0000-000000000009' and status = 'pending'),
                1, 'another change to the shift keeps the waiting applicant');
