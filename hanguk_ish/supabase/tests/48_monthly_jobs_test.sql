-- Monthly jobs: the staff post them, workers see the open ones and say
-- «Qiziqaman», the staff see who is interested.
--
-- People: c1 — staff; a1, a2 — workers; b1 — an owner.
select tests.as_admin();
insert into auth.users (id, phone) values ('00000000-0000-0000-0000-0000000000c1', '+821000000031');
insert into ish.staff_members (user_id) values ('00000000-0000-0000-0000-0000000000c1');

select tests.as_user('00000000-0000-0000-0000-0000000000c1');
insert into ish.monthly_jobs (id, title, company, monthly_wage, days_per_week, category, work_time)
values ('70000000-0000-0000-0000-000000000001', '카페 바리스타', '달빛카페', 2300000, 5, 'cafe', 'day'),
       ('70000000-0000-0000-0000-000000000002', '야간 물류', '상암물류', 2800000, 5, 'logistics', 'night');
update ish.monthly_jobs set status = 'closed' where id = '70000000-0000-0000-0000-000000000002';

-- A worker sees the open job only, and cannot change jobs.
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.eq((select count(*)::int from ish.monthly_jobs), 1, 'a worker sees the open job only');
select tests.throws($$insert into ish.monthly_jobs (title, company, monthly_wage) values ('x', 'y', 1)$$,
                    'row-level security', 'a worker cannot post a job');

-- «Qiziqaman», once; only for oneself; not for a closed job.
insert into ish.monthly_applications (job_id) values ('70000000-0000-0000-0000-000000000001');
select tests.throws($$insert into ish.monthly_applications (job_id) values ('70000000-0000-0000-0000-000000000001')$$,
                    'duplicate key', 'once per job');
select tests.throws($$insert into ish.monthly_applications (job_id, worker_id) values
                      ('70000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a2')$$,
                    'row-level security', 'not on behalf of another worker');
select tests.throws($$insert into ish.monthly_applications (job_id) values ('70000000-0000-0000-0000-000000000002')$$,
                    'row-level security', 'not for a closed job');
select tests.throws($$select ish.staff_monthly_interest()$$, 'FORBIDDEN', 'a worker cannot list who is interested');

-- Another worker does not see a1's interest.
select tests.as_user('00000000-0000-0000-0000-0000000000a2');
select tests.eq((select count(*)::int from ish.monthly_applications), 0, 'interest is private');

-- The staff see it with the worker's name.
select tests.as_user('00000000-0000-0000-0000-0000000000c1');
select tests.eq((select count(*)::int from ish.staff_monthly_interest()), 1, 'the staff see the interest');
select tests.eq((select first_name from ish.staff_monthly_interest('70000000-0000-0000-0000-000000000001')), 'Aziz',
                'with the worker''s name');

-- A worker takes it back.
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
delete from ish.monthly_applications where job_id = '70000000-0000-0000-0000-000000000001';
select tests.as_admin();
select tests.eq((select count(*)::int from ish.monthly_applications), 0, 'withdrawn');

-- The public page (signed out): the open jobs, read only; no interest rows.
select tests.as_anon();
select tests.eq((select count(*)::int from ish.monthly_jobs), 1, 'the signed-out see the open job only');
select tests.throws($$insert into ish.monthly_jobs (title, company, monthly_wage) values ('x', 'y', 1)$$,
                    'permission denied', 'and cannot post');
select tests.throws($$select * from ish.monthly_applications$$, 'permission denied', 'nor read who is interested');
