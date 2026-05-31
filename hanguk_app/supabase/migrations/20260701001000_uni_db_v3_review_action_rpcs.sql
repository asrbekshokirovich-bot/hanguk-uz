-- ============================================================================
--  uni_db v3 — review action RPCs (fn_review_accept / _edit_accept / _reject)
--  + reviewer SELECT policy on review_queue
--
--  Wires the helpers referenced by docs/runbooks/reviewer-onboarding.md and
--  by the next-session-prompt's Phase 3R-A. Also closes a gap discovered on
--  2026-05-10 — the prior review_queue RLS only allowed admin SELECT, so a
--  uni_db_reviewer user querying v_review_queue_dashboard (security_invoker)
--  would have received an empty result set.
--
--  The three RPCs are SECURITY DEFINER + run with a pinned search_path. They
--  verify the caller is a reviewer/admin themselves, then UPDATE the queue
--  row. The existing trg_review_queue_audit trigger (see
--  20260605000200_uni_db_v1_reviewer_assignment.sql) handles the
--  review_decisions audit-log insert atomically when status transitions.
--
--  Idempotent (CREATE OR REPLACE / DROP IF EXISTS / IF NOT EXISTS).
-- ============================================================================

set local search_path = public, pg_catalog;

-- ----------------------------------------------------------------------------
-- 0. Reviewer SELECT policy on review_queue
--    Without this, security_invoker views return empty for reviewers.
-- ----------------------------------------------------------------------------

drop policy if exists review_queue_reviewer_select on public.review_queue;
create policy review_queue_reviewer_select on public.review_queue
  for select using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.role in ('uni_db_reviewer', 'admin', 'uni_db_admin')
    )
  );

-- ----------------------------------------------------------------------------
-- 1. fn_review_accept — accept the queue item exactly as extracted.
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
  v_role   text;
  v_id     uuid;
begin
  if v_caller is null then
    raise exception 'fn_review_accept: no reviewer_user_id and auth.uid() is null';
  end if;

  select role into v_role from public.profiles where user_id = v_caller;
  if v_role is null or v_role not in ('uni_db_reviewer', 'admin', 'uni_db_admin') then
    raise exception 'fn_review_accept: caller % is not a uni_db reviewer (role=%)',
      v_caller, coalesce(v_role, 'NULL');
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

revoke all on function public.fn_review_accept(uuid, uuid) from public;
grant execute on function public.fn_review_accept(uuid, uuid)
  to authenticated, service_role;

comment on function public.fn_review_accept(uuid, uuid) is
  'Plan §G.5 — accept a HITL queue item as-is. Trigger-driven audit log insert.';

-- ----------------------------------------------------------------------------
-- 2. fn_review_edit_accept — accept with a corrected payload.
-- ----------------------------------------------------------------------------

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
  v_role   text;
  v_id     uuid;
begin
  if v_caller is null then
    raise exception 'fn_review_edit_accept: no reviewer_user_id and auth.uid() is null';
  end if;

  if corrected_payload is null or corrected_payload = '{}'::jsonb then
    raise exception 'fn_review_edit_accept: corrected_payload must be non-empty';
  end if;

  select role into v_role from public.profiles where user_id = v_caller;
  if v_role is null or v_role not in ('uni_db_reviewer', 'admin', 'uni_db_admin') then
    raise exception 'fn_review_edit_accept: caller % is not a uni_db reviewer (role=%)',
      v_caller, coalesce(v_role, 'NULL');
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

revoke all on function public.fn_review_edit_accept(uuid, jsonb, uuid, text) from public;
grant execute on function public.fn_review_edit_accept(uuid, jsonb, uuid, text)
  to authenticated, service_role;

comment on function public.fn_review_edit_accept(uuid, jsonb, uuid, text) is
  'Plan §G.5 — accept a HITL queue item with a corrected payload. Diff lands in review_decisions via trigger.';

-- ----------------------------------------------------------------------------
-- 3. fn_review_reject — reject with a reason code.
--    Reason codes mirror docs/runbooks/reviewer-onboarding.md §6.
-- ----------------------------------------------------------------------------

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
  v_role   text;
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

  select role into v_role from public.profiles where user_id = v_caller;
  if v_role is null or v_role not in ('uni_db_reviewer', 'admin', 'uni_db_admin') then
    raise exception 'fn_review_reject: caller % is not a uni_db reviewer (role=%)',
      v_caller, coalesce(v_role, 'NULL');
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

revoke all on function public.fn_review_reject(uuid, text, text, uuid) from public;
grant execute on function public.fn_review_reject(uuid, text, text, uuid)
  to authenticated, service_role;

comment on function public.fn_review_reject(uuid, text, text, uuid) is
  'Plan §G.5 — reject a HITL queue item with one of the six reason codes from reviewer-onboarding.md.';
