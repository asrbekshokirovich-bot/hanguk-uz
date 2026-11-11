-- Scale data for tests/perf.sh: a city's worth of businesses, workers, shifts
-- (fixed random seed: the same data every run).
\set ON_ERROR_STOP 1
select setseed(0.42);
alter table ish.shifts disable trigger shifts_notify_matches;
alter table ish.applications disable trigger applications_limit;

-- 20 000 workers, 500 owners.
insert into auth.users (id, phone)
select ('00000000-0000-0000-0001-' || lpad(to_hex(i), 12, '0'))::uuid, '+8210' || lpad(i::text, 8, '0')
from generate_series(1, 20000) i;
insert into auth.users (id, phone)
select ('00000000-0000-0000-0002-' || lpad(to_hex(i), 12, '0'))::uuid, '+8211' || lpad(i::text, 8, '0')
from generate_series(1, 500) i;

update ish.profiles set first_name = 'W' || right(id::text, 5), last_name = 'Test'
where id::text like '00000000-0000-0000-0001-%';

insert into ish.worker_profiles (user_id, languages, topik, district, lat, lng, availability, onboarded_at)
select ('00000000-0000-0000-0001-' || lpad(to_hex(i), 12, '0'))::uuid, '{uz,ko}', (i % 7)::smallint, 'Mapo-gu',
       37.45 + random() * 0.2, 126.85 + random() * 0.3, 268435455, now() - interval '30 days'
from generate_series(1, 20000) i;

insert into ish.businesses (id, owner_id, name, biz_no, nts_status, status, category, address, district, lat, lng)
select ('10000000-0000-0000-0001-' || lpad(to_hex(i), 12, '0'))::uuid,
       ('00000000-0000-0000-0002-' || lpad(to_hex(i), 12, '0'))::uuid,
       '가게 ' || i, lpad((5000000000 + i)::text, 10, '0'), '01', 'verified',
       (array['cafe', 'restaurant', 'retail', 'logistics', 'event', 'office', 'other'])[1 + i % 7],
       '서울 ' || i, 'Mapo-gu', 37.45 + random() * 0.2, 126.85 + random() * 0.3
from generate_series(1, 500) i;
insert into ish.business_members (business_id, user_id, role)
select ('10000000-0000-0000-0001-' || lpad(to_hex(i), 12, '0'))::uuid,
       ('00000000-0000-0000-0002-' || lpad(to_hex(i), 12, '0'))::uuid, 'owner'
from generate_series(1, 500) i;

-- 40 000 shifts: from 60 days ago to 14 days ahead, on the hour.
insert into ish.shifts (id, business_id, title, starts_at, ends_at, hourly_wage, slots, auto_confirm, status)
select ('20000000-0000-0000-0001-' || lpad(to_hex(i), 12, '0'))::uuid,
       ('10000000-0000-0000-0001-' || lpad(to_hex(1 + i % 500), 12, '0'))::uuid,
       '근무 ' || i, t, t + interval '4 hours', 11000, (1 + i % 4)::smallint, i % 2 = 0,
       'open'::ish.shift_status
from (select i, date_trunc('hour', now() - interval '60 days' + (random() * interval '74 days')) as t
      from generate_series(1, 40000) i) x;

-- 120 000 applications: finished for the past, waiting/confirmed ahead.
insert into ish.applications (shift_id, worker_id, status, decided_at, check_in_at, check_out_at, worked_minutes, pay_amount, created_at)
select s.id, w.id,
       case when s.ends_at < now() then 'completed' when random() < 0.5 then 'confirmed' else 'pending' end::ish.application_status,
       s.starts_at - interval '1 day',
       case when s.ends_at < now() then s.starts_at end,
       case when s.ends_at < now() then s.ends_at end,
       case when s.ends_at < now() then 240 end,
       case when s.ends_at < now() then 44000 end,
       s.starts_at - interval '2 days'
from (select distinct on (shift_n, worker_n) shift_n, worker_n
      from (select 1 + (random() * 39999)::int as shift_n, 1 + (random() * 19999)::int as worker_n
            from generate_series(1, 125000)) r) p
join ish.shifts s on s.id = ('20000000-0000-0000-0001-' || lpad(to_hex(p.shift_n), 12, '0'))::uuid
cross join lateral (select ('00000000-0000-0000-0001-' || lpad(to_hex(p.worker_n), 12, '0'))::uuid as id) w
limit 120000;

-- 400 000 notifications.
insert into ish.notifications (user_id, kind, data, created_at)
select ('00000000-0000-0000-0001-' || lpad(to_hex(1 + (random() * 19999)::int), 12, '0'))::uuid,
       'new_shift_match',
       jsonb_build_object('shift_id', ('20000000-0000-0000-0001-' || lpad(to_hex(1 + (random() * 39999)::int), 12, '0')), 'distance_km', 1.2),
       now() - random() * interval '90 days'
from generate_series(1, 400000);

alter table ish.shifts enable trigger shifts_notify_matches;
alter table ish.applications enable trigger applications_limit;
analyze;
select (select count(*) from ish.shifts) shifts, (select count(*) from ish.applications) apps,
       (select count(*) from ish.notifications) notes, (select count(*) from ish.worker_profiles) workers;
