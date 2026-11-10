-- The business confirms or turns down applicants (BA3).

-- s2 (1 slot, manual): a1 and a2 both apply.
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select public.apply_to_shift('20000000-0000-0000-0000-000000000002');
select tests.as_user('00000000-0000-0000-0000-0000000000a2');
select public.apply_to_shift('20000000-0000-0000-0000-000000000002');

select tests.as_admin();
create temp table ids as
  select worker_id, id from public.applications where shift_id = '20000000-0000-0000-0000-000000000002';
grant select on ids to authenticated;

-- Another business cannot decide.
select tests.as_user('00000000-0000-0000-0000-0000000000b2');
select tests.throws($$select public.decide_application(
                      (select id from ids where worker_id = '00000000-0000-0000-0000-0000000000a1'), true)$$,
                    'NOT_FOUND', 'only members of the shift''s business decide');

-- A worker cannot confirm themselves.
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.throws($$select public.decide_application(
                      (select id from ids where worker_id = '00000000-0000-0000-0000-0000000000a1'), true)$$,
                    'NOT_FOUND', 'a worker cannot confirm their own application');

-- The owner confirms a1: the shift is full, so a2 is turned down.
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
select tests.eq((public.decide_application(
                  (select id from ids where worker_id = '00000000-0000-0000-0000-0000000000a1'), true)).status::text,
                'confirmed', 'owner confirms');
select tests.eq((select status::text from public.applications
                 where id = (select id from ids where worker_id = '00000000-0000-0000-0000-0000000000a2')),
                'rejected', 'the other waiting applicant is turned down once the shift is full');
select tests.throws($$select public.decide_application(
                      (select id from ids where worker_id = '00000000-0000-0000-0000-0000000000a2'), true)$$,
                    'NOT_PENDING', 'a decided application cannot be decided again');

select tests.as_admin();
select tests.eq((select count(*)::int from public.notifications
                 where user_id = '00000000-0000-0000-0000-0000000000a1' and kind = 'application_confirmed'),
                1, 'a1 is told about the confirmation');
select tests.eq((select data->>'reason' from public.notifications
                 where user_id = '00000000-0000-0000-0000-0000000000a2' and kind = 'application_rejected'),
                'full', 'a2 is told the shift filled up');

-- A slot frees up when a1 cancels; a turned-down worker may apply again.
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select public.cancel_application((select id from ids where worker_id = '00000000-0000-0000-0000-0000000000a1'));
select tests.as_user('00000000-0000-0000-0000-0000000000a2');
select tests.eq((public.apply_to_shift('20000000-0000-0000-0000-000000000002')).status::text, 'pending',
                'after a cancellation the shift takes applications again');

-- Rejecting.
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
select tests.eq((public.decide_application(
                  (select id from public.applications where shift_id = '20000000-0000-0000-0000-000000000002'
                   and status = 'pending'), false)).status::text,
                'rejected', 'owner turns an applicant down');

-- Cancelling the whole shift tells everyone still on it.
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select public.apply_to_shift('20000000-0000-0000-0000-000000000003');
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
select tests.eq((public.cancel_shift('20000000-0000-0000-0000-000000000003')).status::text, 'cancelled',
                'the business cancels a shift');
select tests.as_admin();
select tests.eq((select status::text from public.applications
                 where shift_id = '20000000-0000-0000-0000-000000000003'), 'rejected',
                'its workers are released');
select tests.eq((select data->>'reason' from public.notifications
                 where user_id = '00000000-0000-0000-0000-0000000000a1' and data->>'shift_id' = '20000000-0000-0000-0000-000000000003'),
                'shift_cancelled', 'and told why');
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
select tests.throws($$select public.cancel_shift('20000000-0000-0000-0000-000000000005')$$,
                    'SHIFT_STARTED', 'a running shift cannot be cancelled');
