-- «10-qadam»: the staff send a job to 3–4 workers for 30 minutes; a worker
-- opens the phone and the address with puyl and the job is theirs.
-- a1, a2 workers; staff f1; s2 is a biz1 shift in 3 days, 1 place, 11 000 won × 4 h.
select tests.as_admin();
insert into auth.users (id, phone) values ('00000000-0000-0000-0000-0000000000f1', '+821000000071');
insert into ish.staff_members (user_id) values ('00000000-0000-0000-0000-0000000000f1');
update ish.worker_profiles set onboarded_at = now() where user_id = '00000000-0000-0000-0000-0000000000a3';
insert into ish.business_contacts (business_id, phone) values ('10000000-0000-0000-0000-000000000001', '010-4821-7730');
-- Paid offers are only for invite-only jobs.
update ish.shifts set invite_only = true
where id in ('20000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000006');

-- The prices by the pay.
select tests.eq(ish.unlock_price(160000), 40, 'over 150 000: 40');
select tests.eq(ish.unlock_price(150000), 30, '80 000–150 000: 30');
select tests.eq(ish.unlock_price(80000), 30, '80 000: 30');
select tests.eq(ish.unlock_price(60000), 20, 'under 80 000: 20');
select tests.eq(ish.monthly_unlock_price(), 300, 'a long-term job: 300');
select tests.eq(ish.mask_address('마포구 독막로 4, 1층'), '마포구 독막로 •••', 'the street, not the house');

-- The staff: the whole pay, «talked to the employer», then 2 workers.
select tests.as_user('00000000-0000-0000-0000-0000000000f1');
select ish.staff_job_details('20000000-0000-0000-0000-000000000002', 60000, true);
select tests.eq(ish.staff_send_offers('20000000-0000-0000-0000-000000000002',
                  array['00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2']::uuid[]), 2,
                'sent to two');
select tests.throws($$select ish.staff_send_offers('20000000-0000-0000-0000-000000000002',
                      array['00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000b2',
                            '00000000-0000-0000-0000-0000000000c9']::uuid[])$$, 'TOO_MANY', 'at most 4 waiting at once');

-- The worker sees it without the phone and the house.
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.eq(ish.my_offers() -> 0 ->> 'status', 'sent', 'waiting');
select tests.eq((ish.my_offers() -> 0 ->> 'pay')::int, 60000, 'the whole pay');
select tests.eq((ish.my_offers() -> 0 ->> 'price')::int, 20, 'opening costs 20 (4 hours)');
select tests.eq(ish.my_offers() -> 0 ->> 'phone', '010-••••-••••', 'the phone is hidden');
select tests.ok(ish.my_offers() -> 0 ->> 'address' like '%•••', 'the house is hidden');
select tests.eq((ish.my_offers() -> 0 ->> 'sent_count')::int, 2, 'sent to two');
select tests.ok((ish.my_offers() -> 0 ->> 'checked_at') is not null, 'when the staff talked to the employer');
select tests.ok((ish.my_offers() -> 0 ->> 'expires_at')::timestamptz
                between now() + interval '29 minutes' and now() + interval '12 hours 1 minute',
                'until 2 hours before the start (30 minutes to 12 hours)');

-- No puyl: not opened, nothing taken.
select tests.throws($$select ish.unlock_offer('20000000-0000-0000-0000-000000000002')$$, 'NO_COINS', 'needs puyl');
select tests.eq(ish.my_offers() -> 0 ->> 'status', 'sent', 'still waiting');

-- With puyl: opened, the job is theirs, 10 P gone.
select tests.as_user('00000000-0000-0000-0000-0000000000f1');
select ish.staff_add_coins('00000000-0000-0000-0000-0000000000a1', 25, 'test');
select ish.staff_add_coins('00000000-0000-0000-0000-0000000000a2', 25, 'test');
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.eq(ish.unlock_offer('20000000-0000-0000-0000-000000000002') ->> 'phone', '010-4821-7730', 'the phone, open');
select tests.eq((ish.my_coins() ->> 'balance')::int, 5, '25 − 20');
select tests.eq(ish.my_coins() -> 'history' -> 0 ->> 'reason', 'unlock', 'as opening a job');
select tests.eq((select status::text from ish.applications
                 where shift_id = '20000000-0000-0000-0000-000000000002' and worker_id = auth.uid()), 'confirmed',
                'the job is theirs');
