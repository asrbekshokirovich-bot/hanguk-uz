-- What the apps read as JSON (P7b): shift cards, my shifts, notifications,
-- the profile, the owner's businesses; the new business columns and the
-- posting rule for unverified businesses.

-- biz1 as the worker screens show it.
select tests.as_admin();
update public.businesses
set area = '신촌', address = '마포구 신촌로12길 15', address_detail = '2층',
    name_i18n = '{"uz": "Dalbit Kafe", "en": "Dalbit Cafe"}',
    translations = '{"uz": {"area": "Sinchon", "address": "Mapo-gu, Sinchon-ro 12-gil 15", "address_detail": "2-qavat"}}',
    logo_path = '10000000-0000-0000-0000-000000000001/logo.png'
where id = '10000000-0000-0000-0000-000000000001';

-- A03 card: the shift, its business and the caller's view.
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.eq((select c -> 'business' ->> 'area'
                 from jsonb_array_elements(public.shift_feed(now(), now() + interval '4 days')) c
                 where c ->> 'id' = '20000000-0000-0000-0000-000000000001'), '신촌', 'the neighbourhood');
select tests.eq((select c -> 'business' -> 'translations' -> 'uz' ->> 'address_detail'
                 from jsonb_array_elements(public.shift_feed(now(), now() + interval '4 days')) c
                 where c ->> 'id' = '20000000-0000-0000-0000-000000000001'), '2-qavat', 'the floor in Uzbek');
select tests.eq((select c ->> 'duties'
                 from jsonb_array_elements(public.shift_feed(now(), now() + interval '4 days')) c
                 where c ->> 'id' = '20000000-0000-0000-0000-000000000001'), '주문 접수', 'duties on the card');
select tests.eq((select (c ->> 'auto_confirm')::boolean
                 from jsonb_array_elements(public.shift_feed(now(), now() + interval '4 days')) c
                 where c ->> 'id' = '20000000-0000-0000-0000-000000000002'), false, 's2 waits for the business');
select tests.eq((select (c -> 'business' ->> 'rating_count')::int
                 from jsonb_array_elements(public.shift_feed(now(), now() + interval '4 days')) c
                 where c ->> 'id' = '20000000-0000-0000-0000-000000000001'), 0, 'no ratings yet');
select tests.ok((select c -> 'business' -> 'rating' = 'null'::jsonb
                 from jsonb_array_elements(public.shift_feed(now(), now() + interval '4 days')) c
                 where c ->> 'id' = '20000000-0000-0000-0000-000000000001'), 'rating is null before the first one');
select tests.eq((select c ->> 'my_application_id'
                 from jsonb_array_elements(public.shift_feed(now(), now() + interval '4 days')) c
                 where c ->> 'id' = '20000000-0000-0000-0000-000000000004'),
                '30000000-0000-0000-0000-000000000004', 'my application on the card');
select tests.eq((select c ->> 'id' from jsonb_array_elements(public.shift_feed(now(), now() + interval '4 days')) c
                 limit 1), '20000000-0000-0000-0000-000000000004', 'without a position, the earliest first');

-- A05: one card.
select tests.eq(public.shift_details('20000000-0000-0000-0000-000000000003') ->> 'title', '오픈 바리스타 보조', 'details');
select tests.throws($$select public.shift_details('20000000-0000-0000-0000-000000000008')$$, 'NOT_FOUND',
                    'not a shift of an unverified business');
select tests.as_user('00000000-0000-0000-0000-0000000000b2');
select tests.eq(public.shift_details('20000000-0000-0000-0000-000000000008') ->> 'title', '주방 보조',
                'its owner sees it');

-- a1 takes s1; the business calls s1 off; a1 still sees it, a2 does not.
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select public.apply_to_shift('20000000-0000-0000-0000-000000000001');
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
select public.cancel_shift('20000000-0000-0000-0000-000000000001');
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.eq(public.shift_details('20000000-0000-0000-0000-000000000001') ->> 'status', 'cancelled',
                'a cancelled shift I held');
select tests.eq(public.shift_details('20000000-0000-0000-0000-000000000001') ->> 'my_status', 'rejected',
                'my application went with it');
select tests.as_user('00000000-0000-0000-0000-0000000000a2');
select tests.throws($$select public.shift_details('20000000-0000-0000-0000-000000000001')$$, 'NOT_FOUND',
                    'a cancelled shift is gone for others');

-- A06: a2's applications, the earliest shift first (s7, s5, s6).
select tests.eq(jsonb_array_length(public.my_shifts()), 3, 'three applications');
select tests.eq((select string_agg(c -> 'shift' ->> 'title', ' / ' order by o)
                 from jsonb_array_elements(public.my_shifts()) with ordinality as t(c, o)),
                '주말 브런치 보조 / 마감 정리 보조 / 홀·카운터 보조', 'in shift order');
