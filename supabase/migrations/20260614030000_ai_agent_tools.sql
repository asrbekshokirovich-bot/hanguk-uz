-- Hanguk AI — agentic tool layer (Phase 1).
--
-- The assistant could previously only see aggregate COUNTS injected into its
-- prompt, so it could never LIST/FILTER actual rows ("list the documents pending
-- review with student names" was impossible by construction). These typed RPCs
-- are the agent's structured query tools: a small, governed "metrics layer" the
-- model calls to fetch real rows on demand.
--
-- Design (per the research in docs/HANGUK_AI_UPGRADE_RESEARCH_AND_PLAN.md):
--   • SECURITY DEFINER so a staff member can read across all students
--     deterministically (not dependent on every table's RLS), BUT every function
--     gates on `ai_is_staff(auth.uid())` — so it only works when called by a real
--     authenticated STAFF user (i.e. via a user-scoped client that carries the
--     caller's JWT). A student/anon caller is rejected.
--   • set search_path = '' + fully-qualified names (search-path-hijack hardening).
--   • per-function statement_timeout (runaway-query guard).
--   • optional filters via `(p_x IS NULL OR col = p_x)` (NULL = "any").
--   • return jsonb {total, limit, offset, rows} in a single scan via count(*) OVER().
--   • execute granted to `authenticated` only (revoked from public/anon).

-- ---------------------------------------------------------------------------
-- Staff gate
-- ---------------------------------------------------------------------------
create or replace function public.ai_is_staff(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_uid is not null
     and exists (select 1 from public.user_roles ur where ur.user_id = p_uid);
$$;

revoke execute on function public.ai_is_staff(uuid) from public, anon;
grant  execute on function public.ai_is_staff(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Quick CRM stats (structured, not just a sentence)
-- ---------------------------------------------------------------------------
create or replace function public.ai_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set statement_timeout to '6s'
as $$
declare v jsonb;
begin
  if not public.ai_is_staff(auth.uid()) then
    raise exception 'not authorized: staff only';
  end if;
  select jsonb_build_object(
    'students',            (select count(*) from public.profiles p
                              where not exists (select 1 from public.user_roles ur where ur.user_id = p.user_id)),
    'leads',               (select count(*) from public.leads),
    'documents_total',     (select count(*) from public.documents),
    'documents_pending',   (select count(*) from public.documents where status = 'uploaded'),
    'documents_approved',  (select count(*) from public.documents where status = 'approved'),
    'payments_overdue',    (select count(*) from public.payments where status = 'overdue'),
    'tasks_open',          (select count(*) from public.tasks where status in ('todo','in_progress')),
    'leads_new',           (select count(*) from public.leads where status = 'new')
  ) into v;
  return v;
end;
$$;

-- ---------------------------------------------------------------------------
-- Documents (THE screenshot fix: "list documents pending review with names")
--   status values: 'uploaded' (= pending review), 'approved', 'rejected', ...
-- ---------------------------------------------------------------------------
create or replace function public.ai_list_documents(
  p_status     text default null,
  p_student_id uuid default null,
  p_from       timestamptz default null,
  p_to         timestamptz default null,
  p_limit      int default 50,
  p_offset     int default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set statement_timeout to '6s'
as $$
declare
  v jsonb;
  v_lim int := least(coalesce(p_limit, 50), 200);
  v_off int := greatest(coalesce(p_offset, 0), 0);
begin
  if not public.ai_is_staff(auth.uid()) then
    raise exception 'not authorized: staff only';
  end if;
  with f as (
    select d.id, d.name, d.status, d.notes, d.created_at, d.reviewed_at,
           d.student_id, p.full_name as student_name, p.phone as student_phone,
           count(*) over () as total
    from public.documents d
    left join public.profiles p on p.user_id = d.student_id
    where (p_status is null or d.status = p_status)
      and (p_student_id is null or d.student_id = p_student_id)
      and (p_from is null or d.created_at >= p_from)
      and (p_to   is null or d.created_at <  p_to)
    order by d.created_at desc
    limit v_lim offset v_off
  )
  select jsonb_build_object(
    'total',  coalesce((select total from f limit 1), 0),
    'limit',  v_lim, 'offset', v_off,
    'rows',   coalesce(jsonb_agg(to_jsonb(f) - 'total'), '[]'::jsonb)
  ) into v from f;
  return v;
end;
$$;

-- ---------------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------------
create or replace function public.ai_list_payments(
  p_status       text default null,
  p_student_id   uuid default null,
  p_overdue_only boolean default false,
  p_limit        int default 50,
  p_offset       int default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set statement_timeout to '6s'
as $$
declare
  v jsonb;
  v_lim int := least(coalesce(p_limit, 50), 200);
  v_off int := greatest(coalesce(p_offset, 0), 0);
begin
  if not public.ai_is_staff(auth.uid()) then
    raise exception 'not authorized: staff only';
  end if;
  with f as (
    select pm.id, pm.payment_type, pm.amount, pm.paid_amount, pm.currency,
           pm.status, pm.due_date, pm.paid_at, pm.invoice_number,
           pm.student_id, p.full_name as student_name, p.phone as student_phone,
           count(*) over () as total
    from public.payments pm
    left join public.profiles p on p.user_id = pm.student_id
    where (p_status is null or pm.status = p_status)
      and (p_student_id is null or pm.student_id = p_student_id)
      and (not coalesce(p_overdue_only, false)
           or pm.status = 'overdue'
           or (pm.due_date is not null and pm.due_date < now() and pm.status <> 'completed'))
    order by pm.due_date asc nulls last
    limit v_lim offset v_off
  )
  select jsonb_build_object(
    'total',  coalesce((select total from f limit 1), 0),
    'limit',  v_lim, 'offset', v_off,
    'rows',   coalesce(jsonb_agg(to_jsonb(f) - 'total'), '[]'::jsonb)
  ) into v from f;
  return v;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------
create or replace function public.ai_list_tasks(
  p_status   text default null,
  p_priority text default null,
  p_limit    int default 50,
  p_offset   int default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set statement_timeout to '6s'
as $$
declare
  v jsonb;
  v_lim int := least(coalesce(p_limit, 50), 200);
  v_off int := greatest(coalesce(p_offset, 0), 0);
begin
  if not public.ai_is_staff(auth.uid()) then
    raise exception 'not authorized: staff only';
  end if;
  with f as (
    select t.id, t.title, t.description, t.priority, t.status,
           t.due_date, t.completed_at, t.student_id, t.assigned_to,
           count(*) over () as total
    from public.tasks t
    where (p_status   is null or t.status   = p_status)
      and (p_priority is null or t.priority = p_priority)
    order by t.due_date asc nulls last
    limit v_lim offset v_off
  )
  select jsonb_build_object(
    'total',  coalesce((select total from f limit 1), 0),
    'limit',  v_lim, 'offset', v_off,
    'rows',   coalesce(jsonb_agg(to_jsonb(f) - 'total'), '[]'::jsonb)
  ) into v from f;
  return v;
end;
$$;

-- ---------------------------------------------------------------------------
-- Leads (rich pipeline filters)
-- ---------------------------------------------------------------------------
create or replace function public.ai_list_leads(
  p_query          text default null,
  p_status         text default null,
  p_source         text default null,
  p_exam_type      text default null,
  p_city           text default null,
  p_interest_level text default null,
  p_from_exam_date date default null,
  p_to_exam_date   date default null,
  p_limit          int default 50,
  p_offset         int default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set statement_timeout to '6s'
as $$
declare
  v jsonb;
  v_lim int := least(coalesce(p_limit, 50), 200);
  v_off int := greatest(coalesce(p_offset, 0), 0);
  v_q   text := nullif(btrim(coalesce(p_query, '')), '');
begin
  if not public.ai_is_staff(auth.uid()) then
    raise exception 'not authorized: staff only';
  end if;
  with f as (
    select l.id, l.full_name, l.phone, l.email, l.status, l.source,
           l.interest_level, l.priority_score, l.city, l.korean_level,
           l.education_level, l.exam_type, l.exam_date, l.target_intake,
           l.preferred_program, l.preferred_university, l.next_follow_up,
           l.created_at,
           count(*) over () as total
    from public.leads l
    where (p_status         is null or l.status         = p_status)
      and (p_source         is null or l.source         = p_source)
      and (p_exam_type      is null or l.exam_type       = p_exam_type)
      and (p_city           is null or l.city ilike '%' || p_city || '%')
      and (p_interest_level is null or l.interest_level  = p_interest_level)
      and (p_from_exam_date is null or l.exam_date >= p_from_exam_date)
      and (p_to_exam_date   is null or l.exam_date <= p_to_exam_date)
      and (v_q is null
           or l.full_name ilike '%' || v_q || '%'
           or l.phone     ilike '%' || v_q || '%')
    order by l.priority_score desc nulls last, l.created_at desc
    limit v_lim offset v_off
  )
  select jsonb_build_object(
    'total',  coalesce((select total from f limit 1), 0),
    'limit',  v_lim, 'offset', v_off,
    'rows',   coalesce(jsonb_agg(to_jsonb(f) - 'total'), '[]'::jsonb)
  ) into v from f;
  return v;
end;
$$;

-- ---------------------------------------------------------------------------
-- Students (non-staff profiles), with optional name/phone/city filter
-- ---------------------------------------------------------------------------
create or replace function public.ai_list_students(
  p_query  text default null,
  p_city   text default null,
  p_limit  int default 50,
  p_offset int default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set statement_timeout to '6s'
as $$
declare
  v jsonb;
  v_lim int := least(coalesce(p_limit, 50), 200);
  v_off int := greatest(coalesce(p_offset, 0), 0);
  v_q   text := nullif(btrim(coalesce(p_query, '')), '');
begin
  if not public.ai_is_staff(auth.uid()) then
    raise exception 'not authorized: staff only';
  end if;
  with f as (
    select p.user_id, p.full_name, p.phone, p.city, p.created_at,
           count(*) over () as total
    from public.profiles p
    where not exists (select 1 from public.user_roles ur where ur.user_id = p.user_id)
      and (p_city is null or p.city ilike '%' || p_city || '%')
      and (v_q is null
           or public.hanguk_normalize_name(p.full_name) like '%' || public.hanguk_normalize_name(v_q) || '%'
           or p.phone ilike '%' || v_q || '%')
    order by p.full_name asc nulls last
    limit v_lim offset v_off
  )
  select jsonb_build_object(
    'total',  coalesce((select total from f limit 1), 0),
    'limit',  v_lim, 'offset', v_off,
    'rows',   coalesce(jsonb_agg(to_jsonb(f) - 'total'), '[]'::jsonb)
  ) into v from f;
  return v;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants: authenticated only (the auth.uid() staff gate does the real check).
-- ---------------------------------------------------------------------------
do $$
declare fn text;
begin
  foreach fn in array array[
    'public.ai_stats()',
    'public.ai_list_documents(text,uuid,timestamptz,timestamptz,int,int)',
    'public.ai_list_payments(text,uuid,boolean,int,int)',
    'public.ai_list_tasks(text,text,int,int)',
    'public.ai_list_leads(text,text,text,text,text,text,date,date,int,int)',
    'public.ai_list_students(text,text,int,int)'
  ]
  loop
    execute format('revoke execute on function %s from public, anon;', fn);
    execute format('grant execute on function %s to authenticated, service_role;', fn);
  end loop;
end;
$$;
