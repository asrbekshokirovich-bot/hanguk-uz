-- 2026-09-01 audit finding, Stage 6 (no-downtime half) of
-- HEALTH_IMPLEMENTATION_PLAN.md. CONFIRMED LIVE against production, not
-- just migration text: fn_review_accept, fn_review_edit_accept,
-- fn_review_reject, and fn_flag_source_wrong are all SECURITY DEFINER,
-- granted EXECUTE to `authenticated`, and every one computes
--
--   v_caller uuid := coalesce(reviewer_user_id, auth.uid());
--
-- then authorizes v_caller — the value the CALLER passed, not the real
-- caller. The UI never passes reviewer_user_id, but the RPC surface these
-- functions expose over PostgREST does not require the UI: any
-- authenticated user (a student's own session is enough) who learns one
-- staff member's uuid can call
--
--   supabase.rpc('fn_review_accept', { queue_item_id, reviewer_user_id: <staff-uuid> })
--
-- and approve (or, via fn_review_edit_accept, publish arbitrary corrected
-- data as) or reject any queue item, with assigned_to and the audit trail
-- attributing it to the impersonated staff member.
--
-- Fix: reviewer_user_id is honored ONLY when the actual caller authenticated
-- as service_role (auth.role() reads the JWT's own role claim, which a
-- normal user session cannot forge to 'service_role' — that requires
-- holding the service-role key itself). Every other authenticated caller's
-- v_caller is forced to their own auth.uid(), exactly as if the parameter
-- did not exist. This preserves the one legitimate use of the parameter
-- (server-side/admin tooling authenticated with the service-role key acting
-- on behalf of a specific reviewer) while closing the hole for every
-- session-authenticated caller, which is the entire population able to
-- exploit it.
--
-- Every other line of each function body is reproduced verbatim from the
-- live pg_get_functiondef() output pulled immediately before writing this
-- migration — only the v_caller assignment changes. CREATE OR REPLACE
-- FUNCTION preserves existing GRANTs when the signature is unchanged, so no
-- REGRANT is needed here.
--
-- NOT APPLIED to production by this commit — see AUDIT_RESULTS.md /
-- HEALTH_IMPLEMENTATION_PLAN.md for why (this repo's own migration history
-- shows two prior incidents from unreviewed live changes: a dead API key
-- and a broken CLI both went undetected for days, and one migration's view
-- body was found to have silently diverged from production). This is a
-- narrowly-scoped, single-line-per-function, easily-reversible fix for a
-- live, actively exploitable privilege escalation — recommended for prompt
-- review and application, not deferred to a maintenance window the way
-- credential rotation is.

begin;

create or replace function public.fn_review_accept(queue_item_id uuid, reviewer_user_id uuid default null::uuid)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public', 'pg_catalog'
as $function$
declare
  v_caller uuid := case
                     when auth.role() = 'service_role' then coalesce(reviewer_user_id, auth.uid())
                     else auth.uid()
                   end;
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
     and status in ('open', 'in_review', 'rejected')
   returning id into v_id;

  if v_id is null then
    raise exception 'fn_review_accept: queue item % not found or already approved',
      queue_item_id;
  end if;

  return v_id;
end $function$;

create or replace function public.fn_review_edit_accept(queue_item_id uuid, corrected_payload jsonb, reviewer_user_id uuid default null::uuid, reviewer_notes text default null::text)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public', 'pg_catalog'
as $function$
declare
  v_caller uuid := case
                     when auth.role() = 'service_role' then coalesce(reviewer_user_id, auth.uid())
                     else auth.uid()
                   end;
  v_notes  text := reviewer_notes;
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
     and status in ('open', 'in_review', 'rejected')
   returning id into v_id;

  if v_id is null then
    raise exception 'fn_review_edit_accept: queue item % not found or already approved',
      queue_item_id;
  end if;

  return v_id;
end $function$;

create or replace function public.fn_review_reject(queue_item_id uuid, reason text, reason_detail text default null::text, reviewer_user_id uuid default null::uuid)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public', 'pg_catalog'
as $function$
declare
  v_caller uuid := case
                     when auth.role() = 'service_role' then coalesce(reviewer_user_id, auth.uid())
                     else auth.uid()
                   end;
  v_reason text := reason;
  v_detail text := reason_detail;
  v_notes  text;
  v_id     uuid;
  v_lane   text;
  v_gdid   uuid;
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

  -- Re-rejecting an already-rejected item is allowed: it is how a reviewer
  -- corrects the REASON on a card they have looked at again.
  update public.review_queue
     set status            = 'rejected',
         assigned_to       = v_caller,
         reviewer_decision = jsonb_build_object('reason', v_reason, 'detail', v_detail),
         reviewer_notes    = v_notes,
         resolved_at       = now()
   where id = queue_item_id
     and status in ('open', 'in_review', 'rejected')
   returning id into v_id;

  if v_id is null then
    raise exception 'fn_review_reject: queue item % not found or already approved',
      queue_item_id;
  end if;

  v_lane := public.fn_reject_reason_lane(v_reason);

  if v_lane = 'source' then
    select coalesce(
             ej.guideline_document_id,
             case when rq.entity_type = 'guideline_documents' then rq.entity_id end
           )
      into v_gdid
    from public.review_queue rq
    left join public.extraction_jobs ej
      on ej.id = rq.entity_id and rq.entity_type = 'extraction_jobs'
    where rq.id = queue_item_id;

    if v_gdid is not null then
      update public.guideline_documents
         set parse_status = 'failed'
       where id = v_gdid
         and parse_status <> 'failed';
    end if;
  end if;

  return v_id;
end
$function$;

create or replace function public.fn_flag_source_wrong(queue_item_id uuid, detail text default null::text, reviewer_user_id uuid default null::uuid)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public', 'pg_catalog'
as $function$
declare
  v_caller uuid := case
                     when auth.role() = 'service_role' then coalesce(reviewer_user_id, auth.uid())
                     else auth.uid()
                   end;
  v_gdid   uuid;
  v_count  integer;
  v_note   text;
begin
  if v_caller is null then
    raise exception 'fn_flag_source_wrong: no reviewer_user_id and auth.uid() is null';
  end if;
  if not public.fn_can_review_uni_db(v_caller) then
    raise exception 'fn_flag_source_wrong: caller % is not authorized to review', v_caller;
  end if;

  select coalesce(
           ej.guideline_document_id,
           case when rq.entity_type = 'guideline_documents' then rq.entity_id end
         )
    into v_gdid
  from public.review_queue rq
  left join public.extraction_jobs ej
    on ej.id = rq.entity_id and rq.entity_type = 'extraction_jobs'
  where rq.id = queue_item_id;

  if v_gdid is null then
    raise exception 'fn_flag_source_wrong: could not resolve a source document for queue item %',
      queue_item_id;
  end if;

  update public.guideline_documents
     set parse_status = 'failed'
   where id = v_gdid;

  v_note := 'wrong_source: ' || coalesce(detail, 'source document marked wrong by reviewer');

  -- Includes rows already rejected for another reason: a bad SOURCE supersedes
  -- whatever per-section reason was recorded before. Approved rows are left
  -- alone — undoing a publication is a separate, deliberate act.
  with affected as (
    select rq.id
    from public.review_queue rq
    left join public.extraction_jobs ej
      on ej.id = rq.entity_id and rq.entity_type = 'extraction_jobs'
    where rq.status in ('open', 'in_review', 'rejected')
      and (
        ej.guideline_document_id = v_gdid
        or (rq.entity_type = 'guideline_documents' and rq.entity_id = v_gdid)
      )
  )
  update public.review_queue rq
     set status            = 'rejected',
         assigned_to       = v_caller,
         reviewer_decision = jsonb_build_object(
                               'reason', 'wrong_source',
                               'detail', detail,
                               'guideline_document_id', v_gdid),
         reviewer_notes    = v_note
   where rq.id in (select id from affected);

  get diagnostics v_count = row_count;
  return v_count;
end $function$;

-- fn_split_guideline_document_by_degree has no reviewer_user_id parameter
-- (confirmed against the live function signature), so it needs no v_caller
-- fix — but it IS SECURITY DEFINER and granted EXECUTE to `anon`, which no
-- other review RPC is. An unauthenticated caller can invoke it directly
-- over PostgREST today.
revoke execute on function public.fn_split_guideline_document_by_degree(uuid, text, text, smallint, text) from anon;

commit;
