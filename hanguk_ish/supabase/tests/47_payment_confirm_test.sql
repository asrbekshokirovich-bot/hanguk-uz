-- The worker says what was actually paid (confirm_payment): the amount is kept,
-- A09 counts it, less than the shift came to files an «unpaid» report for the
-- staff, and only the worker of a finished shift can say it.

-- Aziz (a1) finished the shift he was on: 3 h, 36 000 won.
update ish.applications set status = 'completed', check_out_at = now(), worked_minutes = 180, pay_amount = 36000
where id = '30000000-0000-0000-0000-000000000004';
-- The finish told him (shift_finished).
select tests.eq((select count(*)::int from ish.notifications
                 where user_id = '00000000-0000-0000-0000-0000000000a1' and kind = 'shift_finished'
                   and data ->> 'application_id' = '30000000-0000-0000-0000-000000000004'), 1,
                'a finished shift tells the worker');

select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.ok((ish.my_shift('30000000-0000-0000-0000-000000000004') ->> 'received_amount') is null,
                'nothing said yet');

-- Paid in full: kept, no report.
select ish.confirm_payment('30000000-0000-0000-0000-000000000004', 36000);
select tests.eq((ish.my_shift('30000000-0000-0000-0000-000000000004') ->> 'received_amount')::int, 36000,
                'the amount the worker received is on his card');
select tests.as_admin();
select tests.eq((select count(*)::int from ish.reports where application_id = '30000000-0000-0000-0000-000000000004'), 0,
                'the full amount is no complaint');
select tests.ok((select received_at is not null from ish.applications where id = '30000000-0000-0000-0000-000000000004'),
                'and when he said it');

-- Less: he can correct it, and the staff get a report.
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select ish.confirm_payment('30000000-0000-0000-0000-000000000004', 30000);
select tests.as_admin();
select tests.eq((select received_amount from ish.applications where id = '30000000-0000-0000-0000-000000000004'), 30000,
                'the worker corrects the amount');
select tests.eq((select reason from ish.reports where application_id = '30000000-0000-0000-0000-000000000004'), 'unpaid',
                'less than it came to: the staff see an «unpaid» report');

-- Not for others, not for what is not finished, not nonsense.
select tests.as_user('00000000-0000-0000-0000-0000000000a2');
select tests.throws($$select ish.confirm_payment('30000000-0000-0000-0000-000000000004', 1)$$,
                    'NOT_FOUND', 'only the worker of that shift');
select tests.throws($$select ish.confirm_payment('30000000-0000-0000-0000-000000000006', 1)$$,
                    'NOT_COMPLETED', 'only after the shift is finished');
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.throws($$select ish.confirm_payment('30000000-0000-0000-0000-000000000004', -5)$$,
                    'INVALID', 'no negative amounts');
select tests.as_anon();
select tests.throws($$select ish.confirm_payment('30000000-0000-0000-0000-000000000004', 1)$$,
                    'permission denied', 'nor the signed-out');