select tests.eq(jsonb_array_length(ish.my_jobs()), 1, 'in «Mening ishlarim»');
select tests.eq(ish.unlock_offer('20000000-0000-0000-0000-000000000002') ->> 'phone', '010-4821-7730', 'again: the same card');
select tests.eq((ish.my_coins() ->> 'balance')::int, 5, 'and free');

-- The one place is taken: closed for a2.
select tests.as_user('00000000-0000-0000-0000-0000000000a2');
select tests.eq(ish.my_offers() -> 0 ->> 'status', 'closed', 'closed for the other');
select tests.throws($$select ish.unlock_offer('20000000-0000-0000-0000-000000000002')$$, 'OFFER_EXPIRED',
                    'it cannot be opened any more');
select tests.eq((ish.my_coins() ->> 'balance')::int, 25, 'and nothing taken');

-- The worker's steps, then the rating (only after «Ishga chiqdim»).
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select ish.set_job_step((select id from ish.applications
  where shift_id = '20000000-0000-0000-0000-000000000002' and worker_id = auth.uid()), 1);
select tests.throws($$select ish.rate_job((select id from ish.applications
  where shift_id = '20000000-0000-0000-0000-000000000002' and worker_id = auth.uid()), 5)$$, 'NOT_FOUND',
  'not before going to work');
select ish.set_job_step((select id from ish.applications
  where shift_id = '20000000-0000-0000-0000-000000000002' and worker_id = auth.uid()), 2);
select tests.eq(ish.rate_job((select id from ish.applications
  where shift_id = '20000000-0000-0000-0000-000000000002' and worker_id = auth.uid()), 5), 5, 'rated');
select tests.eq((ish.my_jobs() -> 0 ->> 'step')::int, 2, 'went to work');
select tests.eq((ish.my_jobs() -> 0 ->> 'stars')::int, 5, 'with the stars');

-- 30 minutes: an offer not opened expires; 5 minutes before, one reminder.
select tests.as_user('00000000-0000-0000-0000-0000000000f1');
select ish.staff_send_offers('20000000-0000-0000-0000-000000000006',
  array['00000000-0000-0000-0000-0000000000a3']::uuid[]);
select tests.as_admin();
update ish.job_offers set expires_at = now() + interval '4 minutes'
where shift_id = '20000000-0000-0000-0000-000000000006';
select tests.eq(ish.offers_tick(), 1, 'one reminder');
select tests.eq(ish.offers_tick(), 0, 'only once');
select tests.eq((select count(*)::int from ish.notifications
                 where user_id = '00000000-0000-0000-0000-0000000000a3' and kind = 'job_offer' and data ? 'reminder'), 1,
                'a reminder push');
update ish.job_offers set expires_at = now() - interval '1 second'
where shift_id = '20000000-0000-0000-0000-000000000006';
select ish.offers_tick();
select tests.eq((select status from ish.job_offers where shift_id = '20000000-0000-0000-0000-000000000006'), 'expired',
                'expired after its time');
select tests.as_user('00000000-0000-0000-0000-0000000000a3');
select tests.throws($$select ish.unlock_offer('20000000-0000-0000-0000-000000000006')$$, 'OFFER_EXPIRED', 'too late');

-- Not offered: nothing to open.
select tests.as_user('00000000-0000-0000-0000-0000000000a2');
select tests.throws($$select ish.unlock_offer('20000000-0000-0000-0000-000000000001')$$, 'NOT_FOUND', 'not offered');

-- CRM: the job page shows the pay, the price, the call, each offer's end and
-- the worker's puyl.
select tests.as_user('00000000-0000-0000-0000-0000000000f1');
select tests.eq((ish.staff_shift('20000000-0000-0000-0000-000000000002') ->> 'job_pay')::int, 60000, 'job pay');
select tests.eq((ish.staff_shift('20000000-0000-0000-0000-000000000002') ->> 'unlock_price')::int, 20, 'price');
select tests.eq(ish.staff_shift('20000000-0000-0000-0000-000000000002') ? 'checked_at', true, 'checked');
select tests.eq((ish.staff_shift('20000000-0000-0000-0000-000000000006') -> 'offers' -> 0 ->> 'status'), 'expired',
                'offer ended');
select tests.eq((ish.staff_shift('20000000-0000-0000-0000-000000000006') -> 'offers' -> 0) ? 'expires_at', true,
                'offer end time');
select tests.eq((ish.staff_shift('20000000-0000-0000-0000-000000000002') -> 'applications' -> 0 -> 'worker' ->> 'coins')::int,
                5, 'worker puyl');
