-- Hanguk's staff on hanguk.uz (docs/operator-reja.md): an employer outside
-- the app, an invite-only job, who fits, offers and the answers, the 확정
-- after the call with the employer, who came, paid.
--
-- People: c1 — staff; a1 (Aziz), a2 (Malika) — workers of the fixtures,
-- w4 (Bekzod) — a worker far away, free at another time; b1 — an owner in
-- the app (not staff).
select tests.as_admin();
insert into auth.users (id, phone) values
  ('00000000-0000-0000-0000-0000000000c1', '+821000000031'),
  ('00000000-0000-0000-0000-0000000000c4', '+821000000034');
update public.profiles set first_name = 'Bekzod', last_name = 'Aliyev' where id = '00000000-0000-0000-0000-0000000000c4';
insert into public.staff_members (user_id) values ('00000000-0000-0000-0000-0000000000c1');
-- a1 lives by the employer (Hongdae), a2 1.6 km off, w4 in Gangnam.
update public.worker_profiles set lat = 37.5563, lng = 126.9236 where user_id = '00000000-0000-0000-0000-0000000000a1';
update public.worker_profiles set lat = 37.5700, lng = 126.9300 where user_id = '00000000-0000-0000-0000-0000000000a2';
insert into public.worker_profiles (user_id, languages, topik, district, lat, lng, availability, onboarded_at)
values ('00000000-0000-0000-0000-0000000000c4', '{uz,ru}', 2, 'Gangnam-gu', 37.4979, 127.0276,
        -- free only in the part of the week after the job's
        1 << ((public.availability_bit(now() + interval '2 days 1 hour') + 1) % 28), now());
-- a2 already works s1 (now + 2 days, 5 h), which the job overlaps.
insert into public.applications (shift_id, worker_id, status, decided_at)
values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a2', 'confirmed', now());

create temp table ids (k text primary key, v uuid);
grant select, insert on ids to authenticated;
create function pg_temp.id(p text) returns uuid language sql as $$ select v from ids where k = p $$;

-- Only the staff.
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.eq(public.is_staff(), false, 'a worker is not staff');
select tests.throws($$select public.staff_businesses()$$, 'FORBIDDEN', 'a worker cannot list the kept employers');
select tests.throws($$select public.staff_candidates('20000000-0000-0000-0000-000000000001')$$, 'FORBIDDEN',
                    'nor see who fits a job');
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
select tests.throws($$select public.staff_save_business(null, '가게')$$, 'FORBIDDEN', 'nor can an owner in the app');
select tests.as_anon();
select tests.throws($$select public.staff_board(now(), now() + interval '1 day')$$, 'permission denied',
                    'and nobody signed out');

-- An employer found on Telegram, with what only the staff see.
select tests.as_user('00000000-0000-0000-0000-0000000000c1');
select tests.eq(public.is_staff(), true, 'c1 is staff');
insert into ids select 'biz', public.staff_save_business(
  null, '홍대 이삿짐센터', 'logistics', 'Hongdae', '마포구 와우산로 21', '', 'Mapo-gu', 37.5560, 126.9230,
  '{"uz": "Hongdae ko''chish xizmati"}',
  '{"contact_name": "김사장", "phone": "010-5555-1234", "telegram": "@hongdae_move",
    "source": "https://t.me/koreajobs_uz/1234", "notes": "Naqd to''laydi"}');
select tests.eq(jsonb_array_length(public.staff_businesses()), 1, 'the staff see the employer they keep');
select tests.eq(public.staff_businesses() -> 0 -> 'contact' ->> 'phone', '010-5555-1234', 'with its contact');
select tests.as_admin();
select tests.eq((select status::text from public.businesses where id = pg_temp.id('biz')), 'verified',
                'no 사업자등록번호 and no 국세청 check needed');
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.throws($$select count(*) from public.business_contacts$$, 'permission denied',
                    'workers cannot read the employer''s contacts');
select tests.throws($$select count(*) from public.shift_notes$$, 'permission denied', 'nor the staff''s notes');

