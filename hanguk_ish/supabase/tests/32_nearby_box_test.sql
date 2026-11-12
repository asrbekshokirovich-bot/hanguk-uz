-- P32: the box around a shift's place never leaves out a worker whom the
-- distance lets in — just inside 5 km for a new shift, 3 km for the
-- digest — in each direction; just outside stays out.
-- biz1 is at 37.5559, 126.9368. A degree: 111.195 km north–south,
-- 88.14 km east–west there.
select tests.as_admin();
update ish.worker_profiles set onboarded_at = now(), availability = 268435455
where user_id = '00000000-0000-0000-0000-0000000000a3';

-- New shift (5 km): a1 4.95 km north, a2 4.95 km east, a3 5.05 km south.
update ish.worker_profiles set lat = 37.5559 + 4.95 / 111.195, lng = 126.9368
where user_id = '00000000-0000-0000-0000-0000000000a1';
update ish.worker_profiles set lat = 37.5559, lng = 126.9368 + 4.95 / 88.14
where user_id = '00000000-0000-0000-0000-0000000000a2';
update ish.worker_profiles set lat = 37.5559 - 5.05 / 111.195, lng = 126.9368
where user_id = '00000000-0000-0000-0000-0000000000a3';
select tests.ok((select bool_and(ish.distance_km(lat, lng, 37.5559, 126.9368) between 4.9 and 5.0)
                 from ish.worker_profiles
                 where user_id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2')),
                'a1 and a2 are just inside 5 km');
select tests.ok((select ish.distance_km(lat, lng, 37.5559, 126.9368) between 5.0 and 5.1
                 from ish.worker_profiles where user_id = '00000000-0000-0000-0000-0000000000a3'),
                'a3 is just outside');

select tests.as_user('00000000-0000-0000-0000-0000000000b1');
insert into ish.shifts (business_id, title, starts_at, ends_at, hourly_wage, slots)
values ('10000000-0000-0000-0000-000000000001', '경계 테스트', now() + interval '1 day', now() + interval '1 day 4 hours',
        10800, 2);
select tests.as_admin();
select tests.eq((select array_agg(user_id::text order by user_id) from ish.notifications
                 where kind = 'new_shift_match'),
                array['00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2'],
                'the two inside 5 km are told, the one outside is not');

-- The digest (3 km): a1 2.95 km north, a2 2.95 km west, a3 3.05 km east.
update ish.worker_profiles set lat = 37.5559 + 2.95 / 111.195, lng = 126.9368
where user_id = '00000000-0000-0000-0000-0000000000a1';
update ish.worker_profiles set lat = 37.5559, lng = 126.9368 - 2.95 / 88.14
where user_id = '00000000-0000-0000-0000-0000000000a2';
update ish.worker_profiles set lat = 37.5559, lng = 126.9368 + 3.05 / 88.14
where user_id = '00000000-0000-0000-0000-0000000000a3';
select tests.ok((select bool_and(ish.distance_km(lat, lng, 37.5559, 126.9368) between 2.9 and 3.0)
                 from ish.worker_profiles
                 where user_id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2')),
                'a1 and a2 are just inside 3 km');
select tests.ok((select ish.distance_km(lat, lng, 37.5559, 126.9368) between 3.0 and 3.1
                 from ish.worker_profiles where user_id = '00000000-0000-0000-0000-0000000000a3'),
                'a3 is just outside');
select tests.eq(ish.queue_nearby_digests(), 2, 'two digests');
select tests.eq((select array_agg(user_id::text order by user_id) from ish.notifications
                 where kind = 'nearby_digest'),
                array['00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2'],
                'for the two inside 3 km');

-- The index the box is answered from.
select tests.ok(exists (select 1 from pg_indexes where indexname = 'worker_profiles_place_idx'),
                'the place index is there');
