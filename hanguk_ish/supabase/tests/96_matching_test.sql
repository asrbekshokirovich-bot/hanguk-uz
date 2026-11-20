-- New shifts reach the workers near them who are free then; the evening
-- digest of shifts nearby.

-- a1 lives by Sinchon (biz1), free any time; a2 is in Gangnam (≈ 10.3 km: beyond the 10 km).
select tests.as_admin();
update ish.worker_profiles set lat = 37.5560, lng = 126.9370 where user_id = '00000000-0000-0000-0000-0000000000a1';
update ish.worker_profiles set lat = 37.4979, lng = 127.0276 where user_id = '00000000-0000-0000-0000-0000000000a2';
-- (Before they had a position the fixtures' shifts told them by district.)
delete from ish.notifications where kind = 'new_shift_match';

-- The availability bit (Profil grid): Ertalab 08–13 (and earlier) 0, Kunduzi
-- 13–18 1, Kechqurun 18–23 2; Sunday evening is 26.
select tests.eq(ish.availability_bit('2026-11-16 07:00+09'), 0, 'Monday morning');
select tests.eq(ish.availability_bit('2026-11-16 13:00+09'), 1, 'Monday afternoon');
select tests.eq(ish.availability_bit('2026-11-16 23:59+09'), 2, 'Monday evening');
select tests.eq(ish.availability_bit('2026-11-17 01:00+09'), 4, 'Tuesday 01:00 counts as the morning');
select tests.eq(ish.availability_bit('2026-11-22 20:00+09'), 26, 'Sunday evening');

-- The owner posts a shift for tomorrow.
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
insert into ish.shifts (business_id, title, starts_at, ends_at, hourly_wage, slots)
values ('10000000-0000-0000-0000-000000000001', '홀 보조', now() + interval '1 day', now() + interval '1 day 4 hours', 10800, 2);
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.eq((select count(*)::int from ish.notifications where kind = 'new_shift_match'), 1, 'a1 is near: told');
select tests.ok((select (data ->> 'distance_km')::numeric < 1 from ish.notifications where kind = 'new_shift_match'),
                'with the distance');
select tests.eq(ish.my_notifications(10, '{new_shift_match}') -> 0 -> 'shift' ->> 'title', '홀 보조',
                'A12 shows the shift');
select tests.as_user('00000000-0000-0000-0000-0000000000a2');
select tests.eq((select count(*)::int from ish.notifications where kind = 'new_shift_match'), 0, 'a2 is far: not');

-- Not free at that time: not told.
select tests.as_admin();
update ish.worker_profiles
set availability = 1 << ((ish.availability_bit(now() + interval '1 day') + 1) % 28)
where user_id = '00000000-0000-0000-0000-0000000000a1';
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
insert into ish.shifts (business_id, title, starts_at, ends_at, hourly_wage, slots)
values ('10000000-0000-0000-0000-000000000001', '마감', now() + interval '1 day', now() + interval '1 day 3 hours', 10800, 1);
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.eq((select count(*)::int from ish.notifications where kind = 'new_shift_match'), 1, 'busy then: no new one');

-- At most three a day.
select tests.as_admin();
update ish.worker_profiles set availability = 268435455 where user_id = '00000000-0000-0000-0000-0000000000a1';
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
insert into ish.shifts (business_id, title, starts_at, ends_at, hourly_wage, slots) values
  ('10000000-0000-0000-0000-000000000001', 'A', now() + interval '1 day', now() + interval '1 day 2 hours', 10800, 1),
  ('10000000-0000-0000-0000-000000000001', 'B', now() + interval '1 day', now() + interval '1 day 2 hours', 10800, 1),
  ('10000000-0000-0000-0000-000000000001', 'C', now() + interval '1 day', now() + interval '1 day 2 hours', 10800, 1);
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.eq((select count(*)::int from ish.notifications where kind = 'new_shift_match'), 3, 'three a day at most');

-- A business that 국세청 has not confirmed tells nobody.
select tests.as_admin();
delete from ish.notifications where kind = 'new_shift_match';
update ish.businesses set lat = 37.5559, lng = 126.9368 where id = '10000000-0000-0000-0000-000000000002';
insert into ish.shifts (business_id, title, starts_at, ends_at, hourly_wage, slots)
values ('10000000-0000-0000-0000-000000000002', '주방', now() + interval '1 day', now() + interval '1 day 4 hours', 10800, 1);
select tests.eq((select count(*)::int from ish.notifications where kind = 'new_shift_match'), 0, 'unverified: nobody');

-- 7 km away: beyond the old 5 km, inside the 10 km — told, with the distance.
select tests.as_admin();
delete from ish.notifications where kind = 'new_shift_match';
update ish.worker_profiles set lat = 37.5559 + 7.0 / 111.195, lng = 126.9368 where user_id = '00000000-0000-0000-0000-0000000000a2';
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
insert into ish.shifts (business_id, title, starts_at, ends_at, hourly_wage, slots)
values ('10000000-0000-0000-0000-000000000001', '조금 먼 곳', now() + interval '1 day', now() + interval '1 day 4 hours', 10800, 1);
select tests.as_user('00000000-0000-0000-0000-0000000000a2');
select tests.eq((select count(*)::int from ish.notifications where kind = 'new_shift_match'), 1, 'a2 at 7 km: told');
select tests.ok((select (data ->> 'distance_km')::numeric between 6.9 and 7.1 from ish.notifications where kind = 'new_shift_match'),
                'with the distance');

-- No saved position: told when the A02 district is the business's (Mapo-gu), with no distance.
select tests.as_admin();
delete from ish.notifications where kind = 'new_shift_match';
update ish.worker_profiles set lat = null, lng = null where user_id = '00000000-0000-0000-0000-0000000000a2';
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
insert into ish.shifts (business_id, title, starts_at, ends_at, hourly_wage, slots)
values ('10000000-0000-0000-0000-000000000001', '동네', now() + interval '1 day', now() + interval '1 day 4 hours', 10800, 1);
select tests.as_user('00000000-0000-0000-0000-0000000000a2');
select tests.eq((select count(*)::int from ish.notifications where kind = 'new_shift_match'), 1, 'no position, same district: told');
select tests.ok((select not (data ? 'distance_km') from ish.notifications where kind = 'new_shift_match'),
                'and no distance in it');

-- ...but not another district.
select tests.as_admin();
delete from ish.notifications where kind = 'new_shift_match';
update ish.worker_profiles set district = 'Gangnam-gu' where user_id = '00000000-0000-0000-0000-0000000000a2';
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
insert into ish.shifts (business_id, title, starts_at, ends_at, hourly_wage, slots)
values ('10000000-0000-0000-0000-000000000001', '다른 동네', now() + interval '1 day', now() + interval '1 day 4 hours', 10800, 1);
select tests.as_user('00000000-0000-0000-0000-0000000000a2');
select tests.eq((select count(*)::int from ish.notifications where kind = 'new_shift_match'), 0, 'no position, other district: not');
select tests.as_admin();
update ish.worker_profiles set district = 'Mapo-gu' where user_id = '00000000-0000-0000-0000-0000000000a2';
update ish.worker_profiles set lat = 37.4979, lng = 127.0276 where user_id = '00000000-0000-0000-0000-0000000000a2';

-- The evening digest: a1 has open shifts within 3 km over the next two days.
select tests.eq(ish.queue_nearby_digests(), 1, 'a1 only (a2 is far, a3 has no position)');
select tests.eq(ish.queue_nearby_digests(), 0, 'once a day');
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.ok((select (data ->> 'count')::int >= 4 from ish.notifications where kind = 'nearby_digest'),
                's6 and the shifts posted above (s4 is a1''s own)');
select tests.eq((select data ->> 'area_code' from ish.notifications where kind = 'nearby_digest'), 'Mapo-gu',
                'named after the A02 district');
select tests.eq((select data -> 'categories' from ish.notifications where kind = 'nearby_digest'), '["cafe"]'::jsonb,
                'the kinds of work');
select tests.eq((select (data ->> 'wage_min')::int from ish.notifications where kind = 'nearby_digest'), 10800, 'from');

-- Only the database runs them.
select tests.throws($$select ish.queue_nearby_digests()$$, 'permission denied', 'not the apps');
