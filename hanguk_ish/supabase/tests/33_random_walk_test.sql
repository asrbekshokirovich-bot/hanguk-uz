-- A random walk through what the two apps can do, with the seed fixed so it
-- repeats: workers apply and cancel; the owner decides, changes places, moves,
-- switches 자동 확정, cancels and posts shifts; workers check in and out with
-- the shift's QR; the hourly job runs; time passes. After every step the rules
-- that must always hold are checked. A broken one fails the file with the step
-- and the last actions.
--
-- «Time passes» moves every recorded time 30 minutes back (now() is fixed for
-- the whole transaction), which is the same as the clock moving on.

select tests.as_admin();

-- Six more workers near biz1 (w1–w6), onboarded, free at any hour.
insert into auth.users (id, phone)
select ('00000000-0000-0000-0000-0000000001' || lpad(i::text, 2, '0'))::uuid, '+82100000021' || i
from generate_series(1, 6) i;
insert into public.worker_profiles (user_id, languages, topik, district, lat, lng, availability, onboarded_at)
select ('00000000-0000-0000-0000-0000000001' || lpad(i::text, 2, '0'))::uuid, '{uz,ko}', 3, 'Mapo-gu',
       37.5559 + i * 0.001, 126.9368, 268435455, now()
from generate_series(1, 6) i;

-- The fixtures' applications are made up for other tests (a2 is on two
-- overlapping shifts, which the apps cannot do); the walk starts from none.
delete from public.applications;
delete from public.notifications;

create temp table walk_log (step int, action text, outcome text, detail text);

-- The rules. [p_after_job]: the hourly job has just run.
create function pg_temp.check_rules(p_step int, p_after_job boolean) returns void
language plpgsql as $$
declare
  v text;
begin
  -- Never more people on a shift than its places.
  select string_agg(s.id::text || ' ' || n || '/' || s.slots, ', ') into v
  from public.shifts s
  cross join lateral (
    select count(*) as n from public.applications a
    where a.shift_id = s.id and a.status in ('confirmed', 'checked_in', 'completed')
  ) c
  where c.n > s.slots;
  if v is not null then raise exception 'step %: more crew than places: %', p_step, v; end if;

  -- A worker never holds two live applications at overlapping times.
  select string_agg(distinct a1.worker_id::text, ', ') into v
  from public.applications a1
  join public.shifts s1 on s1.id = a1.shift_id
  join public.applications a2 on a2.worker_id = a1.worker_id and a2.id <> a1.id
  join public.shifts s2 on s2.id = a2.shift_id
  where a1.status in ('pending', 'confirmed', 'checked_in')
    and a2.status in ('pending', 'confirmed', 'checked_in')
    and tstzrange(s1.starts_at, s1.ends_at) && tstzrange(s2.starts_at, s2.ends_at);
  if v is not null then raise exception 'step %: overlapping live applications of %', p_step, v; end if;

  -- A called-off shift keeps nobody waiting or confirmed.
  select string_agg(a.id::text, ', ') into v
  from public.applications a join public.shifts s on s.id = a.shift_id
  where s.status = 'cancelled' and a.status in ('pending', 'confirmed');
  if v is not null then raise exception 'step %: live applications on a cancelled shift: %', p_step, v; end if;

  -- A full shift keeps nobody waiting: they are told it is full (as when the
  -- last place is confirmed on BA3).
  select string_agg(a.id::text, ', ') into v
  from public.applications a join public.shifts s on s.id = a.shift_id
  where a.status = 'pending'
    and (select count(*) from public.applications c
         where c.shift_id = s.id and c.status in ('confirmed', 'checked_in', 'completed')) >= s.slots;
  if v is not null then raise exception 'step %: waiting on a full shift: %', p_step, v; end if;

  -- Each status has the times and amounts that go with it.
  select string_agg(a.id::text || ' ' || a.status, ', ') into v
  from public.applications a join public.shifts s on s.id = a.shift_id
  where not case a.status
    when 'pending' then a.decided_at is null and a.check_in_at is null and a.cancelled_at is null
    when 'confirmed' then a.decided_at is not null and a.check_in_at is null
    when 'checked_in' then a.check_in_at is not null and a.check_out_at is null and a.late_minutes is not null
    when 'completed' then a.check_in_at is not null and a.check_out_at is not null
      and a.worked_minutes between 0 and extract(epoch from s.ends_at - s.starts_at) / 60
      and a.pay_amount = (s.hourly_wage::bigint * a.worked_minutes / 60)::int
    when 'rejected' then a.decided_at is not null and a.check_in_at is null
    when 'cancelled' then a.cancelled_at is not null and a.check_in_at is null
    when 'no_show' then a.check_in_at is null
  end
  or (a.late_cancel and a.status <> 'cancelled');
  if v is not null then raise exception 'step %: status without its times: %', p_step, v; end if;

  -- Check-in happened inside the QR window (from 30 minutes before the start).
  select string_agg(a.id::text, ', ') into v
  from public.applications a join public.shifts s on s.id = a.shift_id
  where a.check_in_at is not null
    and not (a.check_in_at >= s.starts_at - interval '30 minutes' and a.check_in_at < s.ends_at);
  if v is not null then raise exception 'step %: check-in outside the window: %', p_step, v; end if;

  if p_after_job then
    -- Right after the job: no one waits on a started shift, no one is still
    -- «confirmed» on a finished one.
    select string_agg(a.id::text || ' ' || a.status, ', ') into v
    from public.applications a join public.shifts s on s.id = a.shift_id
    where (a.status = 'pending' and s.starts_at <= now())
       or (a.status = 'confirmed' and s.ends_at <= now());
    if v is not null then raise exception 'step %: left behind by the job: %', p_step, v; end if;
  end if;
