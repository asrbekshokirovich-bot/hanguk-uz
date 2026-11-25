-- Puyl: the staff add it, nobody else; it never goes below zero; every move
-- is in the worker's own ledger. a1 Aziz (worker); staff f1 is made here.
select tests.as_admin();
insert into auth.users (id, phone) values ('00000000-0000-0000-0000-0000000000f1', '+821000000071');
insert into ish.staff_members (user_id) values ('00000000-0000-0000-0000-0000000000f1');

select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.eq((ish.my_coins() ->> 'balance')::int, 0, 'a new worker has none');
select tests.eq(jsonb_array_length(ish.my_coins() -> 'history'), 0, 'and no moves');
select tests.throws($$select ish.staff_add_coins('00000000-0000-0000-0000-0000000000a1', 5, 'x')$$,
                    'FORBIDDEN', 'not the worker');

select tests.as_user('00000000-0000-0000-0000-0000000000f1');
select tests.eq(ish.staff_add_coins('00000000-0000-0000-0000-0000000000a1', 30, 'Naqd 30 000 won'), 30, 'staff: +30');
select tests.eq(ish.staff_add_coins('00000000-0000-0000-0000-0000000000a1', -5, 'mistake'), 25, 'and take back 5');
select tests.throws($$select ish.staff_add_coins('00000000-0000-0000-0000-0000000000a1', -100, 'x')$$,
                    'NO_COINS', 'never below zero');
select tests.throws($$select ish.staff_add_coins('00000000-0000-0000-0000-0000000000b1', 1, 'x')$$,
                    'NOT_FOUND', 'only workers');
select tests.throws($$select ish.staff_add_coins('00000000-0000-0000-0000-0000000000a1', 0, '')$$,
                    'INVALID', 'something to move');
select tests.eq(ish.staff_coin_workers('Aziz') -> 0 ->> 'balance', '25', 'the CRM finds the worker by name');
select tests.eq(jsonb_array_length(ish.staff_coin_workers('1000000001')), 1, 'and by phone');

select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.eq((ish.my_coins() ->> 'balance')::int, 25, 'the worker sees 25');
select tests.eq(ish.my_coins() -> 'history' -> 0 ->> 'delta', '-5', 'the last move first');
select tests.eq(ish.my_coins() -> 'history' -> 1 ->> 'note', 'Naqd 30 000 won', 'with the staff''s note');

select tests.as_user('00000000-0000-0000-0000-0000000000a2');
select tests.eq((select count(*)::int from ish.coin_ledger), 0, 'another worker sees none of it');
select tests.throws($$update ish.coin_wallets set balance = 100$$, 'permission denied', 'no writing the balance');
