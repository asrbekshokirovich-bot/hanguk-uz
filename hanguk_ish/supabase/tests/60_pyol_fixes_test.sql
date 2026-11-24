-- The Nov 24, 2026 fixes: free unlock, place leaks, staff phone, refunds,
-- paid-job rules, the pyol plan and «my free dates».
-- a1, a2 workers; b1 owns biz1 (in the app); f9 staff.
select tests.as_admin();
insert into auth.users (id, phone) values ('00000000-0000-0000-0000-0000000000f9', '+821099998888');
insert into ish.staff_members (user_id) values ('00000000-0000-0000-0000-0000000000f9');
create temp table ids (k text primary key, v uuid);
grant select, insert on ids to authenticated;
create function pg_temp.id(p text) returns uuid language sql as $$ select v from ids where k = p $$;

-- A staff-kept employer with a contact phone, and one without.
select tests.as_user('00000000-0000-0000-0000-0000000000f9');
insert into ids select 'biz', ish.staff_save_business(null, '행복물류센터', 'logistics', '김포시', '김포시 고촌읍 아라육로 123',
  'B동 3층', null, 37.6123, 126.7456, '{}', '{"phone": "010-7777-1234"}');
insert into ids select 'nophone', ish.staff_save_business(null, '전화없는가게', 'logistics', '김포시', '김포시 고촌읍 1',
  '', null, 37.61, 126.74, '{}', '{}');
insert into ids select 'job', ish.staff_save_shift(null, pg_temp.id('biz'), '상하차',
  now() + interval '20 days', now() + interval '20 days 9 hours', 15000, 2);
insert into ids select 'job_np', ish.staff_save_shift(null, pg_temp.id('nophone'), '정리',
  now() + interval '21 days', now() + interval '21 days 9 hours', 15000, 1);

-- 3. Staff phone: no contact phone, no offer.
select tests.throws($$select ish.staff_send_offers(pg_temp.id('job_np'),
  array['00000000-0000-0000-0000-0000000000a1']::uuid[])$$, 'NO_CONTACT_PHONE',
  'a kept employer without a contact phone gets no offers (the staff phone is never shown)');

-- 4. Paid offers only for invite-only jobs.
select tests.as_user('00000000-0000-0000-0000-0000000000f9');
select tests.throws($$select ish.staff_send_offers('20000000-0000-0000-0000-000000000003',
  array['00000000-0000-0000-0000-0000000000a1']::uuid[])$$, 'NOT_INVITE_ONLY',
  'no paid offer for a job in the free feed');
select tests.eq(ish.staff_send_offers(pg_temp.id('job'), array['00000000-0000-0000-0000-0000000000a1',
  '00000000-0000-0000-0000-0000000000a2']::uuid[]), 2, 'offers sent to a1 and a2');

-- 2. Place leak: nothing exact before paying.
select tests.as_user('00000000-0000-0000-0000-0000000000a3');
select tests.eq((select count(*)::int from ish.shifts where id = pg_temp.id('job')), 0,
                'a worker without an offer cannot read the job row');
select tests.eq((select count(*)::int from ish.businesses where id = pg_temp.id('biz')), 0,
                'nor the kept business row');
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.eq((select count(*)::int from ish.shifts where id = pg_temp.id('job')), 0,
                'with an offer, still not the row');
select tests.eq(ish.shift_details(pg_temp.id('job')) -> 'business' ->> 'name', '', 'the business name is hidden');
select tests.ok(ish.shift_details(pg_temp.id('job')) -> 'business' ->> 'address' like '%•••', 'the address is masked');
select tests.eq(ish.shift_details(pg_temp.id('job')) -> 'business' -> 'address_detail', 'null'::jsonb, 'no floor or unit');
select tests.eq((ish.shift_details(pg_temp.id('job')) ->> 'lat')::numeric, 37.61, 'the point is rounded (about 1 km)');
select tests.eq((ish.shift_details(pg_temp.id('job')) ->> 'place_hidden')::boolean, true, 'and marked hidden');
select tests.eq((ish.shift_details(pg_temp.id('job')) ->> 'unlock_price')::int, 30, '9 h × 15 000 = 135 000 won: 30 pyols');
-- The job alert: the pay and the price, but not the exact point.
select tests.eq((select (c -> 'shift' ->> 'hourly_wage')::int
                 from jsonb_array_elements(ish.my_notifications(50, array['job_offer'])) c
                 where c -> 'data' ->> 'shift_id' = pg_temp.id('job')::text), 15000, 'the alert has the pay');
