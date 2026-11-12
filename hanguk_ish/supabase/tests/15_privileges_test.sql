-- Functions that run with their owner's rights (security definer) skip RLS,
-- so each one a signed-in person can call checks who is calling. This is
-- the reviewed list: a new one must be checked and added here, or revoked
-- from anon and authenticated like the internal helpers (cards, notify,
-- upkeep jobs, register_business). Trigger functions cannot be called
-- directly and are left out.
select tests.eq(
  (select coalesce(array_agg(p.proname::text order by p.proname), '{}')
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'ish' and p.prosecdef and p.prorettype <> 'trigger'::regtype
     and has_function_privilege('authenticated', p.oid, 'EXECUTE')),
  array[
    'apply_to_shift', 'business_board', 'business_report', 'business_stats', 'business_workers',
    'cancel_application', 'cancel_shift', 'check_in', 'check_out', 'decide_application', 'decline_job_offer',
    'employer_shift', 'is_application_party', 'is_business_member', 'is_my_applicant', 'is_shift_member',
    'is_staff', 'mark_notifications_read', 'my_businesses', 'my_notifications', 'my_profile', 'my_shift',
    'my_shifts', 'open_business', 'rate_business', 'register_push_token', 'request_again', 'save_worker_profile',
    'set_shift_paid', 'shift_details', 'shift_feed', 'shift_qr',
    -- The staff's (hanguk.uz): each starts with require_staff().
    'staff_board', 'staff_businesses', 'staff_candidates', 'staff_mark_attendance', 'staff_save_business',
    'staff_save_shift', 'staff_send_offers', 'staff_shift',
    'toggle_favorite', 'worker_earnings', 'worker_stats'
  ]::text[],
  'the owner-rights functions open to signed-in people are the reviewed ones');

select tests.eq(
  (select coalesce(array_agg(p.proname::text order by p.proname), '{}')
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'ish' and p.prosecdef and p.prorettype <> 'trigger'::regtype
     and has_function_privilege('anon', p.oid, 'EXECUTE')),
  '{}'::text[],
  'none is open to the signed-out');

-- Tables: the signed-out have no rights on any (everything goes through a
-- session), and every table has row level security on.
select tests.eq(
  (select coalesce(array_agg(distinct table_name::text), '{}')
   from information_schema.role_table_grants
   where table_schema = 'ish' and grantee = 'anon'),
  '{}'::text[],
  'the signed-out have no rights on any table');

-- register_business files a business for anyone with any 국세청 answer: only
-- the business-register function (service role) may call it.
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
select tests.throws(
  $$select ish.register_business('00000000-0000-0000-0000-0000000000b1', '9990000108', 'x', '01')$$,
  'permission denied', 'an owner cannot file a verified business by hand');
select tests.throws($$select ish.notify('00000000-0000-0000-0000-0000000000a1', 'paid', '{}')$$,
                    'permission denied', 'nor send anyone a notification');
select tests.throws($$select ish.qr_token_for('20000000-0000-0000-0000-000000000001')$$,
                    'permission denied', 'nor read a door code token');

select tests.as_admin();
select tests.eq(
  (select coalesce(array_agg(c.relname::text order by c.relname), '{}')
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'ish' and c.relkind = 'r' and not c.relrowsecurity),
  '{}'::text[],
  'every table has row level security on');
