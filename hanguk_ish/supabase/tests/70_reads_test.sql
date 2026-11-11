-- Lists and numbers the apps show: feed, stats, earnings, report, payment,
-- favourites, rating.

-- Feed (A03): a1's view of the next three days around Sinchon (JSON cards).
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.eq(jsonb_array_length(ish.shift_feed(now(), now() + interval '4 days')), 5,
                'feed lists the open future shifts of verified businesses');
select tests.ok(not exists (select 1 from jsonb_array_elements(ish.shift_feed(now(), now() + interval '4 days')) c
                            where c -> 'business' ->> 'id' = '10000000-0000-0000-0000-000000000002'),
                'never the unverified business');
select tests.eq((select (c ->> 'slots_left')::int from jsonb_array_elements(ish.shift_feed(now(), now() + interval '4 days')) c
                 where c ->> 'id' = '20000000-0000-0000-0000-000000000004'), 2, 's4: 3 slots, 1 taken');
select tests.eq((select c ->> 'my_status' from jsonb_array_elements(ish.shift_feed(now(), now() + interval '4 days')) c
                 where c ->> 'id' = '20000000-0000-0000-0000-000000000004'), 'confirmed', 'the card knows I hold it');
select tests.eq(jsonb_array_length(ish.shift_feed(now(), now() + interval '4 days', p_min_wage => 11000)),
                1, 'wage filter');
select tests.eq(jsonb_array_length(ish.shift_feed(now(), now() + interval '4 days', p_categories => '{restaurant}')),
                0, 'category filter');
select tests.ok((select (c ->> 'distance_km')::numeric between 0 and 0.01
                 from jsonb_array_elements(ish.shift_feed(now(), now() + interval '4 days', 37.5559, 126.9368)) c
                 where c ->> 'id' = '20000000-0000-0000-0000-000000000001'), 'distance from the worker');
select tests.eq(jsonb_array_length(ish.shift_feed(now(), now() + interval '4 days', 37.5665, 126.9780, 1.0)),
                0, 'radius filter (City Hall is 3.8 km away)');

-- Completed work: a2 finishes s5 (12 000/h) and the business pays.
select tests.as_admin();
update ish.applications set status = 'completed', check_out_at = now(), worked_minutes = 180, pay_amount = 36000
  where id = '30000000-0000-0000-0000-000000000005';

select tests.as_user('00000000-0000-0000-0000-0000000000a2');
select tests.eq((select pay_amount from ish.worker_earnings((now() at time zone 'Asia/Seoul')::date - 1, (now() at time zone 'Asia/Seoul')::date + 1)), 36000,
                'A9 lists the pay');
select tests.eq((select paid from ish.worker_earnings((now() at time zone 'Asia/Seoul')::date - 1, (now() at time zone 'Asia/Seoul')::date + 1)), false, 'not paid yet');

select tests.as_user('00000000-0000-0000-0000-0000000000b1');
select tests.eq((select total_pay from ish.business_report('10000000-0000-0000-0000-000000000001', (now() at time zone 'Asia/Seoul')::date - 1, (now() at time zone 'Asia/Seoul')::date + 1)),
                36000, 'BA5 totals the shift');
select tests.eq(ish.set_shift_paid('20000000-0000-0000-0000-000000000005', true), 1, 'BA5 marks the shift paid');
select tests.as_user('00000000-0000-0000-0000-0000000000a2');
select tests.eq((select paid from ish.worker_earnings((now() at time zone 'Asia/Seoul')::date - 1, (now() at time zone 'Asia/Seoul')::date + 1)), true, 'the worker sees it paid');
select tests.as_user('00000000-0000-0000-0000-0000000000b2');
select tests.throws($$select ish.set_shift_paid('20000000-0000-0000-0000-000000000005', true)$$,
                    'NOT_FOUND', 'another business cannot mark it');
select tests.eq((select count(*)::int from ish.business_report('10000000-0000-0000-0000-000000000001', (now() at time zone 'Asia/Seoul')::date - 1, (now() at time zone 'Asia/Seoul')::date + 1)),
                0, 'nor read its report');

-- Rating (A08) and the stats it feeds (A05).
select tests.as_user('00000000-0000-0000-0000-0000000000a2');
select tests.eq((ish.rate_business('30000000-0000-0000-0000-000000000005', 5, '{on_time,polite}')).stars::int, 5,
                'worker rates the business');
select tests.eq((select ratings from ish.business_stats('10000000-0000-0000-0000-000000000001')), 1, 'one rating');
select tests.eq((select rating from ish.business_stats('10000000-0000-0000-0000-000000000001')), 5.0, 'average 5.0');
select tests.eq((select completed_shifts from ish.business_stats('10000000-0000-0000-0000-000000000001')), 1,
                'one completed shift');
select tests.throws($$select ish.rate_business('30000000-0000-0000-0000-000000000005', 6, '{}')$$,
                    'ratings_stars_check', 'stars are 1–5');
select tests.throws($$select ish.rate_business('30000000-0000-0000-0000-000000000005', 4, '{bogus}')$$,
                    'ratings_tags_check', 'only known tags');
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.throws($$select ish.rate_business('30000000-0000-0000-0000-000000000004', 5, '{}')$$,
                    'NOT_FOUND', 'only after a completed shift');

-- Worker stats (A11, BA3/BA4).
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
select tests.eq((select shifts_here from ish.worker_stats('00000000-0000-0000-0000-0000000000a2',
                 '10000000-0000-0000-0000-000000000001')), 1, '우리 매장 1회');
select tests.as_user('00000000-0000-0000-0000-0000000000b2');
select tests.eq((select count(*)::int from ish.worker_stats('00000000-0000-0000-0000-0000000000a2')), 0,
                'a stranger business learns nothing about the worker');
select tests.as_user('00000000-0000-0000-0000-0000000000a2');
select tests.eq((select completed_shifts from ish.worker_stats('00000000-0000-0000-0000-0000000000a2')), 1,
                'the worker sees their own stats');

-- Favourites and «다시 요청» (BA4).
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
select tests.eq(ish.toggle_favorite('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a2'),
                true, 'star a worker');
select tests.eq((select count(*)::int from ish.favorites), 1, 'listed');
select tests.eq(ish.toggle_favorite('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a2'),
                false, 'unstar');
select tests.throws($$select ish.toggle_favorite('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a3')$$,
                    'NOT_FOUND', 'only workers who applied here');
select ish.request_again('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a2');
select tests.as_user('00000000-0000-0000-0000-0000000000a2');
select tests.eq((select count(*)::int from ish.notifications where kind = 'request_again'), 1,
                'the worker is invited');
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
select tests.throws($$select ish.request_again('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a3')$$,
                    'NOT_FOUND', 'only workers who completed a shift here');

-- Push tokens move with the device.
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select ish.register_push_token('tok-1', 'worker');
select tests.as_user('00000000-0000-0000-0000-0000000000a2');
select ish.register_push_token('tok-1', 'worker');
select tests.as_admin();
select tests.eq((select user_id::text from ish.push_tokens where token = 'tok-1'),
                '00000000-0000-0000-0000-0000000000a2', 'a token belongs to the last account on the device');