-- An invite-only job: in two days, 4 h, 2 places, the staff decide.
select tests.as_user('00000000-0000-0000-0000-0000000000c1');
insert into ids select 'job', public.staff_save_shift(
  null, pg_temp.id('biz'), '이삿짐 운반 보조', now() + interval '2 days 1 hour', now() + interval '2 days 5 hours',
  13000, 2, '짐 나르기', '편한 옷', '마포구 와우산로 21', null, null, false, true,
  'https://t.me/koreajobs_uz/1234', '오전 10시까지 도착');

select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.ok(not exists (
  select 1 from jsonb_array_elements(public.shift_feed(now(), now() + interval '7 days')) c
  where (c ->> 'id')::uuid = pg_temp.id('job')), 'an invite-only job is not in the feed');
select tests.throws($$select public.shift_details(pg_temp.id('job'))$$, 'NOT_FOUND',
                    'nor open to a worker without an offer');
select tests.throws($$select public.apply_to_shift(pg_temp.id('job'))$$, 'SHIFT_CLOSED',
                    'who cannot take it either');
select tests.as_admin();
select tests.eq((select count(*)::int from public.notifications
                 where kind = 'new_shift_match' and data ->> 'shift_id' = pg_temp.id('job')::text),
                0, 'and nobody gets «new shift nearby» for it');

-- Who fits: free and near first; busy at that time last; not the unfinished.
select tests.as_user('00000000-0000-0000-0000-0000000000c1');
select tests.eq(
  (select string_agg(c ->> 'first_name', ',' order by o)
   from jsonb_array_elements(public.staff_candidates(pg_temp.id('job'), 50)) with ordinality t(c, o)),
  'Aziz,Bekzod,Malika', 'free and near first, then not free then, then busy at that time');
select tests.eq(
  (select c ->> 'busy' from jsonb_array_elements(public.staff_candidates(pg_temp.id('job'), 50)) c
   where c ->> 'first_name' = 'Malika'), 'true', 'Malika is marked busy');
select tests.eq(
  (select (c ->> 'distance_km')::numeric from jsonb_array_elements(public.staff_candidates(pg_temp.id('job'), 50)) c
   where c ->> 'first_name' = 'Aziz') < 0.2, true, 'with the distance');
select tests.eq(jsonb_array_length(public.staff_candidates(pg_temp.id('job'), 5)), 2, 'within 5 km: two');
select tests.eq(
  (select string_agg(c ->> 'first_name', ',' order by o)
   from jsonb_array_elements(public.staff_candidates(pg_temp.id('job'), 50, 2)) with ordinality t(c, o)),
  'Aziz,Bekzod', 'the first two are the free ones, though Malika lives nearer than Bekzod');

-- Offers: once per worker, each with a notification.
select tests.eq(public.staff_send_offers(pg_temp.id('job'),
  array['00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2',
        '00000000-0000-0000-0000-0000000000c4']::uuid[], 'Ertalab 10 da yetib keling'), 3, 'three offers');
select tests.eq(public.staff_send_offers(pg_temp.id('job'), array['00000000-0000-0000-0000-0000000000a1']::uuid[]),
                0, 'one offer per worker');

-- a1 reads the offer and the job, and takes it.
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.eq(jsonb_array_length(public.my_notifications(100, array['job_offer'])), 1, 'a1 has the offer');
select tests.eq(public.my_notifications(100, array['job_offer']) -> 0 -> 'shift' ->> 'title', '이삿짐 운반 보조',
                'with the job on it');
select tests.eq(public.my_notifications(100, array['job_offer']) -> 0 -> 'data' ->> 'note', 'Ertalab 10 da yetib keling',
                'and the staff''s note');
select tests.eq(public.shift_details(pg_temp.id('job')) -> 'offer' ->> 'status', 'sent', 'the job opens, with the offer');
select tests.eq((public.apply_to_shift(pg_temp.id('job'))).status::text, 'pending', 'a1 takes it: the staff decide');
select tests.eq(public.shift_details(pg_temp.id('job')) -> 'offer' ->> 'status', 'applied', 'the offer is answered');
select tests.eq((select count(*)::int from public.job_offers), 1, 'a worker sees only their own offers');

