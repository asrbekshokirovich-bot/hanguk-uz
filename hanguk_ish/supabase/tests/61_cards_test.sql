-- Yellow and red cards (workers and employers) and the employer invite
-- reward (2026-11-25). a1, a2 workers; b1 owns biz1; f9 staff.
select tests.as_admin();
insert into auth.users (id, phone) values ('00000000-0000-0000-0000-0000000000f9', '+821099998888');
insert into ish.staff_members (user_id) values ('00000000-0000-0000-0000-0000000000f9');
create temp table ids (k text primary key, v uuid);
grant select, insert on ids to authenticated;
create function pg_temp.id(p text) returns uuid language sql as $$ select v from ids where k = p $$;
-- A finished job of biz1 for a worker (one hour, ended an hour ago).
create function pg_temp.done_job(p_worker uuid, p_status text,
  p_business uuid default '10000000-0000-0000-0000-000000000001') returns uuid language plpgsql as $$
declare
  v_shift uuid := gen_random_uuid();
  v_app uuid := gen_random_uuid();
begin
  insert into ish.shifts (id, business_id, title, starts_at, ends_at, hourly_wage, slots, auto_confirm)
  values (v_shift, p_business, '보조', now() - interval '3 hours',
          now() - interval '1 hour', 11000, 1, true);
  insert into ish.applications (id, shift_id, worker_id, status, decided_at)
  values (v_app, v_shift, p_worker, 'confirmed', now() - interval '1 day');
  update ish.applications set status = p_status::ish.application_status where id = v_app;
  return v_app;
end
$$;

-- ---------------------------------------------------------------------
-- Workers
-- ---------------------------------------------------------------------
select tests.as_user('00000000-0000-0000-0000-0000000000a2');
select tests.eq(ish.my_card() ->> 'level', 'none', 'no card at first');

-- 1st no-show: yellow, a warning only.
select tests.as_admin();
update ish.applications set status = 'no_show' where id = '30000000-0000-0000-0000-000000000075';
select tests.as_user('00000000-0000-0000-0000-0000000000a2');
select tests.eq(ish.my_card() ->> 'level', 'yellow', 'a no-show: yellow');
select tests.eq((ish.my_card() ->> 'closed')::boolean, false, 'yellow closes nothing');
select tests.eq((select data ->> 'card' from ish.notifications
                 where user_id = '00000000-0000-0000-0000-0000000000a2' and kind = 'card_given'), 'yellow',
                'the worker is told');
select tests.as_admin();
select tests.eq(ish.push_app('card_given', '{}'), 'worker', 'with a push');
select tests.as_user('00000000-0000-0000-0000-0000000000a2');
select tests.ok((ish.apply_to_shift('20000000-0000-0000-0000-000000000001')).id is not null, 'yellow: still applies');

-- 2nd no-show: red for 14 days, no new job.
select tests.as_admin();
select pg_temp.done_job('00000000-0000-0000-0000-0000000000a2', 'no_show');
select tests.as_user('00000000-0000-0000-0000-0000000000a2');
select tests.eq(ish.my_card() ->> 'level', 'red', 'a second no-show: red');
select tests.ok((ish.my_card() ->> 'red_until')::timestamptz between now() + interval '13 days 23 hours'
                and now() + interval '14 days 1 hour', 'for 14 days');
select tests.throws($$select ish.apply_to_shift('20000000-0000-0000-0000-000000000002')$$, 'CARD_CLOSED',
                    'red: no applying');

-- Offers skip a red worker; the others still get theirs.
select tests.as_user('00000000-0000-0000-0000-0000000000f9');
insert into ids select 'biz', ish.staff_save_business(null, '행복물류센터', 'logistics', '김포시', '김포시 고촌읍 1',
  '', null, 37.61, 126.74, '{}', '{"phone": "010-7777-1234"}');
insert into ids select 'job', ish.staff_save_shift(null, pg_temp.id('biz'), '상하차',
  now() + interval '20 days', now() + interval '20 days 9 hours', 15000, 2);
