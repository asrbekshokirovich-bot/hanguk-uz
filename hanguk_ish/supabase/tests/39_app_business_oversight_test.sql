-- P52: the staff watch over the businesses the 사장님 app opens without a
-- check (P50) — list, real name, suspend and let back — and one business
-- cannot flood the feed (30 shifts a day from the app).
--
-- People: c1 — staff; f1 — an owner whose business the app opened; a1 — a
-- worker of the fixtures; b1 — an owner of the fixtures (not staff).
select tests.as_admin();
insert into auth.users (id, phone) values ('00000000-0000-0000-0000-0000000000c1', '+821000000031');
insert into ish.staff_members (user_id) values ('00000000-0000-0000-0000-0000000000c1');
insert into auth.users (id, is_anonymous, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000000f1', true, '{"app": "hanguk_ish"}');

select tests.as_user('00000000-0000-0000-0000-0000000000f1');
create temp table opened as select ish.open_business() as id;
grant select on opened to authenticated;
insert into ish.shifts (business_id, title, starts_at, ends_at, hourly_wage, slots, auto_confirm)
values ((select id from opened), '홀 서빙', now() + interval '1 day', now() + interval '1 day 4 hours', 10800, 2, true);
select tests.as_admin();
create temp table s1 as select id from ish.shifts where business_id = (select id from opened);
grant select on s1 to authenticated;
-- The fixtures' businesses were opened before (one transaction: one now()).
update ish.businesses set created_at = now() - interval '1 day' where id <> (select id from opened);

-- Only the staff.
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.throws($$select ish.staff_app_businesses()$$, 'FORBIDDEN', 'a worker cannot list the app businesses');
select tests.throws($$select ish.staff_set_app_business_blocked((select id from opened), true)$$, 'FORBIDDEN',
                    'nor suspend one');
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
select tests.throws($$select ish.staff_update_app_business((select id from opened), '가짜')$$, 'FORBIDDEN',
                    'nor can an owner rename another''s business');
select tests.as_anon();
select tests.throws($$select ish.staff_app_businesses()$$, 'permission denied', 'nor anybody signed out');

-- The list: the app's businesses (the fixtures' and f1's), not the staff's own.
select tests.as_user('00000000-0000-0000-0000-0000000000c1');
create temp table kept as select ish.staff_save_business(null, '공사 현장 A') as id;
grant select on kept to authenticated;
create temp table listed as select ish.staff_app_businesses() as j;
grant select on listed to authenticated;
select tests.ok((select j @> jsonb_build_array(jsonb_build_object('id', (select id from opened)::text)) from listed),
                'the app business is on the list');
select tests.ok(not (select j @> jsonb_build_array(jsonb_build_object('id', (select id from kept)::text)) from listed),
                'the staff''s own employer is not');
select tests.eq((select (e ->> 'shifts')::int from listed, jsonb_array_elements(j) e
                 where e ->> 'id' = (select id from opened)::text), 1, 'with its shifts');
select tests.eq((select e ->> 'status' from listed, jsonb_array_elements(j) e
                 where e ->> 'id' = (select id from opened)::text), 'verified', 'open at once (P50)');
select tests.eq((select j -> 0 ->> 'id' from listed), (select id from opened)::text, 'newest first');
select tests.eq((select (e ->> 'crew')::int from listed, jsonb_array_elements(j) e
                 where e ->> 'id' = (select id from opened)::text), 0, 'nobody confirmed yet');

-- A real name and place.
select tests.eq(ish.staff_update_app_business((select id from opened), '  순대국집 신촌점 ', 'restaurant', '신촌',
                                              '마포구 신촌로 1', '1층', '{"uz": "Sundaeguk · Sinchon"}'),
                (select id from opened), 'renamed');
select tests.as_admin();
select tests.eq((select name || '|' || category || '|' || area || '|' || (name_i18n ->> 'uz')
                 from ish.businesses where id = (select id from opened)),
                '순대국집 신촌점|restaurant|신촌|Sundaeguk · Sinchon', 'the name, kind, area and the workers'' name');
-- A corrected Korean name keeps the Uzbek one typed in the same form (the
-- reset of stale translations used to drop it); other languages go stale.
update ish.businesses set name_i18n = name_i18n || '{"ru": "Сундэгук"}' where id = (select id from opened);
select tests.as_user('00000000-0000-0000-0000-0000000000c1');
select ish.staff_update_app_business((select id from opened), '순대국 신촌점', 'restaurant', '신촌',
                                     '마포구 신촌로 1', '1층', '{"uz": "Sundaeguk · Sinchon"}');
select tests.as_admin();
select tests.eq((select name_i18n from ish.businesses where id = (select id from opened)),
                '{"uz": "Sundaeguk · Sinchon"}'::jsonb, 'a new Korean name: the Uzbek one stays, the stale Russian goes');
update ish.businesses set name_i18n = name_i18n || '{"ru": "Сундэгук"}' where id = (select id from opened);
select tests.as_user('00000000-0000-0000-0000-0000000000c1');
select ish.staff_update_app_business((select id from opened), '순대국 신촌점', 'restaurant', '신촌',
                                     '마포구 신촌로 1', '1층', '{"uz": "Sundaeguk"}');
select tests.as_admin();
select tests.eq((select name_i18n from ish.businesses where id = (select id from opened)),
                '{"uz": "Sundaeguk", "ru": "Сундэгук"}'::jsonb, 'the same Korean name: only the Uzbek one changes');
select tests.as_user('00000000-0000-0000-0000-0000000000c1');
select ish.staff_update_app_business((select id from opened), '순대국 신촌점', 'restaurant', '신촌',
                                     '마포구 신촌로 1', '1층');
select tests.as_admin();
select tests.eq((select name_i18n from ish.businesses where id = (select id from opened)),
                '{"ru": "Сундэгук"}'::jsonb, 'no Uzbek name sent: it is cleared');
-- The same for the employers the staff keep (P39).
select tests.as_user('00000000-0000-0000-0000-0000000000c1');
select ish.staff_save_business((select id from kept), '공사 현장 A', 'logistics', p_name_i18n => '{"uz": "Qurilish A"}');
select ish.staff_save_business((select id from kept), '공사 현장 B', 'logistics', p_name_i18n => '{"uz": "Qurilish A"}');
select tests.as_admin();
select tests.eq((select name || '|' || (name_i18n ->> 'uz') from ish.businesses where id = (select id from kept)),
                '공사 현장 B|Qurilish A', 'a kept employer renamed in Korean keeps its Uzbek name');
select tests.as_user('00000000-0000-0000-0000-0000000000c1');
select tests.throws($$select ish.staff_update_app_business((select id from opened), '  ')$$, 'INVALID',
                    'not to an empty name');
select tests.throws($$select ish.staff_update_app_business((select id from kept), '다른 이름')$$, 'NOT_FOUND',
                    'the staff''s own employers are saved with staff_save_business');

-- a1 takes the shift (auto-confirmed): the staff see one worker on it.
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select ish.apply_to_shift((select id from s1));
select tests.as_user('00000000-0000-0000-0000-0000000000c1');
select tests.eq((select (e ->> 'crew')::int from jsonb_array_elements(ish.staff_app_businesses()) e
                 where e ->> 'id' = (select id from opened)::text), 1, 'a confirmed worker on its shift');

-- Suspended: out of the feed, nobody can apply, no new shift; let back: in again.
select tests.eq(ish.staff_set_app_business_blocked((select id from opened), true), 'rejected', 'suspended');
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.ok(not exists (
  select 1 from jsonb_array_elements(ish.shift_feed(now(), now() + interval '3 days')) e
  where e ->> 'id' = (select id from s1)::text), 'the suspended business''s shift leaves the feed');
select tests.as_user('00000000-0000-0000-0000-0000000000a2');
select tests.throws($$select ish.apply_to_shift((select id from s1))$$, 'SHIFT_CLOSED',
                    'and nobody can apply');
select tests.as_user('00000000-0000-0000-0000-0000000000f1');
select tests.throws($$insert into ish.shifts (business_id, title, starts_at, ends_at, hourly_wage, slots)
                      values ((select id from opened), 'x', now() + interval '2 days', now() + interval '2 days 2 hours', 10800, 1)$$,
                    'BUSINESS_NOT_VERIFIED', 'the owner cannot post while suspended');
select tests.as_user('00000000-0000-0000-0000-0000000000c1');
select tests.eq(ish.staff_set_app_business_blocked((select id from opened), false), 'verified', 'let back');
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.ok(exists (
  select 1 from jsonb_array_elements(ish.shift_feed(now(), now() + interval '3 days')) e
  where e ->> 'id' = (select id from s1)::text), 'its shift is in the feed again');
select tests.as_user('00000000-0000-0000-0000-0000000000c1');
select tests.throws($$select ish.staff_set_app_business_blocked((select id from kept), true)$$, 'NOT_FOUND',
                    'the staff''s own employers are not suspended this way');
select tests.throws($$select ish.staff_set_app_business_blocked((select id from opened), null)$$, 'INVALID',
                    'a yes or a no');

-- 30 shifts a day from the app; the 31st waits (the first was posted above).
select tests.as_user('00000000-0000-0000-0000-0000000000f1');
insert into ish.shifts (business_id, title, starts_at, ends_at, hourly_wage, slots)
select (select id from opened), '보조 ' || g, now() + make_interval(days => 2, hours => g),
       now() + make_interval(days => 2, hours => g + 1), 10800, 1
from generate_series(1, 29) g;
select tests.as_admin();
select tests.eq((select count(*)::int from ish.shifts where business_id = (select id from opened)), 30,
                'thirty in a day');
select tests.as_user('00000000-0000-0000-0000-0000000000f1');
select tests.throws($$insert into ish.shifts (business_id, title, starts_at, ends_at, hourly_wage, slots)
                      values ((select id from opened), 'x', now() + interval '3 days', now() + interval '3 days 2 hours', 10800, 1)$$,
                    'TOO_MANY_REQUESTS', 'the 31st in a day is refused');
-- The staff's own jobs are not counted against them.
select tests.as_user('00000000-0000-0000-0000-0000000000c1');
select tests.ok(ish.staff_save_shift(null, (select id from kept), '현장 정리', now() + interval '1 day',
                                     now() + interval '1 day 4 hours', 12000, 3) is not null,
                'the staff post for their employer as before');
-- A day later the owner posts again.
select tests.as_admin();
update ish.shifts set created_at = created_at - interval '25 hours' where business_id = (select id from opened);
select tests.as_user('00000000-0000-0000-0000-0000000000f1');
insert into ish.shifts (business_id, title, starts_at, ends_at, hourly_wage, slots)
values ((select id from opened), '다음 날', now() + interval '4 days', now() + interval '4 days 2 hours', 10800, 1);
select tests.as_admin();
select tests.eq((select count(*)::int from ish.shifts where business_id = (select id from opened)), 31,
                'the next day: room again');