select tests.eq((public.my_shifts() -> 1 ->> 'late_minutes')::int, 2, 'checked in 2 minutes late on s5');

-- A07 → A08: a2 finishes s5 and rates it; the card carries the rating.
select tests.as_admin();
update public.applications set status = 'completed', check_out_at = now(), worked_minutes = 180, pay_amount = 36000
  where id = '30000000-0000-0000-0000-000000000005';
select tests.as_user('00000000-0000-0000-0000-0000000000a2');
select public.rate_business('30000000-0000-0000-0000-000000000005', 4, '{polite,on_time}');
select tests.eq((public.my_shift('30000000-0000-0000-0000-000000000005') ->> 'my_stars')::int, 4, 'my stars');
select tests.ok(public.my_shift('30000000-0000-0000-0000-000000000005') -> 'my_tags' ? 'polite', 'my tags');
select tests.eq((public.my_shift('30000000-0000-0000-0000-000000000005') ->> 'pay_amount')::int, 36000, 'the pay');
select tests.eq((public.my_shift('30000000-0000-0000-0000-000000000005') -> 'shift' -> 'business' ->> 'rating')::numeric,
                4.0, 'the business rating counts it');
select tests.throws($$select public.my_shift('30000000-0000-0000-0000-000000000004')$$, 'NOT_FOUND',
                    'someone else''s application');

-- Notifications: a1 applies to s2, the owner sees who; a1 hears back.
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select public.apply_to_shift('20000000-0000-0000-0000-000000000002');
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
select tests.eq(public.my_notifications(10, '{new_applicant}') -> 0 -> 'worker' ->> 'first_name', 'Aziz',
                'the bell names the applicant');
select tests.eq(public.my_notifications(10, '{new_applicant}') -> 0 -> 'shift' ->> 'title', '마감 정리 보조',
                'and the shift');
select public.decide_application(
  (select id from public.applications where shift_id = '20000000-0000-0000-0000-000000000002'
     and worker_id = '00000000-0000-0000-0000-0000000000a1'), true);
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.eq(jsonb_array_length(public.my_notifications(10, '{application_confirmed}')), 1, 'confirmed');
select tests.eq(public.my_notifications(10, '{application_confirmed}') -> 0 -> 'business' -> 'translations' -> 'uz' ->> 'area',
                'Sinchon', 'the business as the worker reads it');
select tests.ok(public.my_notifications(10, '{application_confirmed}') -> 0 -> 'shift' ? 'starts_at', 'with the time');
select tests.eq(public.my_notifications(10, '{application_rejected}') -> 0 -> 'data' ->> 'reason', 'shift_cancelled',
                'the cancelled s1');
select tests.eq(jsonb_array_length(public.my_notifications(10, '{new_applicant}')), 0, 'only my own');
select tests.ok(public.mark_notifications_read('{application_confirmed}') = 1, 'marks one kind read');
select tests.eq((select count(*)::int from public.notifications where read_at is null), 1,
                'the other kind stays unread');
select tests.ok(public.mark_notifications_read() = 1, 'then the rest');
select tests.eq(public.mark_notifications_read(), 0, 'nothing left');

-- A10: a message tells the other side once until it is read.
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
insert into public.messages (application_id, body) values ('30000000-0000-0000-0000-000000000004', 'Salom');
insert into public.messages (application_id, body) values ('30000000-0000-0000-0000-000000000004', 'Yo''ldaman');
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
select tests.eq(jsonb_array_length(public.my_notifications(10, '{chat_message}')), 1, 'one notice for two messages');
select tests.eq(public.my_notifications(10, '{chat_message}') -> 0 -> 'worker' ->> 'last_name', 'Karimov',
                'from whom');
insert into public.messages (application_id, body) values ('30000000-0000-0000-0000-000000000004', '네');
select tests.eq(jsonb_array_length(public.my_notifications(10, '{chat_message}')), 1, 'not for my own reply');
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.eq(public.my_notifications(10, '{chat_message}') -> 0 -> 'business' ->> 'name', '달빛카페 신촌점',
                'the worker hears back');
select public.mark_notifications_read('{chat_message}');
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
insert into public.messages (application_id, body) values ('30000000-0000-0000-0000-000000000004', '천천히 오세요');
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.eq(jsonb_array_length(public.my_notifications(10, '{chat_message}')), 2, 'a new notice once read');

-- A02: Timur finishes his profile and can take shifts.
select tests.as_user('00000000-0000-0000-0000-0000000000a3');
select tests.ok(public.my_profile() -> 'worker' -> 'onboarded_at' = 'null'::jsonb, 'not onboarded yet');
select tests.throws($$select public.save_worker_profile(' ', 'Kim', '{ru}', 6, null, 'Mapo-gu', 0, null)$$,
                    'NAME_REQUIRED', 'names first');
select tests.throws($$select public.save_worker_profile('Timur', 'Kim', '{}', 6, null, 'Mapo-gu', 0, null)$$,
                    'LANGUAGES_REQUIRED', 'a language');