select tests.eq((select (c -> 'shift' ->> 'unlock_price')::int
                 from jsonb_array_elements(ish.my_notifications(50, array['job_offer'])) c
                 where c -> 'data' ->> 'shift_id' = pg_temp.id('job')::text), 30, 'and the price');
select tests.eq((select (c -> 'shift' ->> 'lat')::numeric
                 from jsonb_array_elements(ish.my_notifications(50, array['job_offer'])) c
                 where c -> 'data' ->> 'shift_id' = pg_temp.id('job')::text), 37.61, 'and a rounded point');

-- 1. The free unlock trick no longer works.
select tests.throws($$select ish.apply_to_shift(pg_temp.id('job'))$$, 'USE_UNLOCK', 'no free apply to an invite-only job');
select tests.throws($$select ish.unlock_offer(pg_temp.id('job'))$$, 'NO_COINS', 'and no unlock without pyols');
select tests.eq((select count(*)::int from ish.applications where shift_id = pg_temp.id('job')), 0, 'nothing taken');

-- Free pyols at sign-up: once per phone.
select tests.as_admin();
update ish.worker_profiles set onboarded_at = null where user_id = '00000000-0000-0000-0000-0000000000a1';
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select ish.save_worker_profile('Aziz', 'Karimov', array['uz', 'ko'], 2, null, 'Gimpo', 0, 'D-2');
select tests.eq((ish.my_coins() ->> 'balance')::int, 90, '90 free pyols at sign-up');
select ish.save_worker_profile('Aziz', 'Karimov', array['uz', 'ko'], 2, null, 'Gimpo', 0, 'D-2');
select tests.eq((ish.my_coins() ->> 'balance')::int, 90, 'only once');
select tests.throws($$update ish.worker_profiles set onboarded_at = now() where user_id = auth.uid()$$,
                    'permission denied', '6. the worker cannot set onboarded_at directly');

-- Unlock with pyols: 135 000 won, 9 hours → 30.
select tests.eq(ish.unlock_offer(pg_temp.id('job')) ->> 'phone', '010-7777-1234', 'paid: the contact phone');
select tests.eq((ish.my_coins() ->> 'balance')::int, 60, '30 pyols');
select tests.ok(ish.shift_details(pg_temp.id('job')) -> 'business' ->> 'name' = '행복물류센터', 'and now the name');
select tests.eq(ish.unlock_offer(pg_temp.id('job')) ->> 'price', '30', 'opening again is free');
select tests.eq((ish.my_coins() ->> 'balance')::int, 60, 'still 60');

-- 5. Worker home address: employers cannot read worker rows.
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
select tests.eq((select count(*)::int from ish.worker_profiles where user_id <> auth.uid()), 0,
                'an employer reads no other worker''s profile row');

-- 6. After paying: the employer cannot cut the pay or move the place.
select tests.as_admin();
insert into ids values ('appjob', '20000000-0000-0000-0000-0000000000a6');
insert into ish.shifts (id, business_id, title, starts_at, ends_at, hourly_wage, slots, auto_confirm, invite_only, address)
values ('20000000-0000-0000-0000-0000000000a6', '10000000-0000-0000-0000-000000000001', '주방 보조',
        now() + interval '25 days', now() + interval '25 days 8 hours', 13000, 1, false, true, '마포구 독막로 4');
insert into ish.business_contacts (business_id, phone) values ('10000000-0000-0000-0000-000000000001', '010-4821-7730')
on conflict (business_id) do update set phone = excluded.phone;
insert into ish.job_offers (shift_id, worker_id, expires_at)
values (pg_temp.id('appjob'), '00000000-0000-0000-0000-0000000000a2', now() + interval '30 minutes'),
       (pg_temp.id('appjob'), '00000000-0000-0000-0000-0000000000a3', now() + interval '30 minutes');
select ish.coin_move('00000000-0000-0000-0000-0000000000a2', 100, 'staff', null, null, 'test');
select tests.as_user('00000000-0000-0000-0000-0000000000a2');
select ish.unlock_offer(pg_temp.id('appjob'));
select tests.as_admin();
select tests.eq((select count(*)::int from ish.notifications
                 where user_id = '00000000-0000-0000-0000-0000000000b1' and kind = 'new_applicant'
                   and data ->> 'shift_id' = pg_temp.id('appjob')::text), 1, '7. the employer is told');
