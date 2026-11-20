-- The Profil of the «10 qadam» design: three parts of the day, the home
-- address and distance, «Ishonch bali».

-- Ertalab 08–13, Kunduzi 13–18, Kechqurun 18–23 (Seoul); earlier is morning.
select tests.eq(ish.availability_bit('2026-11-16 07:30+09'), 0, 'Monday 07:30: morning');
select tests.eq(ish.availability_bit('2026-11-16 12:59+09'), 0, 'Monday 12:59: morning');
select tests.eq(ish.availability_bit('2026-11-16 13:00+09'), 1, 'Monday 13:00: afternoon');
select tests.eq(ish.availability_bit('2026-11-16 18:00+09'), 2, 'Monday 18:00: evening');
select tests.eq(ish.availability_bit('2026-11-22 20:00+09'), 6 * 4 + 2, 'Sunday 20:00: evening');

select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.eq((ish.my_profile() -> 'worker' ->> 'max_km')::int, 5, 'five km at first');
select ish.save_worker_place('마포구 신촌로 22', 3);
select tests.eq(ish.my_profile() -> 'worker' ->> 'home_address', '마포구 신촌로 22', 'the home address');
select tests.eq((ish.my_profile() -> 'worker' ->> 'max_km')::int, 3, 'three km');
select ish.save_worker_place('  ', 10);
select tests.eq(ish.my_profile() -> 'worker' ->> 'home_address', null, 'blank clears it');
select tests.throws($$select ish.save_worker_place('', 4)$$, 'INVALID', 'only 1, 3, 5, 10 km');

-- «Ishonch bali» of the worker with the fixtures' history.
select tests.eq((ish.my_trust() ->> 'reliability')::int,
                (select reliability::int from ish.worker_profiles where user_id = auth.uid()), 'the score');
select tests.eq((ish.my_trust() ->> 'no_shows')::int,
                (select count(*)::int from ish.applications where worker_id = auth.uid() and status = 'no_show'),
                'the no-shows');
select tests.eq((ish.my_trust() ->> 'went')::int,
                (select count(*)::int from ish.applications where worker_id = auth.uid() and status = 'completed'),
                'the finished shifts');
select tests.eq(ish.my_trust() ? 'on_time', true, 'on time share (or null)');

-- Nobody signed in: nothing.
select tests.as_user('00000000-0000-0000-0000-0000000000f9');
select tests.eq(ish.my_trust(), null, 'no worker profile');
