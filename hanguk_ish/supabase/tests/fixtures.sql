-- Shared test data, loaded inside each test file's transaction (rolled back
-- afterwards). Times are relative to now(), which is fixed for the whole
-- transaction.
--
-- People
--   a1 Aziz   — worker, onboarded       b1 Seoyeon — owner of biz1 (verified)
--   a2 Malika — worker, onboarded       b2 Minjun  — owner of biz2 (pending)
--   a3 Timur  — worker, NOT onboarded
select tests.as_admin();

insert into auth.users (id, phone) values
  ('00000000-0000-0000-0000-0000000000a1', '+821000000001'),
  ('00000000-0000-0000-0000-0000000000a2', '+821000000002'),
  ('00000000-0000-0000-0000-0000000000a3', '+821000000003'),
  ('00000000-0000-0000-0000-0000000000b1', '+821000000011'),
  ('00000000-0000-0000-0000-0000000000b2', '+821000000012');

update public.profiles set first_name = 'Aziz', last_name = 'Karimov' where id = '00000000-0000-0000-0000-0000000000a1';
update public.profiles set first_name = 'Malika', last_name = 'Yusupova' where id = '00000000-0000-0000-0000-0000000000a2';
update public.profiles set first_name = 'Timur', last_name = 'Kim' where id = '00000000-0000-0000-0000-0000000000a3';
update public.profiles set first_name = '서연', last_name = '김', language = 'ko' where id = '00000000-0000-0000-0000-0000000000b1';
update public.profiles set first_name = '민준', last_name = '이', language = 'ko' where id = '00000000-0000-0000-0000-0000000000b2';

insert into public.worker_profiles (user_id, languages, topik, university, district, availability, onboarded_at) values
  ('00000000-0000-0000-0000-0000000000a1', '{uz,ru,en,ko}', 4, 'Sogang', 'Mapo-gu', 268435455, now()),
  ('00000000-0000-0000-0000-0000000000a2', '{uz,ru,ko}', 5, null, 'Mapo-gu', 268435455, now()),
  ('00000000-0000-0000-0000-0000000000a3', '{ru,ko}', 6, null, null, 0, null);

insert into public.businesses (id, owner_id, name, name_i18n, biz_no, nts_status, status, category, address, district, lat, lng) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1', '달빛카페 신촌점',
   '{"uz": "Dalbit Kafe · Sinchon"}', '1234567890', '01', 'verified', 'cafe',
   '마포구 신촌로12길 15, 2층', 'Mapo-gu', 37.5559, 126.9368),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000b2', '이음식당',
   '{}', '2234567890', null, 'pending', 'restaurant', '', null, null, null);

insert into public.business_members (business_id, user_id, role) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1', 'owner'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000b2', 'owner');

-- Shifts of biz1 (all at 10 500 원/h unless noted).
insert into public.shifts (id, business_id, title, duties, starts_at, ends_at, hourly_wage, slots, auto_confirm, lat, lng) values
  -- s1: in two days, 5 h, 2 slots, confirms at once.
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '홀·카운터 보조', '주문 접수',
   now() + interval '2 days', now() + interval '2 days 5 hours', 10500, 2, true, 37.5559, 126.9368),
  -- s2: in three days, 1 slot, the business decides.
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '마감 정리 보조', '',
   now() + interval '3 days', now() + interval '3 days 4 hours', 11000, 1, false, null, null),
  -- s3: overlaps s1 by an hour.
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '오픈 바리스타 보조', '',
   now() + interval '2 days 4 hours', now() + interval '2 days 8 hours', 10500, 3, true, null, null),
  -- s4: starts in 20 minutes (QR open), ends in 5 h 20 min.
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '홀·카운터 보조', '',
   now() + interval '20 minutes', now() + interval '5 hours 20 minutes', 10500, 3, true, null, null),
  -- s5: started 3 h ago, ends in 2 h.
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', '마감 정리 보조', '',
   now() - interval '3 hours', now() + interval '2 hours', 12000, 3, false, null, null),
  -- s6: starts in 2 h (QR not open yet).
  ('20000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', '홀·카운터 보조', '',
   now() + interval '2 hours', now() + interval '6 hours', 10500, 2, true, null, null),
  -- s7: ended an hour ago.
  ('20000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001', '주말 브런치 보조', '',
   now() - interval '7 hours', now() - interval '1 hour', 11000, 4, true, null, null);

-- s8: belongs to the pending business (invisible to workers).
insert into public.shifts (id, business_id, title, starts_at, ends_at, hourly_wage, slots, auto_confirm) values
  ('20000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000002', '주방 보조',
   now() + interval '2 days', now() + interval '2 days 4 hours', 10500, 2, true);

-- Workers already on the running shifts (as the apply flow would have left them).
insert into public.applications (id, shift_id, worker_id, status, decided_at) values
  ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004',
   '00000000-0000-0000-0000-0000000000a1', 'confirmed', now() - interval '1 day'),
  ('30000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000006',
   '00000000-0000-0000-0000-0000000000a2', 'confirmed', now() - interval '1 day'),
  ('30000000-0000-0000-0000-000000000075', '20000000-0000-0000-0000-000000000007',
   '00000000-0000-0000-0000-0000000000a2', 'confirmed', now() - interval '2 days');

insert into public.applications (id, shift_id, worker_id, status, decided_at, check_in_at, late_minutes) values
  -- a2 checked in 2 minutes late on s5.
  ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000005',
   '00000000-0000-0000-0000-0000000000a2', 'checked_in', now() - interval '1 day',
   now() - interval '2 hours 58 minutes', 2);