-- Malika is busy then; Bekzod says «Qiziqmayman», then changes his mind.
select tests.as_user('00000000-0000-0000-0000-0000000000a2');
select tests.throws($$select public.apply_to_shift(pg_temp.id('job'))$$, 'TIME_CONFLICT', 'Malika is busy then');
select tests.as_user('00000000-0000-0000-0000-0000000000c4');
select public.decline_job_offer(pg_temp.id('job'));
select tests.throws($$select public.decline_job_offer(pg_temp.id('job'))$$, 'NOT_FOUND', 'declined once');

select tests.as_user('00000000-0000-0000-0000-0000000000c1');
select tests.eq(
  (select string_agg(o ->> 'status', ',' order by o -> 'worker' ->> 'first_name')
   from jsonb_array_elements(public.staff_shift(pg_temp.id('job')) -> 'offers') o),
  'applied,declined,sent', 'the staff see each answer');
select tests.eq(public.staff_shift(pg_temp.id('job')) -> 'notes' ->> 'source', 'https://t.me/koreajobs_uz/1234',
                'and where the job was found');
select tests.eq(public.staff_shift(pg_temp.id('job')) -> 'contact' ->> 'telegram', '@hongdae_move',
                'and how to reach the employer');
select tests.eq(
  (select (c -> 'offers' ->> 'declined')::int
   from jsonb_array_elements(public.staff_board(now(), now() + interval '7 days')) c
   where (c ->> 'id')::uuid = pg_temp.id('job')), 1, 'the board counts the answers');

select tests.as_user('00000000-0000-0000-0000-0000000000c4');
select tests.eq((public.apply_to_shift(pg_temp.id('job'))).status::text, 'pending',
                'Bekzod may still take it after declining');

-- After the call with the employer, the staff confirm both (the 사장님
-- function, as for an owner).
select tests.as_user('00000000-0000-0000-0000-0000000000c1');
insert into ids select 'app1', id from public.applications
  where shift_id = pg_temp.id('job') and worker_id = '00000000-0000-0000-0000-0000000000a1';
insert into ids select 'app4', id from public.applications
  where shift_id = pg_temp.id('job') and worker_id = '00000000-0000-0000-0000-0000000000c4';
select tests.eq((public.decide_application(pg_temp.id('app1'), true)).status::text, 'confirmed', 'staff confirm a1');
select tests.eq((public.decide_application(pg_temp.id('app4'), true)).status::text, 'confirmed', 'and Bekzod');
select tests.as_admin();
select tests.eq((select count(*)::int from public.notifications
                 where user_id = '00000000-0000-0000-0000-0000000000a1' and kind = 'application_confirmed'),
                1, 'a1 is told');

-- The staff talk to the worker (chat) and send the QR to the employer.
select tests.as_user('00000000-0000-0000-0000-0000000000c1');
insert into public.messages (application_id, body) values (pg_temp.id('app1'), '내일 10시까지 와 주세요');
select tests.ok(public.shift_qr(pg_temp.id('job')) like 'hanguk-ish:v1:%', 'the staff get the job''s QR');

-- A crewed job keeps its time; other changes go through.
select tests.throws($$select public.staff_save_shift(
  pg_temp.id('job'), pg_temp.id('biz'), '이삿짐 운반 보조', now() + interval '2 days 2 hours',
  now() + interval '2 days 6 hours', 13000, 2)$$, 'HAS_CREW', 'a crewed job keeps its time');
select public.staff_save_shift(pg_temp.id('job'), pg_temp.id('biz'), '이삿짐 운반 보조 (2층)',
  (select starts_at from public.shifts where id = pg_temp.id('job')),
  (select ends_at from public.shifts where id = pg_temp.id('job')), 13000, 2);
select tests.eq((select title from public.shifts where id = pg_temp.id('job')), '이삿짐 운반 보조 (2층)',
                'the title changes');

-- A job with only a waiting applicant moves: the applicant is let go (as
-- when an owner moves one).
insert into ids select 'job2', public.staff_save_shift(
  null, pg_temp.id('biz'), '창고 정리', now() + interval '4 days', now() + interval '4 days 3 hours', 12000, 1);
