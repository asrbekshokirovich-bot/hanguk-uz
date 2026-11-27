-- Buying puyl by bank transfer on the web / mini app (2026-11-26): an order
-- with a code, «Pul o'tkazdim», the staff's Telegram message, approve once,
-- unpaid orders expire after a day.
select tests.as_admin();
update ish.coin_wallets set balance = 0 where worker_id = '00000000-0000-0000-0000-0000000000a1';
insert into auth.users (id, phone) values ('00000000-0000-0000-0000-0000000000f8', '+821077776666');
insert into ish.staff_members (user_id) values ('00000000-0000-0000-0000-0000000000f8');

-- The staff put the account in the CRM.
select tests.as_user('00000000-0000-0000-0000-0000000000f8');
select ish.staff_set_payment_setting('bank_name', '하나은행');
select ish.staff_set_payment_setting('bank_account', '123-456789-01234');
select ish.staff_set_payment_setting('bank_holder', '김민수');
select ish.staff_set_payment_setting('contact', 'https://t.me/hanguk_admin');
select tests.throws($$select ish.staff_set_payment_setting('iban', 'x')$$, 'INVALID', 'only known keys');

-- The worker sees it and picks 100 P.
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.eq(ish.payment_details() -> 'methods' ->> 'bank_account', '123-456789-01234', 'the account');
create temp table t_order on commit drop as select ish.start_topup(100) as o;
grant select on t_order to authenticated;
select tests.eq((select o ->> 'status' from t_order), 'unpaid', 'a new order is unpaid');
select tests.eq((select (o ->> 'amount_won')::int from t_order), 9900, '9 900 won');
select tests.eq((select o ->> 'code' ~ '^HP[2-9A-HJ-NP-Z]{4}$' from t_order), true, 'a short code');
select tests.throws($$select ish.start_topup(50)$$, 'INVALID', 'no such pack');
select tests.eq(jsonb_array_length(ish.my_topups()), 1, 'the worker sees the order');

-- Someone else cannot mark it paid.
select tests.as_user('00000000-0000-0000-0000-0000000000a2');
select tests.throws(format('select ish.topup_paid(%L)', (select o ->> 'id' from t_order)), 'NOT_FOUND',
                    'not someone else''s order');

-- «Pul o'tkazdim»: pending, the staff are told once.
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.eq(ish.topup_paid((select (o ->> 'id')::uuid from t_order)) ->> 'status', 'pending', 'waiting for the staff');
select tests.eq(ish.topup_paid((select (o ->> 'id')::uuid from t_order)) ->> 'status', 'pending', 'a second tap: the same');
select tests.as_admin();
select tests.eq((select count(*)::int from ish.staff_alerts where kind = 'topup'
                 and ref = (select (o ->> 'id')::uuid from t_order)), 1, 'one Telegram message');
select tests.eq(ish.staff_alert_data('topup', (select (o ->> 'id')::uuid from t_order)) ->> 'code',
                (select o ->> 'code' from t_order), 'the message names the code');

-- At most three open orders.
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select ish.start_topup(30);
select ish.start_topup(300);
select tests.throws($$select ish.start_topup(30)$$, 'TOO_MANY', 'three open orders at most');

-- A day unpaid: expired; it cannot be marked paid then.
select tests.as_admin();
update ish.topup_requests set created_at = now() - interval '25 hours'
where worker_id = '00000000-0000-0000-0000-0000000000a1' and pyols = 30 and status = 'unpaid';
select tests.eq(ish.expire_topups(), 1, 'one order expired');
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.throws(format('select ish.topup_paid(%L)',
                           (select id from ish.topup_requests where pyols = 30
                            and worker_id = '00000000-0000-0000-0000-0000000000a1')),
                    'EXPIRED', 'too late to mark paid');

-- The staff approve: 100 P once, with the notice.
select tests.as_user('00000000-0000-0000-0000-0000000000f8');
select tests.eq(ish.staff_topups('pending') -> 0 ->> 'code', (select o ->> 'code' from t_order), 'the staff see the code');
select tests.eq(ish.staff_approve_topup((select (o ->> 'id')::uuid from t_order)), 100, 'approved: 100 P');
select tests.throws(format('select ish.staff_approve_topup(%L)', (select o ->> 'id' from t_order)),
                    'ALREADY_DECIDED', 'never twice');
-- Money for the expired order came anyway: still approved.
select tests.eq(ish.staff_approve_topup((select id from ish.topup_requests where pyols = 30
                                         and worker_id = '00000000-0000-0000-0000-0000000000a1')),
                130, 'a late transfer is still credited');
select ish.staff_reject_topup((select id from ish.topup_requests where pyols = 300
                               and worker_id = '00000000-0000-0000-0000-0000000000a1'), 'pul kelmadi');
select tests.as_admin();
select tests.eq((select data ->> 'why' from ish.notifications
                 where user_id = '00000000-0000-0000-0000-0000000000a1' and kind = 'coins_added'
                 order by id desc limit 1), 'topup', 'the «+100 puyl» notice');
select tests.eq((select count(*)::int from ish.notifications
                 where user_id = '00000000-0000-0000-0000-0000000000a1' and kind = 'topup_rejected'), 1,
                'the rejected order says so');

-- The apps cannot register Telegram tokens.
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.throws($$select ish.register_push_token('tg:123', 'worker', 'android')$$, 'INVALID', 'no tg: token');
select tests.throws($$select ish.register_push_token('abc', 'worker', 'telegram')$$, 'INVALID', 'no telegram platform');
