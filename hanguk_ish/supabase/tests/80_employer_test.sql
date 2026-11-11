-- The employer app's reads (business_board, employer_shift, business_workers)
-- and the rules for editing a shift (shifts_guard).

-- a1 completed s7 earlier and is a favourite of biz1; a2 rated 5 by biz1.
select tests.as_admin();
insert into ish.applications (id, shift_id, worker_id, status, decided_at, check_in_at, check_out_at, worked_minutes, pay_amount)
values ('30000000-0000-0000-0000-000000000071', '20000000-0000-0000-0000-000000000007',
        '00000000-0000-0000-0000-0000000000a1', 'completed', now() - interval '2 days',
        now() - interval '7 hours', now() - interval '1 hour', 360, 66000);
update ish.applications set status = 'completed', check_in_at = now() - interval '7 hours',
       check_out_at = now() - interval '1 hour', worked_minutes = 360, pay_amount = 66000
  where id = '30000000-0000-0000-0000-000000000075';
insert into ish.ratings (application_id, direction, rater_id, stars)
values ('30000000-0000-0000-0000-000000000075', 'business_to_worker', '00000000-0000-0000-0000-0000000000b1', 5);
insert into ish.favorites (business_id, worker_id)
values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1');
-- a3 waits for s2 (the business decides) and holds a place on s5 with a2.
insert into ish.applications (id, shift_id, worker_id, status)
values ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-0000000000a3', 'pending');
insert into ish.applications (id, shift_id, worker_id, status, decided_at)
values ('30000000-0000-0000-0000-000000000053', '20000000-0000-0000-0000-000000000005',
        '00000000-0000-0000-0000-0000000000a3', 'confirmed', now() - interval '1 day');

-- BA1: the owner's board for the last day and the next three.
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
select tests.eq(jsonb_array_length(ish.business_board('10000000-0000-0000-0000-000000000001',
                now() - interval '1 day', now() + interval '4 days')), 7, 'every shift of biz1 in the window');
select tests.eq((ish.business_board('10000000-0000-0000-0000-000000000001',
                 now() - interval '1 day', now() + interval '4 days') -> 0 ->> 'id'),
                '20000000-0000-0000-0000-000000000007', 'earliest first (s7 started 7 h ago)');

-- BA3: one shift with what the business sees about each worker.
select tests.eq(jsonb_array_length(ish.employer_shift('20000000-0000-0000-0000-000000000007') -> 'applicants'), 2,
                's7 has two workers');
select tests.eq((select a -> 'worker' ->> 'first_name'
                 from jsonb_array_elements(ish.employer_shift('20000000-0000-0000-0000-000000000007') -> 'applicants') a
                 where a ->> 'application_id' = '30000000-0000-0000-0000-000000000075'), 'Malika', 'the name');
select tests.eq((select (a -> 'worker' ->> 'rating')::numeric
                 from jsonb_array_elements(ish.employer_shift('20000000-0000-0000-0000-000000000007') -> 'applicants') a
                 where a ->> 'application_id' = '30000000-0000-0000-0000-000000000075'), 5.0, 'the rating businesses gave');
select tests.eq((select (a -> 'worker' ->> 'shifts_here')::int
                 from jsonb_array_elements(ish.employer_shift('20000000-0000-0000-0000-000000000007') -> 'applicants') a
                 where a ->> 'application_id' = '30000000-0000-0000-0000-000000000071'), 1, '우리 매장 1회');
select tests.eq((select a -> 'worker' -> 'languages'
                 from jsonb_array_elements(ish.employer_shift('20000000-0000-0000-0000-000000000007') -> 'applicants') a
                 where a ->> 'application_id' = '30000000-0000-0000-0000-000000000071'), '["uz", "ru", "en", "ko"]'::jsonb,
                'languages in the worker''s order');
select tests.eq((select (a -> 'worker' ->> 'favorite')::boolean
                 from jsonb_array_elements(ish.employer_shift('20000000-0000-0000-0000-000000000007') -> 'applicants') a
                 where a ->> 'application_id' = '30000000-0000-0000-0000-000000000071'), true, 'the favourite star');
select tests.eq((select a ->> 'status'
                 from jsonb_array_elements(ish.employer_shift('20000000-0000-0000-0000-000000000002') -> 'applicants') a),
                'pending', 'an applicant waiting for the business');