select tests.throws($$select public.save_worker_profile('Timur', 'Kim', '{ru}', 6, null, '', 0, null)$$,
                    'DISTRICT_REQUIRED', 'a district');
select tests.throws($$select public.save_worker_profile('Timur', 'Kim', '{ru}', 6, null, 'Mapo-gu', 0, null,
                      '00000000-0000-0000-0000-0000000000a1/x.jpg')$$, 'INVALID', 'only a photo in my folder');
select tests.throws($$select public.save_worker_profile('Timur', 'Kim', '{ru,xx}', 6, null, 'Mapo-gu', 0, null)$$,
                    'worker_profiles_languages_check', 'known languages');
select tests.eq(public.save_worker_profile(' Timur ', 'Kim', '{ru,ko,en}', 6, ' ', 'Mapo-gu', 7, 'D-2',
                  '00000000-0000-0000-0000-0000000000a3/avatar-1.jpg') ->> 'first_name', 'Timur', 'saved, trimmed');
select tests.ok(public.my_profile() -> 'worker' ->> 'onboarded_at' is not null, 'onboarded');
select tests.eq(public.my_profile() -> 'worker' -> 'languages', '["ru", "ko", "en"]'::jsonb, 'languages in order');
select tests.ok(public.my_profile() -> 'worker' -> 'university' = 'null'::jsonb, 'a blank university is none');
select tests.eq(public.my_profile() ->> 'avatar_path', '00000000-0000-0000-0000-0000000000a3/avatar-1.jpg', 'the photo');
select tests.eq((public.apply_to_shift('20000000-0000-0000-0000-000000000003')).status::text, 'confirmed',
                'and takes a shift');
select public.save_worker_profile('Timur', 'Kim', '{ru}', 5, 'Yonsei', 'Seodaemun-gu', 0, null);
select tests.eq(public.my_profile() ->> 'avatar_path', '00000000-0000-0000-0000-0000000000a3/avatar-1.jpg',
                'saving again keeps the photo');
select tests.eq(public.my_profile() -> 'worker' ->> 'university', 'Yonsei', 'and updates the rest');

-- Someone who signed in and never had a worker row.
select tests.as_admin();
insert into auth.users (id, phone) values ('00000000-0000-0000-0000-0000000000a4', '+821000000004');
select tests.as_user('00000000-0000-0000-0000-0000000000a4');
select tests.ok(public.my_profile() -> 'worker' = 'null'::jsonb, 'no worker profile');
select tests.eq(public.save_worker_profile('Aruzhan', 'Bekova', '{kk,ru}', 0, null, 'Mapo-gu', 0, null)
                  -> 'worker' ->> 'topik', '0', 'created on the first save');

-- BA1: the owner's businesses.
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
select tests.eq(public.my_businesses() -> 0 ->> 'role', 'owner', 'b1 owns biz1');
select tests.eq(public.my_businesses() -> 0 ->> 'status', 'verified', 'verified');
select tests.eq(public.my_profile() ->> 'businesses', '1', 'the profile counts it');
select tests.as_user('00000000-0000-0000-0000-0000000000b2');
select tests.eq(public.my_businesses() -> 0 ->> 'status', 'pending', 'biz2 waits for 국세청');
select tests.throws($$insert into public.shifts (business_id, title, starts_at, ends_at, hourly_wage, slots)
                      values ('10000000-0000-0000-0000-000000000002', '주방', now() + interval '1 day',
                              now() + interval '1 day 4 hours', 10800, 1)$$,
                    'BUSINESS_NOT_VERIFIED', 'a pending business cannot post');
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.eq(public.my_businesses(), '[]'::jsonb, 'a worker runs none');

-- A new Korean text clears the old translations.
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
update public.businesses set area = '홍대' where id = '10000000-0000-0000-0000-000000000001';
select tests.as_admin();
select tests.eq((select translations from public.businesses where id = '10000000-0000-0000-0000-000000000001'),
                '{}'::jsonb, 'translations reset');
select tests.eq((select name_i18n -> 'uz' from public.businesses where id = '10000000-0000-0000-0000-000000000001'),
                '"Dalbit Kafe"'::jsonb, 'the name keeps its translations');

-- A11 report subjects.
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
insert into public.reports (reason, body) values ('safety', 'Sirpanchiq pol');
select tests.throws($$insert into public.reports (reason, body) values ('bogus', '')$$, 'reports_reason_check',
                    'only known subjects');

-- Signed out: nothing.
select tests.as_anon();
select tests.throws($$select public.my_shifts()$$, 'permission denied', 'signed out');
select tests.throws($$select public.shift_feed(now(), now() + interval '1 day')$$, 'permission denied', 'no feed');
select tests.throws($$select public.shift_card('20000000-0000-0000-0000-000000000002')$$, 'permission denied',
                    'building blocks are internal');
