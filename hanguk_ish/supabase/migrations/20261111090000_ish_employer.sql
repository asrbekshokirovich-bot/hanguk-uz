-- Hanguk Ish — what the employer app («Hanguk Ish 사장님») reads in one
-- round trip, and the rules for editing a shift (P7, 2026-11-11).
--
--   * business_board(): BA1 / BA3 — shifts with every application and what
--     the business sees about each worker (name, rating, shifts, TOPIK,
--     languages, favourite);
--   * employer_shift(): BA3 — one shift the same way;
--   * business_workers(): BA4 — everyone who has worked at the business or
--     is one of its favourites, most recent first;
--   * shifts_guard: a member may not move a shift once workers hold places,
--     drop places below them, post into the past or edit a shift that ended.
-- Errors carry the same stable codes as the other functions.

-- ---------------------------------------------------------------------------
-- What a business sees about one worker (internal)
-- ---------------------------------------------------------------------------

create function public.worker_card(p_worker uuid, p_business uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', p.id,
    'first_name', p.first_name,
    'last_name', p.last_name,
    'avatar_path', p.avatar_path,
    'topik', coalesce(w.topik, 0),
    'languages', to_jsonb(coalesce(w.languages, '{}')),
    'reliability', w.reliability,
    'rating', (
      select round(avg(r.stars)::numeric, 1)
      from public.ratings r join public.applications a on a.id = r.application_id
      where a.worker_id = p.id and r.direction = 'business_to_worker'),
    'completed_shifts', (
      select count(*)::int from public.applications
      where worker_id = p.id and status = 'completed'),
    'shifts_here', (
      select count(*)::int from public.applications a join public.shifts s on s.id = a.shift_id
      where a.worker_id = p.id and s.business_id = p_business and a.status = 'completed'),
    'last_worked_at', (
      select max(s.ends_at) from public.applications a join public.shifts s on s.id = a.shift_id
      where a.worker_id = p.id and s.business_id = p_business and a.status = 'completed'),
    'favorite', exists (
      select 1 from public.favorites f where f.business_id = p_business and f.worker_id = p.id)
  )
  from public.profiles p
  left join public.worker_profiles w on w.user_id = p.id
  where p.id = p_worker
$$;

-- One shift with its applications, oldest application first (internal).
create function public.shift_board(p_shift uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', s.id,
    'business_id', s.business_id,
    'template_id', s.template_id,
    'title', s.title,
    'duties', s.duties,
    'dress', s.dress,
    'address', s.address,
    'starts_at', s.starts_at,
    'ends_at', s.ends_at,
    'hourly_wage', s.hourly_wage,
    'slots', s.slots,
    'auto_confirm', s.auto_confirm,
    'status', s.status,
    'applicants', coalesce((
      select jsonb_agg(jsonb_build_object(
          'application_id', a.id,
          'status', a.status,
          'created_at', a.created_at,
          'decided_at', a.decided_at,
          'check_in_at', a.check_in_at,
          'check_out_at', a.check_out_at,
          'late_minutes', a.late_minutes,
          'worked_minutes', a.worked_minutes,
          'pay_amount', a.pay_amount,
          'paid_at', a.paid_at,
          'worker', public.worker_card(a.worker_id, s.business_id)
        ) order by a.created_at, a.id)
      from public.applications a
      where a.shift_id = s.id), '[]'::jsonb)
  )
  from public.shifts s
  where s.id = p_shift
$$;

revoke execute on function public.worker_card(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.shift_board(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Reads for members of a business
-- ---------------------------------------------------------------------------

-- BA1 / BA3: the business's shifts starting in [p_from, p_to), earliest first.
create function public.business_board(p_business uuid, p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_uid();
  if not public.is_business_member(p_business) then
    raise exception 'NOT_FOUND';
  end if;
  return coalesce((
    select jsonb_agg(public.shift_board(s.id) order by s.starts_at, s.id)
    from public.shifts s
    where s.business_id = p_business and s.starts_at >= p_from and s.starts_at < p_to
  ), '[]'::jsonb);
end
$$;

-- BA3: one shift of a business the caller belongs to.
create function public.employer_shift(p_shift uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_business uuid;
begin
  perform public.require_uid();
  select business_id into v_business from public.shifts where id = p_shift;
  if v_business is null or not public.is_business_member(v_business) then
    raise exception 'NOT_FOUND';
  end if;
  return public.shift_board(p_shift);
end
$$;

-- BA4: the business's workers — anyone who completed a shift there, and its
-- favourites — the most recent first.
create function public.business_workers(p_business uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_uid();
  if not public.is_business_member(p_business) then
    raise exception 'NOT_FOUND';
  end if;
  return coalesce((
    select jsonb_agg(card order by (card->>'last_worked_at') desc nulls last,
                                   (card->>'shifts_here')::int desc,
                                   card->>'first_name')
    from (
      select public.worker_card(w.worker_id, p_business) as card
      from (
        select a.worker_id
        from public.applications a join public.shifts s on s.id = a.shift_id
        where s.business_id = p_business and a.status = 'completed'
        union
        select f.worker_id from public.favorites f where f.business_id = p_business
      ) w
    ) cards
  ), '[]'::jsonb);
end
$$;

revoke execute on function public.business_board(uuid, timestamptz, timestamptz) from public, anon;
revoke execute on function public.employer_shift(uuid) from public, anon;
revoke execute on function public.business_workers(uuid) from public, anon;
grant execute on function public.business_board(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.employer_shift(uuid) to authenticated;
grant execute on function public.business_workers(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Editing a shift (members, through PostgREST)
-- ---------------------------------------------------------------------------

-- Applies to the app's own requests (role authenticated); functions that run
-- as the owner (decide, cancel, upkeep) and the service role are not limited.
create function public.shifts_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_taken int;
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.starts_at <= now() then
      raise exception 'IN_THE_PAST';
    end if;
    return new;
  end if;
  if old.status <> 'open' then
    raise exception 'SHIFT_CLOSED';
  end if;
  if old.ends_at <= now() then
    raise exception 'SHIFT_ENDED';
  end if;
  -- Members see their shift's applications (RLS), so the count is complete.
  select count(*)::int into v_taken from public.applications
  where shift_id = old.id and status in ('confirmed', 'checked_in', 'completed');
  if (new.starts_at, new.ends_at) is distinct from (old.starts_at, old.ends_at) then
    if v_taken > 0 then
      raise exception 'HAS_CREW';
    end if;
    if new.starts_at <= now() then
      raise exception 'IN_THE_PAST';
    end if;
  end if;
  if new.slots < v_taken then
    raise exception 'SLOTS_BELOW_CREW';
  end if;
  return new;
end
$$;

create trigger shifts_guard before insert or update on public.shifts
  for each row execute function public.shifts_guard();
