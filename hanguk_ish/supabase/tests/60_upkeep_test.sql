-- close_finished_shifts(): no-shows and expired applications (cron).

-- a3 waits on s1 (auto-confirm off for this test) and s1's start passes.
select tests.as_admin();
update ish.shifts set auto_confirm = false where id = '20000000-0000-0000-0000-000000000006';
insert into ish.applications (id, shift_id, worker_id, status) values
  ('30000000-0000-0000-0000-000000000063', '20000000-0000-0000-0000-000000000006',
   '00000000-0000-0000-0000-0000000000a3', 'pending');
update ish.shifts set starts_at = now() - interval '10 minutes', ends_at = now() + interval '3 hours'
  where id = '20000000-0000-0000-0000-000000000006';

select tests.eq(ish.close_finished_shifts(), 1, 'one no-show (a2 on s7, ended an hour ago)');
select tests.eq((select status::text from ish.applications where id = '30000000-0000-0000-0000-000000000075'),
                'no_show', 'a2 is marked as a no-show');
select tests.eq((select reliability::int from ish.worker_profiles where user_id = '00000000-0000-0000-0000-0000000000a2'),
                80, 'no-show costs 20 points');
select tests.eq((select count(*)::int from ish.notifications
                 where user_id = '00000000-0000-0000-0000-0000000000b1' and kind = 'no_show'),
                1, 'the business is told');
select tests.eq((select status::text from ish.applications where id = '30000000-0000-0000-0000-000000000063'),
                'rejected', 'a still-pending application is closed when the shift starts');
select tests.eq((select status::text from ish.applications where id = '30000000-0000-0000-0000-000000000005'),
                'checked_in', 'a worker at work is left alone');
select tests.eq((select status::text from ish.applications where id = '30000000-0000-0000-0000-000000000004'),
                'confirmed', 'a confirmed worker before the end is left alone');

select tests.eq(ish.close_finished_shifts(), 0, 'running it again changes nothing');
select tests.eq((select reliability::int from ish.worker_profiles where user_id = '00000000-0000-0000-0000-0000000000a2'),
                80, 'no double penalty');

select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.throws('select ish.close_finished_shifts()', 'permission denied', 'apps cannot run the upkeep');
