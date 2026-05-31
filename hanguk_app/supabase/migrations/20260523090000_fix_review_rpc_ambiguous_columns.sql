-- ============================================================================
--  Fix: fn_review_reject / fn_review_edit_accept ambiguous column reference
--
--  Both RPCs threw Postgres 42702 ("column reference 'reason' / 'reviewer_notes'
--  is ambiguous") whenever a reviewer tried to Reject or Edit-and-accept a
--  queue item. Cause: inside `update public.review_queue ...`, the function
--  PARAMETERS `reason` / `reviewer_notes` share their names with
--  review_queue COLUMNS of the same name, so the bare references in the SET
--  list are ambiguous. (fn_review_accept was unaffected — it sets those
--  columns to NULL literals and never reads the params.)
--
--  This blocked two of the three reviewer actions in production; staff could
--  only Accept as-is. Pre-existing since 20260701001000; the staff-access
--  migration (20260523080000) carried the same bodies forward.
--
--  Fix: copy the params into local variables before the UPDATE and reference
--  the locals. The function SIGNATURES are unchanged (same parameter names),
--  so PostgREST calls from the web/app — rpc('fn_review_reject', {reason,
--  reason_detail}) etc. — keep working without any client change.
--
--  Idempotent: CREATE OR REPLACE.
-- ============================================================================

set local search_path = public, pg_catalog;

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
  v_reason text := reason;          -- copy params to locals to avoid the
  v_detail text := reason_detail;   -- review_queue.reason / .reviewer_notes
  v_notes  text;                    -- column-name collision (42702)
  v_id     uuid;
begin
  if v_caller is null then
    raise exception 'fn_review_reject: no reviewer_user_id and auth.uid() is null';
  end if;

  if v_reason is null or v_reason not in (
    'wrong_year', 'wrong_archetype', 'hallucinated_field',
    'ocr_garbled', 'source_404', 'other'
  ) then
    raise exception 'fn_review_reject: reason must be one of '
      'wrong_year/wrong_archetype/hallucinated_field/ocr_garbled/source_404/other (got %)',
      coalesce(v_reason, 'NULL');
  end if;

  if not public.fn_can_review_uni_db(v_caller) then
    raise exception 'fn_review_reject: caller % is not authorized to review', v_caller;
  end if;

  v_notes := v_reason || coalesce(': ' || v_detail, '');

  update public.review_queue
     set status            = 'rejected',
         assigned_to       = v_caller,
         reviewer_decision = jsonb_build_object('reason', v_reason, 'detail', v_detail),
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
  v_notes  text := reviewer_notes;  -- local copy: avoids the column collision
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
         reviewer_notes    = v_notes
   where id = queue_item_id
     and status in ('open', 'in_review')
   returning id into v_id;

  if v_id is null then
    raise exception 'fn_review_edit_accept: queue item % not found or already terminal',
      queue_item_id;
  end if;

  return v_id;
end $$;
