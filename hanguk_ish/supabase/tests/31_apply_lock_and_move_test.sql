-- P30: one worker's requests wait for one another; a moved shift lets its
-- waiting applicants go and tells them the new time. (Two requests at the
-- very same moment are tried for real by tests/concurrency.sh.)

-- A request holds the worker's lock until its transaction ends.
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select ish.apply_to_shift('20000000-0000-0000-0000-000000000002');
select tests.as_admin();
select tests.eq((select count(*)::int from pg_locks
                 where locktype = 'advisory' and pid = pg_backend_pid() and granted),
                1, 'the request took the worker''s lock (held to the end of the transaction)');

-- s2 (the business decides): a1 waits; a2 waits too.
select tests.as_user('00000000-0000-0000-0000-0000000000a2');
select ish.apply_to_shift('20000000-0000-0000-0000-000000000002');

-- A new title does not let anyone go.
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
update ish.shifts set title = '마감 정리 보조 (2층)' where id = '20000000-0000-0000-0000-000000000002';
-- Nor do the same times sent again (the app sends the whole form).
update ish.shifts set starts_at = starts_at, ends_at = ends_at
where id = '20000000-0000-0000-0000-000000000002';
select tests.as_admin();
select tests.eq((select count(*)::int from ish.applications
                 where shift_id = '20000000-0000-0000-0000-000000000002' and status = 'pending'),
                2, 'a new title or the same times keep the two waiting');

-- An hour later: both asked for the old time, so both are let go and told.
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
update ish.shifts set starts_at = starts_at + interval '1 hour', ends_at = ends_at + interval '1 hour'
where id = '20000000-0000-0000-0000-000000000002';
select tests.as_admin();
select tests.eq((select count(*)::int from ish.applications
                 where shift_id = '20000000-0000-0000-0000-000000000002' and status = 'pending'),
                0, 'nobody waits for the moved shift');
select tests.eq((select count(*)::int from ish.applications
                 where shift_id = '20000000-0000-0000-0000-000000000002' and status = 'rejected'
                   and decided_at = now()),
                2, 'both applications ended now');
select tests.eq((select array_agg(user_id::text order by user_id) from ish.notifications
                 where kind = 'application_rejected' and data ->> 'reason' = 'time_changed'
                   and data ->> 'shift_id' = '20000000-0000-0000-0000-000000000002'),
                array['00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2'],
                'each of them is told once');
select tests.ok((select data ? 'application_id' from ish.notifications
                 where kind = 'application_rejected' and data ->> 'reason' = 'time_changed' limit 1),
                'the notice names the application');

-- A12 reads the new time from the shift.
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.eq((select (c -> 'shift' ->> 'starts_at')::timestamptz
                 from jsonb_array_elements(ish.my_notifications()) c
                 where c -> 'data' ->> 'reason' = 'time_changed'),
                (select starts_at from ish.shifts where id = '20000000-0000-0000-0000-000000000002'),
                'A12 shows the new start');

-- They may take it again at the new time.
select tests.eq((ish.apply_to_shift('20000000-0000-0000-0000-000000000002')).status::text, 'pending',
                'a1 asks again for the new time');

-- The business moves it once more while a1 waits: a1 is let go again;
-- a2's old, closed application is not touched.
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
update ish.shifts set ends_at = ends_at + interval '30 minutes'
where id = '20000000-0000-0000-0000-000000000002';
select tests.as_admin();
select tests.eq((select count(*)::int from ish.notifications
                 where kind = 'application_rejected' and data ->> 'reason' = 'time_changed'
                   and user_id = '00000000-0000-0000-0000-0000000000a1'),
                2, 'a longer shift is a new time too');
select tests.eq((select count(*)::int from ish.notifications
                 where kind = 'application_rejected' and data ->> 'reason' = 'time_changed'
                   and user_id = '00000000-0000-0000-0000-0000000000a2'),
                1, 'a2 had nothing waiting any more');

-- Moved by the service role (an admin): its waiting applicants stay.
select tests.as_user('00000000-0000-0000-0000-0000000000a2');
select ish.apply_to_shift('20000000-0000-0000-0000-000000000002');
select tests.as_admin();
update ish.shifts set starts_at = starts_at - interval '2 hours', ends_at = ends_at - interval '2 hours'
where id = '20000000-0000-0000-0000-000000000002';
select tests.eq((select count(*)::int from ish.applications
                 where shift_id = '20000000-0000-0000-0000-000000000002' and status = 'pending'),
                1, 'an admin''s move lets nobody go');

-- Confirmed workers are untouched (their shift cannot move: shifts_guard).
select tests.eq((select status::text from ish.applications
                 where id = '30000000-0000-0000-0000-000000000004'),
                'confirmed', 'a confirmed worker stays confirmed');

-- The trigger's function is not something the apps can call.
select tests.ok(not has_function_privilege('authenticated', 'ish.shifts_release_on_move()', 'execute'),
                'the release runs only as the trigger');
