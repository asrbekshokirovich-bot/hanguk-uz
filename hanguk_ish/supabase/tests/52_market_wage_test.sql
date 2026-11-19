-- The average hourly wage the owner is shown in BA2.
-- fixtures: biz1 (verified, Mapo-gu) has several shifts at 10 700–11 000 won.
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
select tests.ok(ish.market_wage('10000000-0000-0000-0000-000000000001') between 10700 and 11100,
                'about what the shifts pay');
select tests.eq(ish.market_wage('10000000-0000-0000-0000-000000000001') % 100, 0, 'rounded to 100 won');

select tests.as_user('00000000-0000-0000-0000-0000000000b2');
select tests.throws($$select ish.market_wage('10000000-0000-0000-0000-000000000001')$$,
                    'NOT_FOUND', 'only a member of the business asks');
select tests.as_anon();
select tests.throws($$select ish.market_wage('10000000-0000-0000-0000-000000000001')$$,
                    'permission denied', 'not signed out');

-- Old shifts do not count: nothing to average, nothing shown.
select tests.as_admin();
update ish.shifts set created_at = now() - interval '200 days';
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
select tests.ok(ish.market_wage('10000000-0000-0000-0000-000000000001') is null, 'fewer than 5 recent shifts: null');
