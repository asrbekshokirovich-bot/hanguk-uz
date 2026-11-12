-- P52: the workers' complaints (A11 «Shikoyat qilish») reach the staff: they
-- read them, open ones first, and note where each stands.
--
-- People: c1 — staff; a1, a2 — workers of the fixtures; b1 — an owner.
select tests.as_admin();
insert into auth.users (id, phone) values ('00000000-0000-0000-0000-0000000000c1', '+821000000031');
insert into ish.staff_members (user_id) values ('00000000-0000-0000-0000-0000000000c1');

-- What the app sends (A11): a subject and a text.
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
insert into ish.reports (reason, body) values ('employer', 'Ish beruvchi pul to''lamadi');
select tests.as_user('00000000-0000-0000-0000-0000000000a2');
insert into ish.reports (reason, body) values ('safety', 'Omborda xavfsizlik yo''q');
select tests.as_admin();
-- a1's is the older one (one transaction: one now()).
update ish.reports set created_at = now() - interval '1 hour' where reporter_id = '00000000-0000-0000-0000-0000000000a1';
create temp table r as select id, reporter_id from ish.reports;
grant select on r to authenticated;

-- Only the staff.
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.throws($$select ish.staff_reports()$$, 'FORBIDDEN', 'a worker cannot read the complaints');
select tests.throws($$select ish.staff_set_report_status((select id from r limit 1), 'closed')$$, 'FORBIDDEN',
                    'nor close one');
select tests.eq((select count(*)::int from ish.reports), 1, 'a worker sees only their own (RLS)');
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
select tests.throws($$select ish.staff_reports()$$, 'FORBIDDEN', 'nor an owner');
select tests.as_anon();
select tests.throws($$select ish.staff_reports()$$, 'permission denied', 'nor anybody signed out');

-- The staff read them with who wrote them, newest first.
select tests.as_user('00000000-0000-0000-0000-0000000000c1');
create temp table seen as select ish.staff_reports() as j;
grant select on seen to authenticated;
select tests.eq((select jsonb_array_length(j) from seen), 2, 'both complaints');
select tests.eq((select j -> 0 ->> 'body' from seen), 'Omborda xavfsizlik yo''q', 'the newest first');
select tests.eq((select j -> 1 ->> 'reason' || '|' || (j -> 1 ->> 'status') from seen), 'employer|open',
                'the subject and where it stands');
select tests.eq((select j -> 1 -> 'worker' ->> 'first_name' || ' ' || (j -> 1 -> 'worker' ->> 'last_name') from seen),
                'Aziz Karimov', 'who wrote it');
select tests.eq((select (j -> 1 -> 'worker' ->> 'completed')::int from seen), 0, 'with the worker''s history');

-- Where it stands: closed ones go to the end.
select tests.eq(ish.staff_set_report_status(
                  (select id from r where reporter_id = '00000000-0000-0000-0000-0000000000a2'), 'closed'),
                'closed', 'closed');
select tests.eq((select ish.staff_reports() -> 0 ->> 'body'), 'Ish beruvchi pul to''lamadi',
                'an open one comes before a closed one');
select tests.eq(ish.staff_set_report_status(
                  (select id from r where reporter_id = '00000000-0000-0000-0000-0000000000a1'), 'in_review'),
                'in_review', 'being looked at');
select tests.throws($$select ish.staff_set_report_status((select id from r limit 1), 'done')$$, 'INVALID',
                    'only open, in_review, closed');
select tests.throws($$select ish.staff_set_report_status((select id from r limit 1), null)$$, 'INVALID',
                    'not nothing');
select tests.throws($$select ish.staff_set_report_status('99999999-0000-0000-0000-000000000000', 'closed')$$,
                    'NOT_FOUND', 'a complaint that is not there');
select tests.eq(jsonb_array_length(ish.staff_reports(1)), 1, 'a limit');
-- The worker sees where theirs stands (RLS, as before).
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.eq((select status from ish.reports), 'in_review', 'the worker''s own complaint, with its status');
