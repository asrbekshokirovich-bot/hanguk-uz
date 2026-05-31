-- ============================================================================
--  uni_db — open the HITL review queue to all non-student staff
--
--  Until now only profiles.role in ('uni_db_reviewer','admin','uni_db_admin')
--  could read the review_queue or run the accept/edit/reject RPCs, so the
--  founder was the single bottleneck for the whole pipeline.
--
--  Per owner decision (2026-05-23): ANY non-student staff member may review.
--  Staff are modelled in public.user_roles (app_role enum); the five staff
--  roles are owner / admin / call_operator / document_handler /
--  university_staff. Plain students live in profiles.role='student' and are
--  NOT in user_roles, so "exists a user_roles row" already means "is staff".
--  We still list the roles explicitly so a future 'student' enum value can
--  never accidentally grant review access.
--
--  The review console itself lives in the Lovable admin web app, which calls
--  Supabase with each staff member's authenticated JWT — so RLS + the RPC
--  role checks are the real authorization boundary (not any client gate).
--
--  Idempotent: CREATE OR REPLACE / DROP POLICY IF EXISTS throughout.
-- ============================================================================

set local search_path = public, pg_catalog;

-- ----------------------------------------------------------------------------
--  1. Helper — true iff the caller may review uni_db extractions.
--     SECURITY DEFINER so it can read user_roles regardless of the caller's
--     own RLS on that table.
-- ----------------------------------------------------------------------------
create or replace function public.fn_can_review_uni_db(p_uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_catalog
as $$
  select coalesce(
    exists (
      select 1 from public.profiles p
      where p.user_id = p_uid
        and p.role in ('uni_db_reviewer', 'admin', 'uni_db_admin')
    )
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = p_uid
        and ur.role::text in (
          'owner', 'admin', 'call_operator', 'document_handler', 'university_staff'
        )
    ),
    false
  );
$$;

revoke all on function public.fn_can_review_uni_db(uuid) from public;
grant execute on function public.fn_can_review_uni_db(uuid) to anon, authenticated;

comment on function public.fn_can_review_uni_db(uuid) is
  'Authorization helper — true for legacy uni_db reviewer roles OR any '
  'non-student staff member (user_roles app_role). Used by the review_queue '
  'RLS policy and the fn_review_* action RPCs.';

-- ----------------------------------------------------------------------------
--  2. Widen the review_queue SELECT policy to all reviewers (staff).
-- ----------------------------------------------------------------------------
drop policy if exists review_queue_reviewer_select on public.review_queue;
create policy review_queue_reviewer_select on public.review_queue
  for select using (public.fn_can_review_uni_db());

-- ----------------------------------------------------------------------------
--  3. Let reviewers read the data they actually review.
--     extraction_jobs is admin/service-only today (`using (false)`), and the
--     dashboard views left-join it for the extracted JSON + archetype. Add a
--     permissive reviewer-scoped SELECT (additive — student policies untouched).
-- ----------------------------------------------------------------------------
drop policy if exists extraction_jobs_reviewer_read on public.extraction_jobs;
create policy extraction_jobs_reviewer_read on public.extraction_jobs
  for select using (public.fn_can_review_uni_db());

-- guideline_documents — the source PDF metadata the reviewer compares against.
drop policy if exists guideline_documents_reviewer_read on public.guideline_documents;
create policy guideline_documents_reviewer_read on public.guideline_documents
  for select using (public.fn_can_review_uni_db());

-- institutions — for the university name shown next to each queue item.
drop policy if exists institutions_reviewer_read on public.institutions;
create policy institutions_reviewer_read on public.institutions
  for select using (public.fn_can_review_uni_db());

-- ----------------------------------------------------------------------------
--  4. Repoint the three action RPCs at the new helper.
--     Bodies are unchanged except the role guard.
-- ----------------------------------------------------------------------------
create or replace function public.fn_review_accept(
  queue_item_id    uuid,
  reviewer_user_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_caller uuid := coalesce(reviewer_user_id, auth.uid());
  v_id     uuid;
begin
  if v_caller is null then
    raise exception 'fn_review_accept: no reviewer_user_id and auth.uid() is null';
  end if;

  if not public.fn_can_review_uni_db(v_caller) then
    raise exception 'fn_review_accept: caller % is not authorized to review', v_caller;
  end if;

  update public.review_queue
     set status            = 'approved',
         assigned_to       = v_caller,
         reviewer_decision = null,
         reviewer_notes    = null
   where id = queue_item_id
     and status in ('open', 'in_review')
   returning id into v_id;

  if v_id is null then
    raise exception 'fn_review_accept: queue item % not found or already terminal',
      queue_item_id;
  end if;

  return v_id;
end $$;

create or replace function public.fn_review_edit_accept(
  queue_item_id     uuid,
  corrected_payload jsonb,
  reviewer_user_id  uuid default null,
  reviewer_notes    text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_caller uuid := coalesce(reviewer_user_id, auth.uid());
  v_id     uuid;
begin
  if v_caller is null then
    raise exception 'fn_review_edit_accept: no reviewer_user_id and auth.uid() is null';
  end if;

  if corrected_payload is null or corrected_payload = '{}'::jsonb then
    raise exception 'fn_review_edit_accept: corrected_payload must be non-empty';
  end if;

  if not public.fn_can_review_uni_db(v_caller) then
    raise exception 'fn_review_edit_accept: caller % is not authorized to review', v_caller;
  end if;

  update public.review_queue
     set status            = 'approved',
         assigned_to       = v_caller,
         reviewer_decision = corrected_payload,
         reviewer_notes    = reviewer_notes
   where id = queue_item_id
     and status in ('open', 'in_review')
   returning id into v_id;

  if v_id is null then
    raise exception 'fn_review_edit_accept: queue item % not found or already terminal',
      queue_item_id;
  end if;

  return v_id;
end $$;

create or replace function public.fn_review_reject(
  queue_item_id    uuid,
  reason           text,
  reason_detail    text default null,
  reviewer_user_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_caller uuid := coalesce(reviewer_user_id, auth.uid());
  v_id     uuid;
  v_notes  text;
begin
  if v_caller is null then
    raise exception 'fn_review_reject: no reviewer_user_id and auth.uid() is null';
  end if;

  if reason is null or reason not in (
    'wrong_year', 'wrong_archetype', 'hallucinated_field',
    'ocr_garbled', 'source_404', 'other'
  ) then
    raise exception 'fn_review_reject: reason must be one of '
      'wrong_year/wrong_archetype/hallucinated_field/ocr_garbled/source_404/other (got %)',
      coalesce(reason, 'NULL');
  end if;

  if not public.fn_can_review_uni_db(v_caller) then
    raise exception 'fn_review_reject: caller % is not authorized to review', v_caller;
  end if;

  v_notes := reason || coalesce(': ' || reason_detail, '');

  update public.review_queue
     set status            = 'rejected',
         assigned_to       = v_caller,
         reviewer_decision = jsonb_build_object('reason', reason, 'detail', reason_detail),
         reviewer_notes    = v_notes
   where id = queue_item_id
     and status in ('open', 'in_review')
   returning id into v_id;

  if v_id is null then
    raise exception 'fn_review_reject: queue item % not found or already terminal',
      queue_item_id;
  end if;

  return v_id;
end $$;
