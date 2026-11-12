-- What the apps receive, captured from the real functions: one JSON object
-- {name: response} that the Dart parsing tests read
-- (hanguk_ish/test/fixtures/backend_samples.json). Regenerate after changing
-- a function's output:
--
--   supabase/tests/json_samples.sh     (needs the same database as run.sh)
--
-- Runs on the test database after tests/fixtures.sql, inside a transaction
-- that is rolled back. Values are shaped as PostgREST returns them: jsonb
-- functions as they are, table functions and rows as arrays of objects.

create temp table samples (name text primary key, value jsonb not null);
grant all on samples to authenticated;

select tests.as_admin();
update ish.businesses
set area = '신촌', address = '마포구 신촌로12길 15', address_detail = '2층',
    name_i18n = '{"uz": "Dalbit Kafe", "ru": "Кафе Дальбит", "en": "Dalbit Cafe", "ko": "달빛카페"}',
    translations = '{"uz": {"area": "Sinchon", "address": "Mapo-gu, Sinchon-ro 12-gil 15", "address_detail": "2-qavat"},
                     "ru": {"area": "Синчон", "address": "Мапо-гу, Синчон-ро 12-гиль 15", "address_detail": "2 этаж"},
                     "en": {"area": "Sinchon", "address": "15 Sinchon-ro 12-gil, Mapo-gu", "address_detail": "2F"}}',
    logo_path = '10000000-0000-0000-0000-000000000001/logo.png',
    photo_path = '10000000-0000-0000-0000-000000000001/photo.jpg'
where id = '10000000-0000-0000-0000-000000000001';
update ish.shifts
set dress = '검은색 바지, 운동화', address = '마포구 신촌로12길 15, 2층',
    duties = E'주문 접수\n음료 보조\n홀 정리',
    translations = '{"uz": {"title": "Zal va kassa yordamchisi", "duties": "Buyurtma qabul qilish\nIchimliklar\nZalni tartibga solish", "dress": "Qora shim, krossovka", "address": "Mapo-gu, Sinchon-ro 12-gil 15, 2-qavat"}}'
where id = '20000000-0000-0000-0000-000000000001';
insert into ish.shift_templates (id, business_id, title, duties, dress, address, start_time, end_time, hourly_wage, slots)
values ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '홀·카운터 보조',
        '주문 접수 · 음료 보조 · 홀 정리', '검은색 바지, 운동화 (앞치마 제공)', '마포구 신촌로12길 15, 2층',
        '14:00', '19:00', 10500, 3),
       ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '마감 정리 보조',
        '', '', '', null, null, null, null);

-- History: a2 finished s7 (rated both ways, paid) and is a favourite.
update ish.applications
set status = 'completed', check_in_at = now() - interval '7 hours 3 minutes', late_minutes = 0,
    check_out_at = now() - interval '58 minutes', worked_minutes = 360, pay_amount = 66000, paid_at = now()
where id = '30000000-0000-0000-0000-000000000075';
insert into ish.ratings (application_id, direction, rater_id, stars, tags) values
  ('30000000-0000-0000-0000-000000000075', 'worker_to_business', '00000000-0000-0000-0000-0000000000a2', 5,
   '{on_time,polite,would_return}'),
  ('30000000-0000-0000-0000-000000000075', 'business_to_worker', '00000000-0000-0000-0000-0000000000b1', 5, '{}');
insert into ish.favorites (business_id, worker_id)
values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a2');

-- Today: a1 applies to s2 (waits), a3 is onboarded and takes s3 then cancels.
update ish.worker_profiles set onboarded_at = now() where user_id = '00000000-0000-0000-0000-0000000000a3';
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
insert into samples values ('apply_to_shift', to_jsonb(ish.apply_to_shift('20000000-0000-0000-0000-000000000002')));
select tests.as_user('00000000-0000-0000-0000-0000000000a3');
select ish.apply_to_shift('20000000-0000-0000-0000-000000000003');
select ish.cancel_application((select id from ish.applications
                                  where shift_id = '20000000-0000-0000-0000-000000000003'
                                    and worker_id = '00000000-0000-0000-0000-0000000000a3'));
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
insert into ish.messages (application_id, body, lang)
values ('30000000-0000-0000-0000-000000000004', 'Salom, 10 daqiqada yetib boraman', 'uz');
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
insert into ish.messages (application_id, body, lang)
values ('30000000-0000-0000-0000-000000000004', '네, 기다릴게요', 'ko');
select tests.as_admin();
update ish.messages set translations = '{"uz": "Xo''p, kutamiz"}' where body = '네, 기다릴게요';

