-- Taking and cancelling shifts.

select tests.as_user('00000000-0000-0000-0000-0000000000a1');

-- Auto-confirm shift: confirmed at once, the business is told.
select tests.eq((ish.apply_to_shift('20000000-0000-0000-0000-000000000001')).status::text, 'confirmed',
                'auto-confirm shift is confirmed at once');
select tests.throws($$select ish.apply_to_shift('20000000-0000-0000-0000-000000000001')$$,
                    'ALREADY_APPLIED', 'no second application');
select tests.throws($$select ish.apply_to_shift('20000000-0000-0000-0000-000000000003')$$,
                    'TIME_CONFLICT', 'no overlapping shift');
select tests.throws($$select ish.apply_to_shift('20000000-0000-0000-0000-000000000008')$$,
                    'SHIFT_CLOSED', 'not a shift of an unverified business');
select tests.throws($$select ish.apply_to_shift('20000000-0000-0000-0000-000000000005')$$,
                    'SHIFT_STARTED', 'not a shift that already started');

-- Manual shift: waits for the business.
select tests.eq((ish.apply_to_shift('20000000-0000-0000-0000-000000000002')).status::text, 'pending',
                'manual shift waits for the business');

select tests.as_admin();
select tests.eq((select count(*)::int from ish.notifications
                 where user_id = '00000000-0000-0000-0000-0000000000b1' and kind = 'new_applicant'),
                2, 'the business got a notice per application');

-- s1 has 3 slots after the schema test? No — fixtures: 2 slots. a2 takes the second.
select tests.as_user('00000000-0000-0000-0000-0000000000a2');
select tests.eq((ish.apply_to_shift('20000000-0000-0000-0000-000000000001')).status::text, 'confirmed',
                'second worker fills the last slot');

-- Not onboarded.
select tests.as_user('00000000-0000-0000-0000-0000000000a3');
select tests.throws($$select ish.apply_to_shift('20000000-0000-0000-0000-000000000003')$$,
                    'PROFILE_INCOMPLETE', 'onboarding must be finished first');

-- Full: a3 finishes onboarding, s1 is full.
select tests.as_admin();
update ish.worker_profiles set onboarded_at = now() where user_id = '00000000-0000-0000-0000-0000000000a3';
select tests.as_user('00000000-0000-0000-0000-0000000000a3');
select tests.throws($$select ish.apply_to_shift('20000000-0000-0000-0000-000000000001')$$,
                    'SHIFT_FULL', 'no more than the slots');

-- The owner cannot take their own shift.
select tests.as_admin();
insert into ish.worker_profiles (user_id, onboarded_at) values ('00000000-0000-0000-0000-0000000000b1', now());
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
select tests.throws($$select ish.apply_to_shift('20000000-0000-0000-0000-000000000003')$$,
                    'OWN_SHIFT', 'a member cannot take their own business''s shift');

-- Cancelling: free more than 24 h ahead.
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.eq((ish.cancel_application(
                  (select id from ish.applications where shift_id = '20000000-0000-0000-0000-000000000001'
                   and worker_id = '00000000-0000-0000-0000-0000000000a1'))).late_cancel, false,
                'cancel two days ahead is free');
select tests.eq((select reliability::int from ish.worker_profiles where user_id = '00000000-0000-0000-0000-0000000000a1'),
                100, 'no penalty');
-- After cancelling, the slot is free again and the worker may re-apply.
select tests.eq((ish.apply_to_shift('20000000-0000-0000-0000-000000000001')).status::text, 'confirmed',
                'a cancelled worker can take the shift again');

-- Late: s4 starts in 20 minutes.
select tests.eq((ish.cancel_application('30000000-0000-0000-0000-000000000004')).late_cancel, true,
                'cancel 20 minutes ahead is late');
select tests.eq((select reliability::int from ish.worker_profiles where user_id = '00000000-0000-0000-0000-0000000000a1'),
                95, 'late cancel costs 5 points');
select tests.throws($$select ish.cancel_application('30000000-0000-0000-0000-000000000004')$$,
                    'CANNOT_CANCEL', 'cannot cancel twice');

-- Started shifts cannot be cancelled.
select tests.as_user('00000000-0000-0000-0000-0000000000a2');
select tests.throws($$select ish.cancel_application('30000000-0000-0000-0000-000000000005')$$,
                    'CANNOT_CANCEL', 'a checked-in shift cannot be cancelled');

-- Someone else's application.
select tests.throws($$select ish.cancel_application('30000000-0000-0000-0000-000000000004')$$,
                    'NOT_FOUND', 'cannot cancel another worker''s application');