select tests.eq((select status from ish.job_offers where shift_id = pg_temp.id('appjob')
                 and worker_id = '00000000-0000-0000-0000-0000000000a3'), 'closed',
                '8. full: the other offer closes, and stays closed');
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
select tests.throws($$update ish.shifts set hourly_wage = 10700 where id = '20000000-0000-0000-0000-0000000000a6'$$,
                    'HAS_PAID_WORKER', 'no pay cut after a worker paid');
select tests.throws($$update ish.shifts set address = '다른 주소 1' where id = '20000000-0000-0000-0000-0000000000a6'$$,
                    'HAS_PAID_WORKER', 'no other place either');
update ish.shifts set duties = '설거지' where id = '20000000-0000-0000-0000-0000000000a6';
select tests.eq((select duties from ish.shifts where id = pg_temp.id('appjob')), '설거지', 'the rest may change');

-- 5. Refunds: the employer cancels → all pyols back, the job stays in «My jobs».
select tests.as_user('00000000-0000-0000-0000-0000000000a2');
select tests.eq((ish.my_coins() ->> 'balance')::int, 70, 'a2 paid 30 (8 h, 104 000)');
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
select ish.cancel_shift(pg_temp.id('appjob'));
select tests.as_user('00000000-0000-0000-0000-0000000000a2');
select tests.eq((ish.my_coins() ->> 'balance')::int, 100, 'employer cancelled: refunded');
select tests.eq(ish.my_coins() -> 'history' -> 0 ->> 'reason', 'refund', 'as a refund');
select tests.eq((ish.my_jobs() -> 0 ->> 'refunded')::boolean, true, 'the job stays, marked refunded');
select tests.as_admin();
select tests.eq(ish.refund_unlock((select id from ish.applications where shift_id = pg_temp.id('appjob')), 'again'),
                false, 'refunded once only');

-- Worker cancels 12+ hours before → refund; later → no refund.
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select ish.cancel_application((select id from ish.applications where shift_id = pg_temp.id('job') and worker_id = auth.uid()));
select tests.eq((ish.my_coins() ->> 'balance')::int, 90, 'cancelled 20 days before: 30 back');
select tests.as_admin();
insert into ish.shifts (id, business_id, title, starts_at, ends_at, hourly_wage, slots, auto_confirm, invite_only)
values ('20000000-0000-0000-0000-0000000000a7', '10000000-0000-0000-0000-000000000001', '야간 정리',
        now() + interval '6 hours', now() + interval '10 hours', 13000, 1, false, true);
insert into ish.job_offers (shift_id, worker_id, expires_at)
values ('20000000-0000-0000-0000-0000000000a7', '00000000-0000-0000-0000-0000000000a1', now() + interval '30 minutes');
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select ish.unlock_offer('20000000-0000-0000-0000-0000000000a7');
select tests.eq((ish.my_coins() ->> 'balance')::int, 70, '4 hours: 20');
select ish.cancel_application((select id from ish.applications
  where shift_id = '20000000-0000-0000-0000-0000000000a7' and worker_id = auth.uid()));
select tests.eq((ish.my_coins() ->> 'balance')::int, 70, 'cancelled 6 hours before: no refund');

-- Staff: «worse than shown» and cancelling a kept job.
select tests.as_admin();
insert into ids select 'app7', id from ish.applications where shift_id = '20000000-0000-0000-0000-0000000000a7';
select tests.as_user('00000000-0000-0000-0000-0000000000f9');
select tests.throws($$select ish.staff_refund_unlock(pg_temp.id('app7'), '')$$, 'NOTE_REQUIRED', 'a note is needed');
select tests.eq(ish.staff_refund_unlock(pg_temp.id('app7'), 'pay was 10 000 lower'), true,
  'worse than shown: refunded');
insert into ids select 'job3', ish.staff_save_shift(null, pg_temp.id('biz'), '분류',
  now() + interval '22 days', now() + interval '22 days 8 hours', 15000, 1);