-- Worker notifications of every kind (reminders and digests come from jobs).
insert into ish.notifications (user_id, kind, data, created_at) values
  ('00000000-0000-0000-0000-0000000000a1', 'shift_reminder',
   '{"shift_id": "20000000-0000-0000-0000-000000000004", "application_id": "30000000-0000-0000-0000-000000000004", "minutes_before": 120}',
   now() - interval '1 minute'),
  ('00000000-0000-0000-0000-0000000000a1', 'new_shift_match',
   '{"shift_id": "20000000-0000-0000-0000-000000000006", "distance_km": 3.8}', now() - interval '1 day'),
  ('00000000-0000-0000-0000-0000000000a1', 'nearby_digest',
   '{"count": 3, "area": "홍대", "area_i18n": {"uz": "Hongdae", "ru": "Хондэ", "en": "Hongdae"}, "categories": ["cafe", "retail"], "wage_min": 10500, "wage_max": 11500, "lat": 37.5563, "lng": 126.9236}',
   now() - interval '1 day 3 hours'),
  ('00000000-0000-0000-0000-0000000000a1', 'payment_marked',
   '{"application_id": "30000000-0000-0000-0000-000000000075", "shift_id": "20000000-0000-0000-0000-000000000007", "paid": true}',
   now() - interval '2 days'),
  ('00000000-0000-0000-0000-0000000000a1', 'request_again',
   '{"shift_id": "20000000-0000-0000-0000-000000000001", "business_id": "10000000-0000-0000-0000-000000000001"}',
   now() - interval '3 days');

-- a1 was confirmed on s7 and never came: the upkeep job marks the no-show.
insert into ish.applications (id, shift_id, worker_id, status, decided_at)
values ('30000000-0000-0000-0000-000000000071', '20000000-0000-0000-0000-000000000007',
        '00000000-0000-0000-0000-0000000000a1', 'confirmed', now() - interval '3 days');
select ish.close_finished_shifts();

-- The business decides.
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
select ish.decide_application((select id from ish.applications
                                  where shift_id = '20000000-0000-0000-0000-000000000002'
                                    and worker_id = '00000000-0000-0000-0000-0000000000a1'), true);

-- Hanguk's staff (P39, hanguk.uz): an employer found on Telegram, an
-- invite-only job tomorrow, offers to a1 (open) and a2 (who turns it down).
select tests.as_admin();
insert into auth.users (id, phone) values ('00000000-0000-0000-0000-0000000000c1', '+821000000031');
update ish.profiles set first_name = 'Dilnoza', last_name = 'Rahimova'
where id = '00000000-0000-0000-0000-0000000000c1';
insert into ish.staff_members (user_id) values ('00000000-0000-0000-0000-0000000000c1');
create temp table staff_ids (k text primary key, v uuid);
grant all on staff_ids to authenticated;
select tests.as_user('00000000-0000-0000-0000-0000000000c1');
insert into staff_ids select 'biz', ish.staff_save_business(
  null, '홍대 이삿짐센터', 'logistics', '홍대', '마포구 와우산로 21', '1층', 'Mapo-gu', 37.5560, 126.9230,
  '{"uz": "Hongdae ko''chish xizmati"}',
  '{"contact_name": "김사장", "phone": "010-5555-1234", "telegram": "@hongdae_move",
    "source": "https://t.me/koreajobs_uz/1234", "notes": "Naqd to''laydi"}');
insert into staff_ids select 'job', ish.staff_save_shift(
  null, (select v from staff_ids where k = 'biz'), '이삿짐 운반 보조',
  date_trunc('hour', now()) + interval '1 day 2 hours', date_trunc('hour', now()) + interval '1 day 6 hours',
  13000, 2, E'짐 나르기\n포장 보조', '편한 옷, 운동화', '마포구 와우산로 21', null, null, false, true,
  'https://t.me/koreajobs_uz/1234', '오전 10시까지 도착');
select ish.staff_send_offers((select v from staff_ids where k = 'job'),
  array['00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2']::uuid[],
  'Ertalab 10 da yetib keling');
select tests.as_user('00000000-0000-0000-0000-0000000000a2');
select ish.decline_job_offer((select v from staff_ids where k = 'job'));