select tests.eq((select (a ->> 'late_minutes')::int
                 from jsonb_array_elements(ish.employer_shift('20000000-0000-0000-0000-000000000005') -> 'applicants') a
                 where a ->> 'application_id' = '30000000-0000-0000-0000-000000000005'),
                2, 'attendance: in 2 minutes late');

-- BA4: workers who completed a shift here, and favourites.
select tests.eq(jsonb_array_length(ish.business_workers('10000000-0000-0000-0000-000000000001')), 2,
                'a1 and a2 have worked at biz1');
select tests.ok(not exists (select 1 from jsonb_array_elements(ish.business_workers('10000000-0000-0000-0000-000000000001')) w
                            where w ->> 'first_name' = 'Timur'), 'an applicant who never worked here is not listed');

-- Nobody else reads a business's board.
select tests.as_user('00000000-0000-0000-0000-0000000000b2');
select tests.throws($$select ish.business_board('10000000-0000-0000-0000-000000000001', now(), now() + interval '1 day')$$,
                    'NOT_FOUND', 'another owner');
select tests.throws($$select ish.employer_shift('20000000-0000-0000-0000-000000000001')$$, 'NOT_FOUND',
                    'another owner, one shift');
select tests.throws($$select ish.business_workers('10000000-0000-0000-0000-000000000001')$$, 'NOT_FOUND',
                    'another owner, workers');
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.throws($$select ish.business_board('10000000-0000-0000-0000-000000000001', now(), now() + interval '1 day')$$,
                    'NOT_FOUND', 'a worker');
select tests.as_anon();
select tests.throws($$select ish.business_workers('10000000-0000-0000-0000-000000000001')$$, 'permission denied',
                    'signed out');

-- Editing: the owner may change a shift nobody holds yet …
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
update ish.shifts set starts_at = starts_at + interval '1 hour', ends_at = ends_at + interval '1 hour', slots = 3
  where id = '20000000-0000-0000-0000-000000000001';
select tests.as_admin();
select tests.eq((select slots from ish.shifts where id = '20000000-0000-0000-0000-000000000001'), 3::smallint,
                'a free shift can be moved and grown');

-- … but not move one that workers hold, or drop places below them.
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
select tests.throws($$update ish.shifts set starts_at = starts_at + interval '1 hour', ends_at = ends_at + interval '1 hour'
                      where id = '20000000-0000-0000-0000-000000000004'$$, 'HAS_CREW', 'moving a shift with a crew');
select tests.throws($$update ish.shifts set slots = 0 where id = '20000000-0000-0000-0000-000000000004'$$,
                    'SLOTS_BELOW_CREW', 'no fewer places than the one worker holding s4');
update ish.shifts set slots = 1 where id = '20000000-0000-0000-0000-000000000004';
select tests.throws($$update ish.shifts set slots = 1 where id = '20000000-0000-0000-0000-000000000005'$$,
                    'SLOTS_BELOW_CREW', 'fewer places than the two workers holding s5');
select tests.throws($$update ish.shifts set hourly_wage = 9000 where id = '20000000-0000-0000-0000-000000000001'$$,
                    'WAGE_BELOW_MINIMUM', 'the minimum wage still holds');
select tests.throws($$update ish.shifts set title = '마감' where id = '20000000-0000-0000-0000-000000000007'$$,
                    'SHIFT_ENDED', 'a finished shift');
select tests.throws($$update ish.shifts set starts_at = now() - interval '1 hour', ends_at = now() + interval '3 hours'
                      where id = '20000000-0000-0000-0000-000000000002'$$, 'IN_THE_PAST', 'moving into the past');

-- Posting into the past is refused; the admin (fixtures, upkeep) is not limited.
select tests.throws($$insert into ish.shifts (business_id, title, starts_at, ends_at, hourly_wage, slots)
                      values ('10000000-0000-0000-0000-000000000001', '홀', now() - interval '1 hour', now() + interval '3 hours', 10800, 1)$$,
                    'IN_THE_PAST', 'a shift that has already started');
insert into ish.shifts (business_id, title, starts_at, ends_at, hourly_wage, slots)
  values ('10000000-0000-0000-0000-000000000001', '홀', now() + interval '1 day', now() + interval '1 day 4 hours', 10800, 1);
select tests.as_admin();
select tests.eq((select count(*)::int from ish.shifts where title = '홀'), 1, 'a future shift is posted');
