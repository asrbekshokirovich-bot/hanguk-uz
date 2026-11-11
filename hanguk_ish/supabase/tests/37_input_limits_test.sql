-- What people type (P47): every text a form sends stays within the
-- database's limits. At the limit it is kept; one character more is refused
-- by a check (which the apps and hanguk.uz show as «INVALID», never as a
-- crash); a blank required text is refused; quotes, emoji, line breaks and
-- SQL-looking text are kept exactly as typed. The forms hold the same limits
-- (hanguk.uz maxLength, the apps' length formatters).
--
-- People: c1 — staff (as in 36); a1 — a worker; b1 — an owner in the app.
select tests.as_admin();
insert into auth.users (id, phone) values ('00000000-0000-0000-0000-0000000000c1', '+821000000031');
insert into public.staff_members (user_id) values ('00000000-0000-0000-0000-0000000000c1');

create temp table ids (k text primary key, v uuid);
grant select, insert on ids to authenticated;
create function pg_temp.id(p text) returns uuid language sql as $$ select v from ids where k = p $$;

-- ---------------------------------------------------------------------------
-- hanguk.uz: an employer kept by the staff
-- ---------------------------------------------------------------------------
select tests.as_user('00000000-0000-0000-0000-0000000000c1');
insert into ids select 'biz', public.staff_save_business(
  null, repeat('가', 80), 'other', repeat('a', 40), repeat('b', 200), repeat('c', 80), repeat('d', 80), null, null,
  '{}'::jsonb,
  jsonb_build_object('contact_name', repeat('e', 80), 'phone', repeat('1', 32), 'telegram', repeat('f', 64),
                     'source', repeat('g', 300), 'notes', repeat('h', 2000)));
select tests.ok(pg_temp.id('biz') is not null, 'an employer with every field at its limit is kept');

select tests.throws($$select public.staff_save_business(null, repeat('가', 81))$$,
                    'violates check constraint', 'name: 81 characters');
select tests.throws($$select public.staff_save_business(null, 'x', 'other', repeat('a', 41))$$,
                    'violates check constraint', 'area: 41');
select tests.throws($$select public.staff_save_business(null, 'x', 'other', '', repeat('b', 201))$$,
                    'violates check constraint', 'address: 201');
select tests.throws($$select public.staff_save_business(null, 'x', 'other', '', '', repeat('c', 81))$$,
                    'violates check constraint', 'address detail: 81');
select tests.throws($$select public.staff_save_business(null, 'x', 'other', '', '', '', repeat('d', 81))$$,
                    'violates check constraint', 'district: 81');
select tests.throws($$select public.staff_save_business(null, 'x', p_contact => jsonb_build_object('notes', repeat('h', 2001)))$$,
                    'violates check constraint', 'contact notes: 2001');
select tests.throws($$select public.staff_save_business(null, 'x', p_contact => jsonb_build_object('telegram', repeat('f', 65)))$$,
                    'violates check constraint', 'contact Telegram: 65');
select tests.throws($$select public.staff_save_business(null, '   ')$$, 'INVALID', 'a blank name');
select tests.throws($$select public.staff_save_business(null, 'x', 'spaceship')$$,
                    'violates check constraint', 'a category the apps do not know');

-- Typed as it was: quotes, emoji, a line break, SQL-looking text.
insert into ids select 'odd', public.staff_save_business(
  null, $n$O'zbek "Choyxona" 🍵$n$, 'restaurant', '', E'Seoul\nMapo-gu', '', null, null, null, '{}'::jsonb,
  jsonb_build_object('notes', $n$'); drop table public.businesses; --$n$));
-- (The contacts are read only through the staff's functions: checked as admin.)
select tests.as_admin();
select tests.eq((select name from public.businesses where id = pg_temp.id('odd')), $n$O'zbek "Choyxona" 🍵$n$, 'quotes and emoji kept');
select tests.eq((select address from public.businesses where id = pg_temp.id('odd')), E'Seoul\nMapo-gu', 'a line break kept');
select tests.eq((select notes from public.business_contacts where business_id = pg_temp.id('odd')),
                $n$'); drop table public.businesses; --$n$, 'SQL-looking text is only text');
select tests.ok(to_regclass('public.businesses') is not null, 'and the table is still there');
select tests.as_user('00000000-0000-0000-0000-0000000000c1');

-- ---------------------------------------------------------------------------
-- hanguk.uz: a job
-- ---------------------------------------------------------------------------
insert into ids select 'job', public.staff_save_shift(
  null, pg_temp.id('biz'), repeat('t', 80), now() + interval '3 days', now() + interval '3 days 4 hours', 12000, 2,
  repeat('u', 600), repeat('v', 300), repeat('w', 200), null, null, false, true, repeat('x', 300), repeat('y', 2000));
select tests.ok(pg_temp.id('job') is not null, 'a job with every field at its limit is kept');

create function pg_temp.job(p_title text default 'Ish', p_duties text default '', p_dress text default '',
                            p_address text default '', p_source text default '', p_notes text default '')
returns uuid language sql as $$
  select public.staff_save_shift(null, pg_temp.id('biz'), p_title, now() + interval '3 days',
                                 now() + interval '3 days 4 hours', 12000, 2, p_duties, p_dress, p_address,
                                 null, null, false, true, p_source, p_notes)
$$;
select tests.throws($$select pg_temp.job(repeat('t', 81))$$, 'violates check constraint', 'job title: 81');
select tests.throws($$select pg_temp.job('   ')$$, 'violates check constraint', 'a blank job title');
select tests.throws($$select pg_temp.job(null)$$, 'violates not-null constraint', 'no job title');
select tests.throws($$select pg_temp.job(p_duties => repeat('u', 601))$$, 'violates check constraint', 'duties: 601');
select tests.throws($$select pg_temp.job(p_dress => repeat('v', 301))$$, 'violates check constraint', 'dress: 301');
select tests.throws($$select pg_temp.job(p_address => repeat('w', 201))$$, 'violates check constraint', 'address: 201');
select tests.throws($$select pg_temp.job(p_source => repeat('x', 301))$$, 'violates check constraint', 'source: 301');
select tests.throws($$select pg_temp.job(p_notes => repeat('y', 2001))$$, 'violates check constraint', 'notes: 2001');
select tests.throws($$select public.staff_send_offers(pg_temp.id('job'), array['00000000-0000-0000-0000-0000000000a1']::uuid[], repeat('n', 301))$$,
                    'INVALID', 'an offer note: 301');
select tests.eq(public.staff_send_offers(pg_temp.id('job'), array['00000000-0000-0000-0000-0000000000a1']::uuid[], repeat('n', 300)),
                1, 'an offer note at 300 goes');

-- ---------------------------------------------------------------------------
-- The worker app: the profile (A02), the chat (A10), a report (A11)
-- ---------------------------------------------------------------------------
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.ok(public.save_worker_profile(repeat('A', 60), repeat('B', 60), '{uz}', 0, repeat('U', 120), repeat('D', 80), 0, null)
                is not null, 'a profile at its limits is kept');
select tests.throws($$select public.save_worker_profile(repeat('A', 61), 'B', '{uz}', 0, null, 'Mapo-gu', 0, null)$$,
                    'violates check constraint', 'first name: 61');
select tests.throws($$select public.save_worker_profile('A', repeat('B', 61), '{uz}', 0, null, 'Mapo-gu', 0, null)$$,
                    'violates check constraint', 'last name: 61');
select tests.throws($$select public.save_worker_profile('A', 'B', '{uz}', 0, repeat('U', 121), 'Mapo-gu', 0, null)$$,
                    'violates check constraint', 'university: 121');
select tests.throws($$select public.save_worker_profile('A', 'B', '{uz}', 0, null, repeat('D', 81), 0, null)$$,
                    'violates check constraint', 'district: 81');
select tests.throws($$select public.save_worker_profile('   ', 'B', '{uz}', 0, null, 'Mapo-gu', 0, null)$$,
                    'NAME_REQUIRED', 'a blank first name');
select tests.throws($$select public.save_worker_profile('A', 'B', '{uz}', 0, null, '  ', 0, null)$$,
                    'DISTRICT_REQUIRED', 'a blank district');
select tests.ok(public.save_worker_profile($n$Dilnoza 'Dili' 😀$n$, 'Qo''chqorova', '{uz}', 0, null, 'Mapo-gu', 0, null) is not null,
                'quotes and emoji in a name');
select tests.eq((select first_name || ' ' || last_name from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'),
                $n$Dilnoza 'Dili' 😀 Qo'chqorova$n$, 'kept as typed');

-- A10: a1 holds s4 (the fixtures).
create temp table app as
  select id from public.applications
  where worker_id = '00000000-0000-0000-0000-0000000000a1' and shift_id = '20000000-0000-0000-0000-000000000004';
grant select on app to authenticated;
select tests.ok((select count(*) from app) = 1, 'a1 holds s4');
insert into public.messages (application_id, body) select id, repeat('m', 2000) from app;
select tests.ok(true, 'a message of 2 000 characters goes');
select tests.throws($$insert into public.messages (application_id, body) select id, repeat('m', 2001) from app$$,
                    'violates check constraint', 'a message of 2 001');
select tests.throws($$insert into public.messages (application_id, body) select id, '' from app$$,
                    'violates check constraint', 'an empty message');

-- A11: a report.
insert into public.reports (reason, body) values ('safety', repeat('r', 2000));
select tests.ok(true, 'a report of 2 000 characters goes');
select tests.throws($$insert into public.reports (reason, body) values ('safety', repeat('r', 2001))$$,
                    'violates check constraint', 'a report of 2 001');

-- ---------------------------------------------------------------------------
-- The employer app: BA2
-- ---------------------------------------------------------------------------
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
create function pg_temp.post(p_title text, p_duties text default '', p_dress text default '', p_address text default '')
returns void language sql as $$
  insert into public.shifts (business_id, title, duties, dress, address, starts_at, ends_at, hourly_wage, slots)
  values ('10000000-0000-0000-0000-000000000001', p_title, p_duties, p_dress, p_address,
          now() + interval '3 days', now() + interval '3 days 4 hours', 12000, 1)
$$;
select pg_temp.post(repeat('t', 80), repeat('u', 600), repeat('v', 300), repeat('w', 200));
select tests.ok(true, 'a BA2 shift at its limits is posted');
select tests.throws($$select pg_temp.post(repeat('t', 81))$$, 'violates check constraint', 'BA2 title: 81');
select tests.throws($$select pg_temp.post('t', repeat('u', 601))$$, 'violates check constraint', 'BA2 duties: 601');
select tests.throws($$select pg_temp.post('t', '', repeat('v', 301))$$, 'violates check constraint', 'BA2 dress: 301');
select tests.throws($$select pg_temp.post('t', '', '', repeat('w', 201))$$, 'violates check constraint', 'BA2 address: 201');