select ish.staff_send_offers(pg_temp.id('job3'), array['00000000-0000-0000-0000-0000000000a1']::uuid[]);
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select ish.unlock_offer(pg_temp.id('job3'));
select tests.eq((ish.my_coins() ->> 'balance')::int, 60, 'paid 30 for job3 (90 − 30)');
select tests.as_user('00000000-0000-0000-0000-0000000000f9');
select ish.staff_cancel_shift(pg_temp.id('job3'));
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.eq((ish.my_coins() ->> 'balance')::int, 90, 'staff cancelled: refunded');

-- 9. Offers always have an end time.
select tests.as_admin();
select tests.throws($$update ish.job_offers set expires_at = null$$, 'null value', 'expires_at is required');

-- 7. Long-term jobs: hidden until 300 pyols.
select tests.as_user('00000000-0000-0000-0000-0000000000f9');
insert into ish.monthly_jobs (id, title, company, area, address, lat, lng, monthly_wage, contact_phone)
values ('70000000-0000-0000-0000-0000000000a1', '편의점 야간', 'GS25 김포점', '김포', '김포시 사우동 12', 37.6181, 126.7155,
        2300000, '010-2222-3333');
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.eq((select j ->> 'company' from jsonb_array_elements(ish.public_monthly_jobs()) j
                 where j ->> 'id' = '70000000-0000-0000-0000-0000000000a1'), '', 'company hidden');
select tests.throws($$select ish.unlock_monthly_job('70000000-0000-0000-0000-0000000000a1')$$, 'NO_COINS',
                    '300 pyols needed');
select tests.as_admin();
select ish.coin_move('00000000-0000-0000-0000-0000000000a1', 300, 'staff', null, null, 'test');
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.eq(ish.unlock_monthly_job('70000000-0000-0000-0000-0000000000a1') ->> 'contact_phone', '010-2222-3333',
                'paid: the contact');
select tests.eq((ish.my_coins() ->> 'balance')::int, 90, '300 gone');
select tests.eq((select count(*)::int from ish.monthly_applications where job_id = '70000000-0000-0000-0000-0000000000a1'),
                1, 'and the interest is noted for the staff');

-- Long-term hires and the fee.
select tests.as_user('00000000-0000-0000-0000-0000000000f9');
insert into ids select 'hire', ish.staff_mark_hired('70000000-0000-0000-0000-0000000000a1',
  '00000000-0000-0000-0000-0000000000a1', ((now() at time zone 'Asia/Seoul')::date - 15));
select tests.eq(ish.staff_monthly_hires() -> 0 ->> 'state', 'check_due', 'due for the 2-week check');
select ish.staff_confirm_two_weeks(pg_temp.id('hire'), true);
select tests.eq(ish.staff_monthly_hires() -> 0 ->> 'state', 'fee_unpaid', 'stayed: the fee is due');
select ish.staff_mark_fee_paid(pg_temp.id('hire'));
select tests.eq(ish.staff_monthly_hires() -> 0 ->> 'state', 'fee_paid', 'fee paid');
select tests.throws($$select ish.staff_mark_fee_paid(pg_temp.id('hire'))$$, 'NOT_DUE', 'once');

-- Buying pyols.
select tests.as_user('00000000-0000-0000-0000-0000000000f9');
select ish.staff_set_payment_setting('bank', '국민은행 000-00-0000 (Hanguk)');
select tests.as_user('00000000-0000-0000-0000-0000000000a2');
select tests.eq(ish.payment_details() -> 'methods' ->> 'bank', '국민은행 000-00-0000 (Hanguk)', 'the worker sees the bank');
select tests.throws($$select ish.request_topup(55, 'bank')$$, 'INVALID', 'only the packs');
insert into ids select 'topup', ish.request_topup(100, 'kakaopay', 'Malika');
select tests.as_user('00000000-0000-0000-0000-0000000000f9');
select tests.eq(ish.staff_topups() -> 0 ->> 'amount_won', '9900', 'the staff see the request');
select tests.eq(ish.staff_approve_topup(pg_temp.id('topup')), 200, 'approved: 100 + 100');
select tests.throws($$select ish.staff_approve_topup(pg_temp.id('topup'))$$, 'ALREADY_DECIDED', 'no double pyols');
select tests.eq((ish.staff_pyol_report(1) -> 0 ->> 'sold')::int, 100, 'counted as sold');