select tests.eq(ish.staff_send_offers(pg_temp.id('job'), array['00000000-0000-0000-0000-0000000000a1',
  '00000000-0000-0000-0000-0000000000a2']::uuid[]), 1, 'the red worker gets no offer');
select tests.as_admin();
update ish.coin_wallets set balance = 500 where worker_id = '00000000-0000-0000-0000-0000000000a2';
insert into ish.job_offers (shift_id, worker_id, sent_by, note, expires_at)
select pg_temp.id('job'), '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000f9', '',
       now() + interval '1 hour';
select tests.eq((select count(*)::int from ish.job_offers where worker_id = '00000000-0000-0000-0000-0000000000a2'),
                0, 'not even inserted by hand');

-- The staff see it, with the history.
select tests.as_user('00000000-0000-0000-0000-0000000000f9');
select tests.eq(ish.staff_card('00000000-0000-0000-0000-0000000000a2') ->> 'level', 'red', 'the staff see red');
select tests.eq(jsonb_array_length(ish.staff_card('00000000-0000-0000-0000-0000000000a2') -> 'events'), 2,
                'and two events');
select tests.eq((select c ->> 'name' from jsonb_array_elements(ish.staff_cards()) c
                 where c ->> 'subject_id' = '00000000-0000-0000-0000-0000000000a2'), 'Malika Yusupova',
                'in the CRM list, by name');

-- After the 14 days, five good jobs: back to yellow; five more: none.
select tests.as_admin();
update ish.cards set red_until = now() - interval '1 minute' where subject_id = '00000000-0000-0000-0000-0000000000a2';
select pg_temp.done_job('00000000-0000-0000-0000-0000000000a2', 'completed') from generate_series(1, 4);
select tests.eq(ish.card_of('00000000-0000-0000-0000-0000000000a2') ->> 'level', 'red', 'four jobs: not yet');
select pg_temp.done_job('00000000-0000-0000-0000-0000000000a2', 'completed');
select tests.eq(ish.card_of('00000000-0000-0000-0000-0000000000a2') ->> 'level', 'yellow', 'five: one step back');
select pg_temp.done_job('00000000-0000-0000-0000-0000000000a2', 'completed') from generate_series(1, 5);
select tests.eq(ish.card_of('00000000-0000-0000-0000-0000000000a2') ->> 'level', 'none', 'five more: clean');

-- Three no-shows in a row: blocked until the staff lift it (with a note).
select pg_temp.done_job('00000000-0000-0000-0000-0000000000a1', 'no_show') from generate_series(1, 2);
update ish.cards set red_until = now() - interval '1 minute' where subject_id = '00000000-0000-0000-0000-0000000000a1';
select pg_temp.done_job('00000000-0000-0000-0000-0000000000a1', 'no_show');
select tests.eq(ish.card_of('00000000-0000-0000-0000-0000000000a1') ->> 'level', 'blocked', 'third: blocked');
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.throws($$select ish.apply_to_shift('20000000-0000-0000-0000-000000000003')$$, 'CARD_CLOSED',
                    'blocked: no applying');
select tests.throws($$select ish.staff_clear_card('00000000-0000-0000-0000-0000000000a1', 'x')$$, 'FORBIDDEN',
                    'only the staff lift it');
select tests.as_user('00000000-0000-0000-0000-0000000000f9');
select tests.throws($$select ish.staff_clear_card('00000000-0000-0000-0000-0000000000a1', ' ')$$, 'NOTE_REQUIRED',
                    'with a note');
select tests.eq(ish.staff_clear_card('00000000-0000-0000-0000-0000000000a1', 'he was ill') ->> 'level', 'none',
                'lifted');
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.ok((ish.apply_to_shift('20000000-0000-0000-0000-000000000003')).id is not null, 'applies again');