end $$;

create function pg_temp.walk(p_seed double precision, p_steps int) returns jsonb
language plpgsql as $$
declare
  v_workers uuid[] := array(
    select id from auth.users where id::text like '00000000-0000-0000-0000-0000000001%'
    union all select '00000000-0000-0000-0000-0000000000a1'::uuid
    union all select '00000000-0000-0000-0000-0000000000a2'::uuid);
  v_owner constant uuid := '00000000-0000-0000-0000-0000000000b1';
  v_biz constant uuid := '10000000-0000-0000-0000-000000000001';
  v_actions constant text[] := array[
    'apply', 'apply', 'apply', 'apply', 'cancel', 'decide', 'decide', 'decide', 'places', 'move',
    'auto', 'cancel_shift', 'post', 'post', 'check_in', 'check_in', 'check_out', 'check_out', 'job', 'time'];
  v_action text;
  v_outcome text;
  v_detail text;
  v_shift uuid;
  v_app uuid;
  v_worker uuid;
  v_payload text;
  v_start timestamptz;
  v_log text;
  v_tally jsonb := '{}'::jsonb;
begin
  perform setseed(p_seed);
  for i in 1 .. p_steps loop
    v_action := v_actions[1 + floor(random() * array_length(v_actions, 1))::int];
    v_outcome := 'ok';
    v_detail := null;
    v_shift := null;
    v_app := null;
    begin
      case v_action
      when 'apply' then
        v_worker := v_workers[1 + floor(random() * array_length(v_workers, 1))::int];
        -- Mostly a shift still open to applications; sometimes any (refusals).
        select id into v_shift from public.shifts
        where business_id = v_biz and (random() < 0.15 or (status = 'open' and starts_at > now()))
        order by random() limit 1;
        v_detail := v_worker || ' → ' || v_shift;
        perform tests.as_user(v_worker);
        perform public.apply_to_shift(v_shift);
      when 'cancel' then
        select a.id, a.worker_id into v_app, v_worker from public.applications a
        where a.status in ('pending', 'confirmed') order by random() limit 1;
        if v_app is null then
          v_outcome := 'nothing';
        else
          v_detail := v_app::text;
          perform tests.as_user(v_worker);
          perform public.cancel_application(v_app);
        end if;
      when 'decide' then
        select a.id into v_app from public.applications a join public.shifts s on s.id = a.shift_id
        where a.status = 'pending' and s.business_id = v_biz order by random() limit 1;
        if v_app is null then
          v_outcome := 'nothing';
        else
          v_detail := v_app::text;
          perform tests.as_user(v_owner);
          perform public.decide_application(v_app, random() < 0.75);
        end if;
      when 'places' then
        select id into v_shift from public.shifts where business_id = v_biz and status = 'open'
        order by random() limit 1;
        v_detail := v_shift::text;
        perform tests.as_user(v_owner);
        update public.shifts set slots = greatest(1, least(4, slots + case when random() < 0.5 then -1 else 1 end))
        where id = v_shift;
      when 'move' then
        select id into v_shift from public.shifts where business_id = v_biz and status = 'open'
        order by random() limit 1;
        v_detail := v_shift::text;
        perform tests.as_user(v_owner);
        update public.shifts
        set starts_at = starts_at + interval '90 minutes', ends_at = ends_at + interval '90 minutes'
        where id = v_shift;
      when 'auto' then
        select id into v_shift from public.shifts where business_id = v_biz and status = 'open'
        order by random() limit 1;
        v_detail := v_shift::text;
        perform tests.as_user(v_owner);
        update public.shifts set auto_confirm = not auto_confirm where id = v_shift;
      when 'cancel_shift' then
        select id into v_shift from public.shifts where business_id = v_biz and status = 'open'
        order by random() limit 1;
        v_detail := v_shift::text;
        perform tests.as_user(v_owner);
        perform public.cancel_shift(v_shift);
      when 'post' then
        -- Half start within three hours (QR soon), half within two days.
        v_start := now() + make_interval(mins => 30 + floor(random() * case when random() < 0.5 then 150 else 2880 end)::int);
        perform tests.as_user(v_owner);
        insert into public.shifts (business_id, title, starts_at, ends_at, hourly_wage, slots, auto_confirm)
        values (v_biz, '랜덤 근무', v_start, v_start + make_interval(hours => 2 + floor(random() * 5)::int),
                10500, 1 + floor(random() * 3)::int, random() < 0.5)
        returning id into v_shift;
        v_detail := v_shift::text;
      when 'check_in', 'check_out' then
        -- Mostly someone whose QR window is open now; sometimes anyone (refusals).
        select a.id, a.worker_id, a.shift_id into v_app, v_worker, v_shift
        from public.applications a join public.shifts s on s.id = a.shift_id
        where a.status = case v_action when 'check_in' then 'confirmed' else 'checked_in' end::public.application_status
          and (random() < 0.15 or now() between s.starts_at - interval '30 minutes' and s.ends_at)
        order by random() limit 1;
        if v_app is null then
          v_outcome := 'nothing';
        else
          v_detail := v_app::text;
          perform tests.as_user(v_owner);
          v_payload := public.shift_qr(v_shift);
          perform tests.as_user(v_worker);
          if v_action = 'check_in' then
            perform public.check_in(v_payload);
          else
            perform public.check_out(v_payload);
          end if;
        end if;
      when 'job' then
        perform tests.as_admin();
        perform public.close_finished_shifts();
      when 'time' then
        perform tests.as_admin();
        update public.shifts set starts_at = starts_at - interval '30 minutes', ends_at = ends_at - interval '30 minutes';
        update public.applications set
          created_at = created_at - interval '30 minutes',
          decided_at = decided_at - interval '30 minutes',
          cancelled_at = cancelled_at - interval '30 minutes',
          check_in_at = check_in_at - interval '30 minutes',
          check_out_at = check_out_at - interval '30 minutes',
          paid_at = paid_at - interval '30 minutes';
      end case;
    exception when others then
      v_outcome := sqlerrm;
    end;
    perform tests.as_admin();
    insert into walk_log values (i, v_action, v_outcome, v_detail);
    v_tally := v_tally || jsonb_build_object(v_action || ':' || v_outcome,
                                             coalesce((v_tally ->> (v_action || ':' || v_outcome))::int, 0) + 1);
    begin
      perform pg_temp.check_rules(i, v_action = 'job' and v_outcome = 'ok');
    exception when others then
      select string_agg(format('%s %s → %s (%s)', step, action, outcome, coalesce(detail, '')), E'\n' order by step)
        into v_log
      from (select * from walk_log order by step desc limit 12) t;
      raise exception E'FAILED (seed %): %\nlast steps:\n%', p_seed, sqlerrm, v_log;
    end;
  end loop;
  return v_tally;
