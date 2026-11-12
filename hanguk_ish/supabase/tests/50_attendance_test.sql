-- QR check-in and check-out (A07, BA3), pay (T7), reliability (T5).

select tests.as_user('00000000-0000-0000-0000-0000000000b1');
create temp table qr as select
  ish.shift_qr('20000000-0000-0000-0000-000000000004') as s4,
  ish.shift_qr('20000000-0000-0000-0000-000000000005') as s5,
  ish.shift_qr('20000000-0000-0000-0000-000000000006') as s6,
  ish.shift_qr('20000000-0000-0000-0000-000000000007') as s7;
select tests.as_admin();
grant select on qr to authenticated;

-- The same payload twice gives the same code (it is printed once, BA3).
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
select tests.eq(ish.shift_qr('20000000-0000-0000-0000-000000000004'), (select s4 from qr), 'QR is stable per shift');
select tests.ok((select s4 <> s5 from qr), 'and different for each shift');

select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.throws($$select ish.check_in('hello')$$, 'QR_INVALID', 'garbage is refused');
select tests.throws($$select ish.check_in(replace((select s4 from qr), right((select s4 from qr), 4), '0000'))$$,
                    'QR_INVALID', 'a forged token is refused');
select tests.throws($$select ish.check_in((select s5 from qr))$$,
                    'NOT_CONFIRMED', 'a worker not on the shift cannot check in');

-- s4 starts in 20 minutes: inside the 30-minute window.
select tests.eq((ish.check_in((select s4 from qr))).status::text, 'checked_in', 'check-in 20 minutes early works');
select tests.eq((select late_minutes from ish.applications where id = '30000000-0000-0000-0000-000000000004'),
                0, 'early is not late');
select tests.throws($$select ish.check_in((select s4 from qr))$$, 'ALREADY_CHECKED_IN', 'only once');

-- s6 starts in 2 hours: too early (a2 holds it).
select tests.as_user('00000000-0000-0000-0000-0000000000a2');
select tests.throws($$select ish.check_in((select s6 from qr))$$, 'TOO_EARLY', 'QR opens 30 minutes before');
select tests.throws($$select ish.check_out((select s6 from qr))$$, 'NOT_CHECKED_IN', 'cannot leave before arriving');

-- s7 ended an hour ago: too late to check in.
select tests.throws($$select ish.check_in((select s7 from qr))$$, 'TOO_LATE', 'QR check-in closes at the end');

-- s5: a2 checked in 2 min late 2 h 58 min ago; the shift (12 000/h) runs 2 more hours.
select tests.as_admin();
update ish.worker_profiles set reliability = 99 where user_id = '00000000-0000-0000-0000-0000000000a2';
select tests.as_user('00000000-0000-0000-0000-0000000000a2');
select tests.eq((ish.check_out((select s5 from qr))).status::text, 'completed', 'check-out completes the shift');
select tests.eq((select worked_minutes from ish.applications where id = '30000000-0000-0000-0000-000000000005'),
                178, 'paid from the actual arrival: 2 h 58 min');
select tests.eq((select pay_amount from ish.applications where id = '30000000-0000-0000-0000-000000000005'),
                35600, '178 min × 12 000 원/h = 35 600 원');
select tests.eq((select reliability::int from ish.worker_profiles where user_id = '00000000-0000-0000-0000-0000000000a2'),
                100, 'completed shift +1');
select tests.throws($$select ish.check_out((select s5 from qr))$$, 'ALREADY_CHECKED_OUT', 'only once');

-- Capped at the plan: arrive early, leave late → planned minutes only.
select tests.as_admin();
insert into ish.shifts (id, business_id, title, starts_at, ends_at, hourly_wage, slots, auto_confirm)
values ('20000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000001', '야간 보조',
        now() - interval '5 hours 30 minutes', now() - interval '30 minutes', 10800, 1, true);
insert into ish.applications (id, shift_id, worker_id, status, check_in_at, late_minutes)
values ('30000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000009',
        '00000000-0000-0000-0000-0000000000a1', 'checked_in', now() - interval '5 hours 45 minutes', 0);
create temp table qr9 as
  select 'hanguk-ish:v1:20000000-0000-0000-0000-000000000009:'
         || ish.qr_token_for('20000000-0000-0000-0000-000000000009') as payload;
grant select on qr9 to authenticated;
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.eq((ish.check_out((select payload from qr9))).worked_minutes, 300,
                'early arrival and late leave are capped at the planned 5 hours');
select tests.eq((select pay_amount from ish.applications where id = '30000000-0000-0000-0000-000000000009'),
                54000, '5 h × 10 800 원 = 54 000 원');

-- Check-out closes 2 hours after the end.
select tests.as_admin();
update ish.shifts set starts_at = now() - interval '8 hours', ends_at = now() - interval '2 hours 1 minute'
  where id = '20000000-0000-0000-0000-000000000005';
update ish.applications set status = 'checked_in', check_out_at = null, worked_minutes = null, pay_amount = null
  where id = '30000000-0000-0000-0000-000000000005';
select tests.as_user('00000000-0000-0000-0000-0000000000a2');
select tests.throws($$select ish.check_out((select s5 from qr))$$, 'TOO_LATE', 'check-out closes 2 h after the end');

-- Late arrival is measured in whole minutes (지각 from 1 minute, T6).
select tests.as_admin();
insert into ish.shifts (id, business_id, title, starts_at, ends_at, hourly_wage, slots, auto_confirm)
values ('20000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000001', '홀 보조',
        now() - interval '2 minutes 30 seconds', now() + interval '4 hours', 10800, 1, true);
insert into ish.applications (id, shift_id, worker_id, status)
values ('30000000-0000-0000-0000-000000000010', '20000000-0000-0000-0000-000000000010',
        '00000000-0000-0000-0000-0000000000a3', 'confirmed');
create temp table qr10 as
  select 'hanguk-ish:v1:20000000-0000-0000-0000-000000000010:'
         || ish.qr_token_for('20000000-0000-0000-0000-000000000010') as payload;
grant select on qr10 to authenticated;
select tests.as_user('00000000-0000-0000-0000-0000000000a3');
select tests.eq((ish.check_in((select payload from qr10))).late_minutes, 2, '2 min 30 s late = 지각 2분');
