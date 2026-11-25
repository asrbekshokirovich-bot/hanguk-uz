-- The Telegram bot's functions (2026-11-25): only the service role; a
-- worker found by phone or code; a request with its screenshot.
select tests.as_admin();
insert into auth.users (id, phone) values ('00000000-0000-0000-0000-0000000000f9', '+821099998888');
insert into ish.staff_members (user_id) values ('00000000-0000-0000-0000-0000000000f9');
update ish.worker_profiles set referral_code = 'AZIZ01' where user_id = '00000000-0000-0000-0000-0000000000a1';

-- Workers and the app cannot call them.
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.throws($$select ish.bot_find_worker('AZIZ01')$$, 'permission denied', 'not for the app');
select tests.throws($$select ish.bot_request_topup('00000000-0000-0000-0000-0000000000a1', 100, 'x', '')$$,
                    'permission denied', 'not for the app');

select tests.as_admin();
select tests.eq(ish.bot_find_worker('aziz01') ->> 'worker_id', '00000000-0000-0000-0000-0000000000a1', 'by code');
select tests.eq(ish.bot_find_worker('010-0000-0001') ->> 'worker_id', '00000000-0000-0000-0000-0000000000a1',
                'by the phone as typed');
select tests.eq(ish.bot_find_worker('+82 10 0000 0001') ->> 'name', 'Aziz K.', 'only a short name');
select tests.ok(ish.bot_find_worker('010-0000-0003') is null, 'not onboarded: nobody');
select tests.ok(ish.bot_find_worker('NOPE99') is null, 'unknown: nobody');
select tests.ok(ish.bot_find_worker('') is null, 'empty: nobody');

select tests.throws($$select ish.bot_request_topup('00000000-0000-0000-0000-0000000000a1', 55, 'x', '')$$,
                    'INVALID', 'a pack only');
select ish.bot_request_topup('00000000-0000-0000-0000-0000000000a1', 100, 'Aziz (Telegram)', 'a1/123.jpg');
select tests.as_user('00000000-0000-0000-0000-0000000000f9');
select tests.eq((select jsonb_build_object('source', r ->> 'source', 'proof', r ->> 'proof_path', 'won', (r ->> 'amount_won')::int)
                 from jsonb_array_elements(ish.staff_topups()) r limit 1),
                '{"source": "telegram", "proof": "a1/123.jpg", "won": 9900}'::jsonb, 'the staff see it with the screenshot');
