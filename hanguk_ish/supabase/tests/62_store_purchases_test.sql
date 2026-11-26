-- Buying puyl through Google Play / App Store (2026-11-25): one store
-- transaction, one credit; only the server function may credit.
select tests.as_admin();
update ish.coin_wallets set balance = 0 where worker_id = '00000000-0000-0000-0000-0000000000a1';

-- The app reads the products; it cannot credit itself.
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.eq(jsonb_array_length(ish.store_products()), 3, 'three products');
select tests.throws($$select ish.iap_credit('00000000-0000-0000-0000-0000000000a1', 'google', 'GPA.1', 'puyl_100')$$,
                    'permission denied', 'not from the app');
select tests.throws($$insert into ish.store_purchases (store, transaction_id, worker_id, product_id, pyols, price_won)
                      values ('google', 'x', '00000000-0000-0000-0000-0000000000a1', 'puyl_300', 300, 0)$$,
                    'permission denied', 'nor by hand');

select tests.as_admin();
select tests.eq(ish.iap_credit('00000000-0000-0000-0000-0000000000a1', 'google', 'GPA.1', 'puyl_100'),
                '{"credited": true, "pyols": 100, "balance": 100}'::jsonb, 'a purchase: 100 P at once');
select tests.eq(ish.iap_credit('00000000-0000-0000-0000-0000000000a1', 'google', 'GPA.1', 'puyl_100') ->> 'credited',
                'false', 'the same transaction again: nothing more');
select tests.eq((select balance from ish.coin_wallets where worker_id = '00000000-0000-0000-0000-0000000000a1'),
                100, 'still 100');
select tests.throws($$select ish.iap_credit('00000000-0000-0000-0000-0000000000a2', 'google', 'GPA.1', 'puyl_100')$$,
                    'NOT_YOURS', 'someone else''s receipt');
select tests.throws($$select ish.iap_credit('00000000-0000-0000-0000-0000000000a1', 'google', 'GPA.2', 'puyl_999')$$,
                    'INVALID', 'an unknown product');
select tests.eq(ish.iap_credit('00000000-0000-0000-0000-0000000000a1', 'apple', '2000000123', 'puyl_30') ->> 'balance',
                '130', 'Apple too');
select tests.eq((select data ->> 'why' from ish.notifications
                 where user_id = '00000000-0000-0000-0000-0000000000a1' and kind = 'coins_added'
                 order by id desc limit 1), 'topup', 'the «+30 puyl» notice');

-- The staff report counts the won.
insert into auth.users (id, phone) values ('00000000-0000-0000-0000-0000000000f9', '+821099998888');
insert into ish.staff_members (user_id) values ('00000000-0000-0000-0000-0000000000f9');
select tests.as_user('00000000-0000-0000-0000-0000000000f9');
select tests.eq((ish.staff_pyol_report(1) -> 0 ->> 'sold_won')::int, 13200, '9 900 + 3 300 won');
