-- A12 «Smena 2 soatdan keyin»: confirmed workers of shifts starting within
-- two hours get one reminder each (pg_cron calls this every 10 minutes).

select tests.as_admin();
select tests.eq(public.queue_shift_reminders(), 2, 's4 (a1, in 20 minutes) and s6 (a2, in 2 hours)');
select tests.eq(public.queue_shift_reminders(), 0, 'once per application');
select tests.eq((select (data ->> 'minutes_before')::int from public.notifications
                 where kind = 'shift_reminder' and user_id = '00000000-0000-0000-0000-0000000000a1'), 120,
                'the reminder says two hours');

-- A worker who joins later is reminded on the next run; a pending one is not.
update public.shifts set slots = 3 where id = '20000000-0000-0000-0000-000000000006';
insert into public.applications (shift_id, worker_id, status, decided_at) values
  ('20000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-0000000000a1', 'confirmed', now()),
  ('20000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-0000000000a3', 'pending', null);
select tests.eq(public.queue_shift_reminders(), 1, 'the newly confirmed worker');

-- A cancelled shift reminds nobody.
update public.shifts set status = 'cancelled' where id = '20000000-0000-0000-0000-000000000004';
delete from public.notifications where kind = 'shift_reminder';
select tests.eq(public.queue_shift_reminders(), 2, 's6 only (two workers)');

-- The worker reads it with the shift and business (A12).
select tests.as_user('00000000-0000-0000-0000-0000000000a2');
select tests.eq(public.my_notifications(10, '{shift_reminder}') -> 0 -> 'shift' ->> 'id',
                '20000000-0000-0000-0000-000000000006', 'the reminder names the shift');

-- Only the scheduler runs it.
select tests.throws($$select public.queue_shift_reminders()$$, 'permission denied', 'not the apps');
