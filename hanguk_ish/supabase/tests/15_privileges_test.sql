-- Functions that run with their owner's rights (security definer) skip RLS,
-- so each one a signed-in person can call checks who is calling. This is
-- the reviewed list: a new one must be checked and added here, or revoked
-- from anon and authenticated like the internal helpers (cards, notify,
-- upkeep jobs, register_business). Trigger functions cannot be called
-- directly and are left out.
select tests.eq(
  (select coalesce(array_agg(p.proname::text order by p.proname::text collate "C"), '{}')
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'ish' and p.prosecdef and p.prorettype <> 'trigger'::regtype
     and has_function_privilege('authenticated', p.oid, 'EXECUTE')),
  (select array_agg(f order by f collate "C") from unnest(array[
    'apply_to_shift', 'business_board', 'business_report', 'business_stats', 'business_workers',
    'cancel_application', 'cancel_shift', 'check_in', 'check_out', 'confirm_payment', 'decide_application', 'decline_job_offer',
    'employer_shift', 'is_application_party', 'is_business_member', 'is_my_applicant', 'is_shift_member',
    'is_staff', 'is_staff_admin', 'mark_notifications_read', 'market_wage', 'my_businesses', 'my_coins', 'my_jobs', 'my_notifications', 'my_offers', 'my_profile', 'my_shift',
    'my_shifts', 'my_trust', 'open_business', 'rate_business', 'rate_job', 'register_push_token', 'report_worker', 'request_again', 'save_worker_place', 'save_worker_profile',
    'set_job_step', 'set_shift_paid', 'shift_details', 'shift_feed', 'shift_qr',
    -- The staff's (hanguk.uz): each starts with require_staff(); the staff list
    -- (P58) with require_staff_admin().
    'staff_add', 'staff_add_coins', 'staff_app_businesses', 'staff_board', 'staff_businesses', 'staff_candidates', 'staff_coin_workers', 'staff_job_details', 'staff_mark_attendance', 'staff_monthly_interest',
    'staff_people', 'staff_remove', 'staff_reports', 'staff_save_business', 'staff_save_shift', 'staff_send_offers',
    'staff_set_app_business_blocked', 'staff_set_report_status', 'staff_set_role', 'staff_shift',
    'staff_update_app_business',
    'toggle_favorite', 'unlock_offer', 'update_my_business', 'worker_earnings', 'worker_stats',
    -- Nov 24 fixes: long-term jobs behind a pyol unlock (see 20261124100000).
    'public_monthly_jobs', 'staff_monthly_jobs', 'unlock_monthly_job',
    -- Refunds (20261124110000).
    'staff_cancel_shift', 'staff_refund_unlock',
    -- The pyol plan (20261124120000).
    'my_referral', 'payment_details', 'request_topup', 'set_referrer',
    'staff_approve_topup', 'staff_confirm_two_weeks', 'staff_mark_fee_paid', 'staff_mark_hired',
    'staff_monthly_hires', 'staff_pyol_report', 'staff_reject_topup', 'staff_set_payment_setting',
    'staff_topups',
    -- «My free dates» (20261124130000).
    'my_free_dates', 'set_free_dates', 'staff_free_dates_summary', 'staff_free_workers',
    -- Cards and the employer invite (20261125100000).
    'my_business_card', 'my_card', 'set_business_invite', 'staff_card', 'staff_cards', 'staff_clear_card',
    'staff_give_business_card'
  ]::text[]) f),
  'the owner-rights functions open to signed-in people are the reviewed ones');

select tests.eq(
  (select coalesce(array_agg(p.proname::text order by p.proname::text collate "C"), '{}')
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'ish' and p.prosecdef and p.prorettype <> 'trigger'::regtype
     and has_function_privilege('anon', p.oid, 'EXECUTE')),
  array['public_monthly_jobs']::text[],
  'only the public list of long-term jobs (company and address hidden) is open to the signed-out');

-- Tables: the signed-out have no rights on any (everything goes through a
-- session), and every table has row level security on.
select tests.eq(
  (select coalesce(array_agg(distinct table_name::text), '{}')
   from information_schema.role_table_grants
   where table_schema = 'ish' and grantee = 'anon'),
  '{}'::text[],
  'the signed-out have no rights on any table (the public page reads public_monthly_jobs())');

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