-- ---------------------------------------------------------------------
-- Employers
-- ---------------------------------------------------------------------
-- b1 cancels a job a worker had booked (a2 took s1 above): yellow.
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
select ish.cancel_shift('20000000-0000-0000-0000-000000000001');
select tests.eq(ish.my_business_card('10000000-0000-0000-0000-000000000001') ->> 'level', 'yellow',
                'cancelling a booked job: yellow');
select tests.eq((select count(*)::int from ish.notifications
                 where user_id = '00000000-0000-0000-0000-0000000000b1' and kind = 'business_card'), 1, 'told');
-- A job nobody booked: no card.
select ish.cancel_shift('20000000-0000-0000-0000-000000000002');
select tests.eq(ish.my_business_card('10000000-0000-0000-0000-000000000001') ->> 'level', 'yellow',
                'an empty job: no card');

-- The staff: «worse than promised» → red; no new job for 14 days.
select tests.as_user('00000000-0000-0000-0000-0000000000f9');
select tests.throws($$select ish.staff_give_business_card('10000000-0000-0000-0000-000000000001', '')$$,
                    'NOTE_REQUIRED', 'a reason is needed');
select tests.eq(ish.staff_give_business_card('10000000-0000-0000-0000-000000000001', 'paid less than shown')
                ->> 'level', 'red', 'red');
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
select tests.throws($$insert into ish.shifts (business_id, title, starts_at, ends_at, hourly_wage, slots)
                      values ('10000000-0000-0000-0000-000000000001', 'x', now() + interval '3 days',
                              now() + interval '3 days 4 hours', 11000, 1)$$, 'BUSINESS_CARD',
                    'red: the employer posts nothing');
select tests.throws($$select ish.my_business_card('10000000-0000-0000-0000-000000000002')$$, 'NOT_FOUND',
                    'not someone else''s card');

-- ---------------------------------------------------------------------
-- Employer invite: 200 P after the first finished job
-- ---------------------------------------------------------------------
select tests.as_admin();
-- b1 opens a second business (no finished job yet).
insert into ish.businesses (id, owner_id, name, status, category, address)
values ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000b1', '새가게', 'verified', 'cafe', '서울');
insert into ish.business_members (business_id, user_id, role)
values ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000b1', 'owner');
update ish.worker_profiles set referral_code = 'AZIZ01' where user_id = '00000000-0000-0000-0000-0000000000a1';
update ish.coin_wallets set balance = 0 where worker_id = '00000000-0000-0000-0000-0000000000a1';
insert into ish.coin_wallets (worker_id) values ('00000000-0000-0000-0000-0000000000a1') on conflict do nothing;
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
select tests.throws($$select ish.set_business_invite('10000000-0000-0000-0000-000000000003', 'NOPE99')$$,
                    'NOT_FOUND', 'an unknown code');
select ish.set_business_invite('10000000-0000-0000-0000-000000000003', 'aziz01');
select tests.throws($$select ish.set_business_invite('10000000-0000-0000-0000-000000000003', 'AZIZ01')$$,
                    'TOO_LATE', 'once');
select tests.as_admin();
select tests.eq((select balance from ish.coin_wallets where worker_id = '00000000-0000-0000-0000-0000000000a1'),
                0, 'nothing before a real job');
select pg_temp.done_job('00000000-0000-0000-0000-0000000000a2', 'completed', '10000000-0000-0000-0000-000000000003');
select tests.eq((select balance from ish.coin_wallets where worker_id = '00000000-0000-0000-0000-0000000000a1'),
                200, 'the first finished job: 200 P');
select tests.eq((select data ->> 'why' from ish.notifications
                 where user_id = '00000000-0000-0000-0000-0000000000a1' and kind = 'coins_added'
                 order by id desc limit 1), 'employer', '«+200 puyl» for bringing an employer');
select pg_temp.done_job('00000000-0000-0000-0000-0000000000a2', 'completed', '10000000-0000-0000-0000-000000000003');
select tests.eq((select balance from ish.coin_wallets where worker_id = '00000000-0000-0000-0000-0000000000a1'),
                200, 'only once');