-- Worker side.
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
insert into samples values
  ('shift_feed', ish.shift_feed(now(), now() + interval '4 days', 37.5580, 126.9501)),
  ('shift_details', ish.shift_details('20000000-0000-0000-0000-000000000001', 37.5580, 126.9501)),
  ('my_shifts_a1', ish.my_shifts()),
  ('my_shift', ish.my_shift('30000000-0000-0000-0000-000000000004')),
  ('my_notifications_worker', ish.my_notifications(100, '{shift_reminder,application_confirmed,application_rejected,new_shift_match,nearby_digest,request_again,chat_message,payment_marked}')),
  ('my_profile_worker', ish.my_profile()),
  ('worker_stats', (select jsonb_agg(to_jsonb(s)) from ish.worker_stats('00000000-0000-0000-0000-0000000000a1') s)),
  ('messages', (select jsonb_agg(to_jsonb(m) order by m.created_at, m.id) from ish.messages m
                where m.application_id = '30000000-0000-0000-0000-000000000004')),
  ('shift_details_offer', ish.shift_details((select v from staff_ids where k = 'job'), 37.5580, 126.9501)),
  ('my_notifications_offer', ish.my_notifications(100, '{job_offer}'));
select tests.as_user('00000000-0000-0000-0000-0000000000a2');
insert into samples values
  ('shift_details_offer_declined', ish.shift_details((select v from staff_ids where k = 'job'))),
  ('my_shifts_a2', ish.my_shifts()),
  ('worker_earnings', (select jsonb_agg(to_jsonb(e)) from ish.worker_earnings(
      (now() at time zone 'Asia/Seoul')::date - 7, (now() at time zone 'Asia/Seoul')::date + 1) e));
select tests.as_user('00000000-0000-0000-0000-0000000000a3');
insert into samples values ('my_profile_new', ish.my_profile());

-- Employer side.
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
insert into samples values
  ('my_businesses', ish.my_businesses()),
  ('business_board', ish.business_board('10000000-0000-0000-0000-000000000001', now() - interval '1 day', now() + interval '4 days')),
  ('employer_shift', ish.employer_shift('20000000-0000-0000-0000-000000000005')),
  ('business_workers', ish.business_workers('10000000-0000-0000-0000-000000000001')),
  ('business_report', (select jsonb_agg(to_jsonb(r)) from ish.business_report('10000000-0000-0000-0000-000000000001',
      (now() at time zone 'Asia/Seoul')::date - 7, (now() at time zone 'Asia/Seoul')::date + 1) r)),
  ('shift_templates', (select jsonb_agg(to_jsonb(t) order by t.created_at, t.id) from ish.shift_templates t
                       where t.business_id = '10000000-0000-0000-0000-000000000001')),
  ('my_notifications_employer', ish.my_notifications(100, '{new_applicant,worker_cancelled,no_show,chat_message}')),
  ('minimum_wage', to_jsonb(ish.minimum_wage(now()))),
  ('shift_qr', to_jsonb(ish.shift_qr('20000000-0000-0000-0000-000000000004')));

-- P50/P52: two owners who started without a number; the staff named the
-- second one's business and suspended it.
select tests.as_admin();
insert into auth.users (id, is_anonymous, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000f1', true, '{"app": "hanguk_ish"}'),
  ('00000000-0000-0000-0000-0000000000f2', true, '{"app": "hanguk_ish"}');
select tests.as_user('00000000-0000-0000-0000-0000000000f1');
insert into staff_ids select 'app_biz', ish.open_business();
select tests.as_user('00000000-0000-0000-0000-0000000000f2');
insert into staff_ids select 'app_biz_2', ish.open_business();
select tests.as_user('00000000-0000-0000-0000-0000000000c1');
select ish.staff_update_app_business((select v from staff_ids where k = 'app_biz_2'), '순대국집 신촌점', 'restaurant',
                                     '신촌', '마포구 신촌로 1', '1층', '{"uz": "Sundaeguk · Sinchon"}');
select ish.staff_set_app_business_blocked((select v from staff_ids where k = 'app_biz_2'), true);

-- hanguk.uz (CRM «Hanguk Ish»).
select tests.as_user('00000000-0000-0000-0000-0000000000c1');
insert into samples values
  ('staff_businesses', ish.staff_businesses()),
  ('staff_board', ish.staff_board(now() - interval '1 day', now() + interval '4 days')),
  ('staff_shift', ish.staff_shift((select v from staff_ids where k = 'job'))),
  ('staff_candidates', ish.staff_candidates((select v from staff_ids where k = 'job'), 20)),
  ('staff_app_businesses', ish.staff_app_businesses());

select tests.as_admin();
select jsonb_pretty(jsonb_object_agg(name, value order by name)) from samples;