-- 15. Staff gifts: limits and a note.
select tests.throws($$select ish.staff_add_coins('00000000-0000-0000-0000-0000000000a2', 301, 'x')$$, 'INVALID', 'at most 300');
select tests.throws($$select ish.staff_add_coins('00000000-0000-0000-0000-0000000000a2', 10, ' ')$$, 'NOTE_REQUIRED', 'with a note');
select ish.staff_add_coins('00000000-0000-0000-0000-0000000000a2', 300, 'gift');
select ish.staff_add_coins('00000000-0000-0000-0000-0000000000a2', 300, 'gift');
select ish.staff_add_coins('00000000-0000-0000-0000-0000000000a2', 300, 'gift');
select tests.throws($$select ish.staff_add_coins('00000000-0000-0000-0000-0000000000a2', 200, 'gift')$$,
                    'DAILY_LIMIT', 'at most 1 000 a day per worker');

-- Invite a friend: 60 + 30 after the friend's first finished job.
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.throws($$select ish.set_referrer((ish.my_referral() ->> 'code'))$$, 'INVALID', 'not oneself');
select tests.as_admin();
update ish.worker_profiles set referral_code = 'AZIZ01' where user_id = '00000000-0000-0000-0000-0000000000a1';
select tests.as_user('00000000-0000-0000-0000-0000000000a3');
select tests.eq(ish.set_referrer('aziz01'), true, 'a3 came with a1''s code');
select tests.throws($$select ish.set_referrer('ZZZZZZ')$$, 'NOT_FOUND', 'unknown code');
select tests.as_admin();
update ish.worker_profiles set onboarded_at = now() where user_id = '00000000-0000-0000-0000-0000000000a3';
insert into ish.shifts (id, business_id, title, starts_at, ends_at, hourly_wage, slots, auto_confirm)
values ('20000000-0000-0000-0000-0000000000a8', '10000000-0000-0000-0000-000000000001', '설거지',
        now() + interval '30 days', now() + interval '30 days 4 hours', 13000, 1, false);
insert into ish.applications (shift_id, worker_id, status, decided_at)
values ('20000000-0000-0000-0000-0000000000a8', '00000000-0000-0000-0000-0000000000a3', 'confirmed', now());
update ish.applications set status = 'completed'
where shift_id = '20000000-0000-0000-0000-0000000000a8' and worker_id = '00000000-0000-0000-0000-0000000000a3';
select tests.eq((select balance from ish.coin_wallets where worker_id = '00000000-0000-0000-0000-0000000000a1'), 150,
                'a1 got 60');
select tests.eq((select balance from ish.coin_wallets where worker_id = '00000000-0000-0000-0000-0000000000a3'), 30,
                'a3 got 30');

-- Monthly free pyols: topped up to 90, once a month.
select tests.eq(ish.monthly_bonus(true) >= 1, true, 'the monthly top-up runs');
select tests.eq((select balance from ish.coin_wallets where worker_id = '00000000-0000-0000-0000-0000000000a3'), 90,
                'a3 topped up to 90');
select tests.eq(ish.monthly_bonus(true), 0, 'once a month');

-- «My free dates» → the staff see who is free where.
select tests.as_user('00000000-0000-0000-0000-0000000000a2');
select tests.eq(jsonb_array_length(ish.set_free_dates(jsonb_build_array(
  jsonb_build_object('day', ((now() at time zone 'Asia/Seoul')::date + 2)::text, 'part', 'day', 'district', 'Ansan'),
  jsonb_build_object('day', ((now() at time zone 'Asia/Seoul')::date + 3)::text, 'part', 'night', 'district', 'Ansan')))),
  2, 'two free dates posted');
select tests.throws($$select ish.set_free_dates('[{"day": "2020-01-01", "district": "Ansan"}]')$$, 'INVALID', 'not in the past');
select tests.as_user('00000000-0000-0000-0000-0000000000f9');
select tests.ok(exists (select 1 from jsonb_array_elements(ish.staff_free_dates_summary(7)) x
                        where x ->> 'district' = 'Ansan'), 'the nightly search sees Ansan');
select tests.eq(ish.staff_free_workers((now() at time zone 'Asia/Seoul')::date + 2, 'ansan') -> 0 ->> 'first_name',
                (select first_name from ish.profiles where id = '00000000-0000-0000-0000-0000000000a2'),
                'and who is free that day');
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.eq(jsonb_array_length(ish.my_free_dates()), 0, 'a1 does not see a2''s dates');