end $$;

-- Each seed starts from the fixtures again: its changes are undone after it
-- (a rolled-back block), only its tally is kept. In one long transaction the
-- rows the walk keeps rewriting would otherwise pile up and slow every step.
create temp table walk_totals (step text, n int);
create function pg_temp.walk_from_start(p_seed double precision, p_steps int) returns void
language plpgsql as $$
declare
  v_tally jsonb;
begin
  begin
    v_tally := pg_temp.walk(p_seed, p_steps);
    raise exception 'UNDO THE WALK';
  exception when raise_exception then
    if sqlerrm <> 'UNDO THE WALK' then
      raise;
    end if;
  end;
  insert into walk_totals select key, value::int from jsonb_each_text(v_tally);
end $$;

select pg_temp.walk_from_start(0.11, 500);
select pg_temp.walk_from_start(0.37, 500);
select pg_temp.walk_from_start(0.73, 500);

-- The walk did reach every kind of step, successful and refused.
select tests.ok((select sum(n) from walk_totals where step = a || ':ok') > 0, 'the walk did ' || a)
from unnest(array['apply', 'cancel', 'decide', 'places', 'move', 'auto', 'cancel_shift', 'post',
                  'check_in', 'check_out', 'job', 'time']) a;
select tests.ok((select sum(n) from walk_totals where step like '%:' || r) > 0, 'a refusal came: ' || r)
from unnest(array['SHIFT_FULL', 'TIME_CONFLICT', 'HAS_CREW', 'TOO_EARLY']) r;
