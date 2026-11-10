-- Who can read and write what, through the API roles.

-- Anonymous: nothing.
select tests.as_anon();
select tests.throws('select count(*) from public.shifts', 'permission denied', 'anon cannot read shifts');
select tests.throws('select count(*) from public.profiles', 'permission denied', 'anon cannot read profiles');
select tests.throws($$select public.apply_to_shift('20000000-0000-0000-0000-000000000001')$$,
                    'permission denied', 'anon cannot take a shift');

-- Worker a1.
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.eq((select count(*)::int from public.shifts where business_id = '10000000-0000-0000-0000-000000000002'),
                0, 'shifts of an unverified business are hidden');
select tests.ok((select count(*) from public.shifts where id = '20000000-0000-0000-0000-000000000001') = 1,
                'open shift of a verified business is visible');
select tests.eq((select count(*)::int from public.businesses), 1, 'only the verified business is visible');
select tests.throws('select * from public.shift_secrets', 'permission denied', 'QR secrets are unreadable');
select tests.throws($$select public.qr_token_for('20000000-0000-0000-0000-000000000004')$$,
                    'permission denied', 'workers cannot compute a QR token');
select tests.throws($$select public.shift_qr('20000000-0000-0000-0000-000000000004')$$,
                    'NOT_FOUND', 'workers cannot fetch a shift QR');

select tests.eq((select count(*)::int from public.profiles), 1, 'a worker sees only their own profile');
select tests.eq((select count(*)::int from public.worker_profiles), 1, 'and only their own worker profile');

update public.profiles set first_name = 'Aziz2' where id = '00000000-0000-0000-0000-0000000000a1';
select tests.eq((select first_name from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'),
                'Aziz2', 'a worker can rename themselves');
select tests.throws($$update public.profiles set telegram_id = 1 where id = '00000000-0000-0000-0000-0000000000a1'$$,
                    'permission denied', 'telegram identity is not writable');
select tests.throws($$update public.worker_profiles set reliability = 100 where user_id = '00000000-0000-0000-0000-0000000000a1'$$,
                    'permission denied', 'reliability is not writable');
update public.profiles set first_name = 'Hacked' where id = '00000000-0000-0000-0000-0000000000a2';
select tests.as_admin();
select tests.eq((select first_name from public.profiles where id = '00000000-0000-0000-0000-0000000000a2'),
                'Malika', 'nobody renames another user');
select tests.as_user('00000000-0000-0000-0000-0000000000a1');

select tests.throws($$insert into public.applications (shift_id, worker_id, status)
                      values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'confirmed')$$,
                    'permission denied', 'applications cannot be written directly');
select tests.throws($$update public.applications set status = 'completed' where id = '30000000-0000-0000-0000-000000000004'$$,
                    'permission denied', 'nor promoted directly');
select tests.throws($$insert into public.shifts (business_id, title, starts_at, ends_at, hourly_wage, slots)
                      values ('10000000-0000-0000-0000-000000000001', 'x', now() + interval '1 day', now() + interval '1 day 2 hours', 10500, 1)$$,
                    'row-level security', 'a worker cannot post a shift');
select tests.eq((select count(*)::int from public.applications), 1, 'a worker sees only their own applications');
select tests.throws($$insert into public.notifications (user_id, kind) values ('00000000-0000-0000-0000-0000000000a1', 'no_show')$$,
                    'permission denied', 'notifications are written by the system only');

-- Worker profiles stay private from businesses until the worker applies.
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
select tests.eq((select count(*)::int from public.worker_profiles where user_id = '00000000-0000-0000-0000-0000000000a3'),
                0, 'a business cannot browse workers who never applied');
select tests.ok((select count(*) from public.worker_profiles where user_id = '00000000-0000-0000-0000-0000000000a2') = 1,
                'but sees its applicants');
select tests.ok((select count(*) from public.profiles where id = '00000000-0000-0000-0000-0000000000a2') = 1,
                'including their names');
select tests.eq((select count(*)::int from public.applications), 4, 'a business sees applications to its shifts');
select tests.ok(public.shift_qr('20000000-0000-0000-0000-000000000004') like 'hanguk-ish:v1:20000000-0000-0000-0000-000000000004:%',
                'the business gets its QR payload');

-- Another business sees none of it.
select tests.as_user('00000000-0000-0000-0000-0000000000b2');
select tests.eq((select count(*)::int from public.applications), 0, 'another business sees no applications');
select tests.eq((select count(*)::int from public.worker_profiles), 0, 'nor any worker');
select tests.throws($$insert into public.shifts (business_id, title, starts_at, ends_at, hourly_wage, slots)
                      values ('10000000-0000-0000-0000-000000000002', 'x', now() + interval '1 day', now() + interval '1 day 2 hours', 10500, 1)$$,
                    'BUSINESS_NOT_VERIFIED', 'an unverified business cannot post');
select tests.throws($$insert into public.shifts (business_id, title, starts_at, ends_at, hourly_wage, slots)
                      values ('10000000-0000-0000-0000-000000000001', 'x', now() + interval '1 day', now() + interval '1 day 2 hours', 10500, 1)$$,
                    'row-level security', 'nor post for someone else''s business');
select tests.throws($$update public.businesses set status = 'verified' where id = '10000000-0000-0000-0000-000000000002'$$,
                    'permission denied', 'a business cannot verify itself');

-- Chat: only the two sides of an application.
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
insert into public.messages (application_id, body) values ('30000000-0000-0000-0000-000000000004', 'Salom');
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
select tests.eq((select body from public.messages limit 1), 'Salom', 'the business reads the worker''s message');
insert into public.messages (application_id, body, lang) values ('30000000-0000-0000-0000-000000000004', '네, 감사합니다', 'ko');
select tests.as_user('00000000-0000-0000-0000-0000000000a2');
select tests.eq((select count(*)::int from public.messages), 0, 'other workers read nothing');
select tests.throws($$insert into public.messages (application_id, body) values ('30000000-0000-0000-0000-000000000004', 'hi')$$,
                    'row-level security', 'and cannot write into the thread');
select tests.as_user('00000000-0000-0000-0000-0000000000b2');
select tests.eq((select count(*)::int from public.messages), 0, 'other businesses read nothing');
