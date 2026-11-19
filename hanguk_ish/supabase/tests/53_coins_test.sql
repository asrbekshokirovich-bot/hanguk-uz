-- Coins: an application costs 1, the staff add them, and they come back when
-- it is fair. a1 Aziz (worker), b1 owner of biz1; staff s1 is made here.
select tests.as_admin();
update ish.coin_settings set apply_cost = 1;
insert into auth.users (id, phone) values ('00000000-0000-0000-0000-0000000000f1', '+821000000071');
insert into ish.staff_members (user_id) values ('00000000-0000-0000-0000-0000000000f1');

-- No coins: no application, nothing done.
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.eq((ish.my_coins() ->> 'balance')::int, 0, 'a new worker has none');
select tests.eq((ish.my_coins() ->> 'cost')::int, 1, 'an application costs 1');
select tests.throws($$select ish.apply_to_shift('20000000-0000-0000-0000-000000000001')$$, 'NO_COINS', 'none: refused');
select tests.eq((select count(*)::int from ish.applications
                 where shift_id = '20000000-0000-0000-0000-000000000001' and worker_id = auth.uid()), 0, 'and nothing applied');

-- Only the staff add coins.
select tests.throws($$select ish.staff_add_coins('00000000-0000-0000-0000-0000000000a1', 5, 'x')$$,
                    'FORBIDDEN', 'not the worker');
select tests.as_user('00000000-0000-0000-0000-0000000000f1');
select tests.eq(ish.staff_add_coins('00000000-0000-0000-0000-0000000000a1', 3, 'Naqd 30 000 won'), 3, 'staff: +3');
select tests.throws($$select ish.staff_add_coins('00000000-0000-0000-0000-0000000000a1', -10, '')$$,
                    'NO_COINS', 'never below zero');
select tests.throws($$select ish.staff_add_coins('00000000-0000-0000-0000-0000000000b1', 1, '')$$,
                    'NOT_FOUND', 'only workers');
select tests.eq(ish.staff_coin_workers('Aziz') -> 0 ->> 'balance', '3', 'the CRM finds the worker by name');
select tests.eq(jsonb_array_length(ish.staff_coin_workers('1000000001')), 1, 'and by phone');

-- Applying costs 1, shown in the history with the shift.
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select ish.apply_to_shift('20000000-0000-0000-0000-000000000001');
select tests.eq((ish.my_coins() ->> 'balance')::int, 2, 'one spent');
select tests.eq(ish.my_coins() -> 'history' -> 0 ->> 'reason', 'apply', 'the last move: the application');
select tests.eq(ish.my_coins() -> 'history' -> 0 ->> 'shift_title', '홀·카운터 보조', 'with the shift');
select tests.eq(ish.my_coins() -> 'history' -> 1 ->> 'note', 'Naqd 30 000 won', 'the staff''s note');

-- Cancelling a confirmed place more than 24 h ahead: the coin comes back.
select ish.cancel_application((select id from ish.applications
  where shift_id = '20000000-0000-0000-0000-000000000001' and worker_id = auth.uid()
  and status not in ('cancelled', 'rejected')));
select tests.eq((ish.my_coins() ->> 'balance')::int, 3, 'cancelled two days ahead: back');
select tests.eq(ish.my_coins() -> 'history' -> 0 ->> 'reason', 'refund', 'as a refund');

-- The business turns it down: back too.
select ish.apply_to_shift('20000000-0000-0000-0000-000000000002');
select tests.eq((ish.my_coins() ->> 'balance')::int, 2, 'spent again');
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
select ish.decide_application((select id from ish.applications
  where shift_id = '20000000-0000-0000-0000-000000000002' and worker_id = '00000000-0000-0000-0000-0000000000a1'
  and status = 'pending'), false);
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.eq((ish.my_coins() ->> 'balance')::int, 3, 'turned down: back');

-- A late cancel of a confirmed place keeps the coin.
select tests.as_admin();
update ish.shifts set starts_at = now() + interval '20 hours', ends_at = now() + interval '23 hours'
where id = '20000000-0000-0000-0000-000000000001';
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select ish.apply_to_shift('20000000-0000-0000-0000-000000000001');
select ish.cancel_application((select id from ish.applications
  where shift_id = '20000000-0000-0000-0000-000000000001' and worker_id = auth.uid()
  and status not in ('cancelled', 'rejected')));
select tests.eq((ish.my_coins() ->> 'balance')::int, 2, 'late cancel: kept');

-- The ledger is the worker's own; the tables are only read.
select tests.as_user('00000000-0000-0000-0000-0000000000a2');
select tests.eq((select count(*)::int from ish.coin_ledger), 0, 'another worker sees none of it');
select tests.throws($$update ish.coin_wallets set balance = 100$$, 'permission denied', 'no writing the balance');
