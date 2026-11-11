-- How long what the apps and the jobs ask takes, on the scale data
-- (tests/perf/seed.sql). Each call runs [runs] times; the fastest counts.
-- A call slower than its limit fails: the limits are about ten times the
-- times measured when this was written (P32), so only a real slowdown —
-- a lost index, a plan gone wrong — trips them, not a slow machine.
\set ON_ERROR_STOP 1
\pset pager off
create function pg_temp.ms(label text, stmt text, who uuid, limit_ms int, runs int default 3) returns void
language plpgsql as $$
declare
  t0 timestamptz;
  best double precision := 1e9;
begin
  for i in 1..runs loop
    if who is not null then perform tests.as_user(who); else perform tests.as_admin(); end if;
    t0 := clock_timestamp();
    execute stmt;
    best := least(best, extract(epoch from clock_timestamp() - t0) * 1000);
    perform tests.as_admin();
  end loop;
  raise notice '% ms  (limit %)  %', lpad(to_char(best, 'FM99990.0'), 8), lpad(limit_ms::text, 5), label;
  if best > limit_ms then
    raise exception 'TOO SLOW: % took % ms (limit % ms)', label, round(best::numeric, 1), limit_ms;
  end if;
end $$;

\o /dev/null
begin;
-- Worker 1 and the owner of business 1 (seed.sql).
select pg_temp.ms('A03 shift_feed, 3 km, 2 days',
  $$select public.shift_feed(now(), now() + interval '2 days', 37.55, 126.95, 3, null, null)$$,
  '00000000-0000-0000-0001-000000000001', 600);
select pg_temp.ms('A03 shift_feed, no radius, 14 days (200 at most)',
  $$select public.shift_feed(now(), now() + interval '14 days', 37.55, 126.95, null, null, null)$$,
  '00000000-0000-0000-0001-000000000001', 2000);
select pg_temp.ms('A05 shift_details',
  $$select public.shift_details((select id from public.shifts where starts_at > now() order by starts_at limit 1), 37.55, 126.95)$$,
  '00000000-0000-0000-0001-000000000001', 300);
select pg_temp.ms('A06 my_shifts', $$select public.my_shifts()$$,
  '00000000-0000-0000-0001-000000000001', 200);
select pg_temp.ms('A12 my_notifications',
  $$select public.my_notifications(100, '{shift_reminder,application_confirmed,application_rejected,new_shift_match,nearby_digest,request_again,chat_message,payment_marked}')$$,
  '00000000-0000-0000-0001-000000000001', 200);
select pg_temp.ms('A09 worker_earnings, a year',
  $$select public.worker_earnings((now() - interval '365 days')::date, now()::date)$$,
  '00000000-0000-0000-0001-000000000001', 200);
select pg_temp.ms('A11 my_profile', $$select public.my_profile()$$,
  '00000000-0000-0000-0001-000000000001', 100);
select pg_temp.ms('BA1 business_board, 15 days',
  $$select public.business_board('10000000-0000-0000-0001-000000000001', now(), now() + interval '15 days')$$,
  '00000000-0000-0000-0002-000000000001', 300);
select pg_temp.ms('BA1 business_stats',
  $$select public.business_stats('10000000-0000-0000-0001-000000000001')$$,
  '00000000-0000-0000-0002-000000000001', 100);
select pg_temp.ms('BA3 employer_shift',
  $$select public.employer_shift((select id from public.shifts where business_id = '10000000-0000-0000-0001-000000000001' and starts_at > now() order by starts_at limit 1))$$,
  '00000000-0000-0000-0002-000000000001', 100);
select pg_temp.ms('BA4 business_workers',
  $$select public.business_workers('10000000-0000-0000-0001-000000000001')$$,
  '00000000-0000-0000-0002-000000000001', 1000);
select pg_temp.ms('BA5 business_report, 90 days',
  $$select public.business_report('10000000-0000-0000-0001-000000000001', (now() - interval '90 days')::date, now()::date)$$,
  '00000000-0000-0000-0002-000000000001', 200);
select pg_temp.ms('BA2 posting a shift (and telling the workers near it)',
  $$insert into public.shifts (business_id, title, starts_at, ends_at, hourly_wage, slots, auto_confirm)
    values ('10000000-0000-0000-0001-000000000001', 'perf', date_trunc('hour', now()) + interval '30 hours',
            date_trunc('hour', now()) + interval '34 hours', 11000, 2, true)$$,
  '00000000-0000-0000-0002-000000000001', 700);
select pg_temp.ms('A05 apply_to_shift',
  $$select public.apply_to_shift((select id from public.shifts where title = 'perf' limit 1))$$,
  '00000000-0000-0000-0001-000000000002', 300, 1);
select pg_temp.ms('job close_finished_shifts (every 10 min)', $$select public.close_finished_shifts()$$, null, 3000);
select pg_temp.ms('job queue_shift_reminders (every 10 min)', $$select public.queue_shift_reminders()$$, null, 1000);
select pg_temp.ms('job queue_nearby_digests (daily)', $$select public.queue_nearby_digests()$$, null, 25000);
rollback;