select public.staff_send_offers(pg_temp.id('job2'), array['00000000-0000-0000-0000-0000000000a2']::uuid[]);
select tests.as_user('00000000-0000-0000-0000-0000000000a2');
select public.apply_to_shift(pg_temp.id('job2'));
select tests.as_user('00000000-0000-0000-0000-0000000000c1');
select public.staff_save_shift(pg_temp.id('job2'), pg_temp.id('biz'), '창고 정리',
  now() + interval '4 days 2 hours', now() + interval '4 days 5 hours', 12000, 1);
select tests.as_admin();
select tests.eq((select data ->> 'reason' from public.notifications
                 where user_id = '00000000-0000-0000-0000-0000000000a2' and kind = 'application_rejected'
                   and data ->> 'shift_id' = pg_temp.id('job2')::text), 'time_changed',
                'a moved job lets its waiting applicant go');

-- The staff keep to their employers.
select tests.as_user('00000000-0000-0000-0000-0000000000c1');
select tests.throws($$select public.staff_save_business('10000000-0000-0000-0000-000000000001', 'x')$$, 'NOT_FOUND',
                    'a business in the app is not the staff''s to edit');
select tests.throws($$select public.staff_save_shift(null, '10000000-0000-0000-0000-000000000001', 'x',
                      now() + interval '1 day', now() + interval '1 day 2 hours', 11000, 1)$$, 'NOT_FOUND',
                    'nor to post for');
select tests.eq(public.staff_send_offers('20000000-0000-0000-0000-000000000003',
                  array['00000000-0000-0000-0000-0000000000a1']::uuid[]), 1,
                'but they may point a worker to a shift in the app');
select tests.eq(public.staff_send_offers('20000000-0000-0000-0000-000000000006',
                  array['00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000c4']::uuid[]), 1,
                'not to one who already works it');
select tests.throws($$select public.staff_send_offers('20000000-0000-0000-0000-000000000006',
                      array['00000000-0000-0000-0000-0000000000a1']::uuid[], repeat('x', 301))$$, 'INVALID',
                    'a note fits 300 characters');
select tests.throws($$select public.decide_application((select id from public.applications
                      where shift_id = '20000000-0000-0000-0000-000000000006' limit 1), true)$$, 'NOT_FOUND',
                    'and do not decide for an owner in the app');

-- The day is over. The hourly job leaves the kept job to the staff; they
-- mark who came: a1 worked 3 h 30 min, Bekzod did not come.
select tests.as_admin();
update public.shifts set starts_at = now() - interval '5 hours', ends_at = now() - interval '1 hour'
where id = pg_temp.id('job');
select public.close_finished_shifts();
select tests.eq((select string_agg(status::text, ',' order by worker_id) from public.applications
                 where shift_id = pg_temp.id('job')), 'confirmed,confirmed',
                'no automatic «kelmadi» on a job the staff keep');
select tests.as_user('00000000-0000-0000-0000-0000000000c1');
select tests.eq((public.staff_mark_attendance(pg_temp.id('app1'), true, 210)).pay_amount, 45500,
                'came: 3 h 30 min × 13 000 = 45 500');
select tests.eq((public.staff_mark_attendance(pg_temp.id('app4'), false)).status::text, 'no_show', 'Bekzod did not come');
select tests.throws($$select public.staff_mark_attendance(pg_temp.id('app1'), true)$$, 'NOT_CONFIRMED', 'marked once');
select tests.eq(public.set_shift_paid(pg_temp.id('job'), true), 1, 'the staff record the pay');
select tests.as_admin();
select tests.eq((select reliability::int from public.worker_profiles
                 where user_id = '00000000-0000-0000-0000-0000000000c4'), 80, 'not coming costs 20 points');
select tests.eq((select status::text || ' ' || worked_minutes || ' ' || (paid_at is not null)
                 from public.applications where id = pg_temp.id('app1')), 'completed 210 true',
                'a1: completed, 210 minutes, paid');
select tests.ok((select check_in_at >= (select starts_at from public.shifts where id = pg_temp.id('job'))
                 from public.applications where id = pg_temp.id('app1')), 'with times inside the job');
