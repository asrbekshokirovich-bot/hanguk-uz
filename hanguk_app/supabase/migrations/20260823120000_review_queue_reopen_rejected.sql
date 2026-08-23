-- Rejected items come back to the review queue; only APPROVED work leaves it.
--
-- `v_review_queue_dashboard` filtered on `rq.status = 'open'`, which made
-- "rejected" a one-way door. That is wrong for two reasons the operator hit in
-- practice:
--
--   1. A rejection is a judgement about ONE extraction, not about the document.
--      189 of the 293 rejected rows carry reason `source_404` — the crawler
--      could not fetch the PDF that day. When the link is fixed, or the file is
--      uploaded by hand, there is no way back: the card is gone from the queue
--      and only a SQL user could ever see it again.
--   2. A document is only finished when EVERY section is approved. With three
--      sections approved and the fourth rejected, the whole university vanished
--      from the rail — it looked complete while a quarter of its data was
--      missing. Including rejected rows restores exactly that fourth card, so
--      the university stays visible until the last section is approved.
--
-- Superseded rows stay hidden. They are not a reviewer's decision — they are
-- rows a later extraction (or a code fix) replaced, and re-showing them would
-- put stale duplicates next to the row that supersedes them.
--
-- The four action RPCs gate on `status in ('open','in_review')` and raise
-- "already terminal" otherwise. Left alone, every re-surfaced card would render
-- with working buttons that throw on click. They now accept `rejected` as a
-- re-decidable state, so a reviewer can approve what was rejected, or reject it
-- again with a different reason. The audit trigger already appends one
-- `review_decisions` row per transition, so the reversal is recorded rather
-- than overwriting the original decision.
--
-- CREATE OR REPLACE throughout, never DROP + CREATE: the live view carries
-- grants to anon, service_role and uni_db_ci, and the functions carry their own
-- grants + SECURITY DEFINER ownership. Replacing in place keeps all of it. The
-- view's column list is byte-identical to 20260918000000 — only the WHERE
-- clause changes.

create or replace view public.v_review_queue_dashboard
with (security_invoker = true)
as
select
  rq.id,
  rq.priority,
  rq.reason,
  rq.entity_type,
  rq.entity_id,
  rq.created_at,
  coalesce(i_ej.name_ko, i_ac.name_ko, i_gd.name_ko) as name_ko,
  coalesce(i_ej.name_en, i_ac.name_en, i_gd.name_en) as name_en,
  coalesce(gd_ej.source_url_ko, gd_ac.source_url_ko, gd_direct.source_url_ko) as source_url_ko,
  coalesce(gd_ej.storage_path, gd_ac.storage_path, gd_direct.storage_path) as storage_path,
  ej.parsed_output,
  ej.accuracy_self_score,
  coalesce(ej.guideline_document_id, ac.guideline_document_id, gd_direct.id) as guideline_document_id,
  ej.field_group,
  (
    select min((elem.value ->> 'extractor_confidence')::numeric)
    from jsonb_array_elements(
      case
        when jsonb_typeof(ej.parsed_output -> 'rows') = 'array' then ej.parsed_output -> 'rows'
        when jsonb_typeof(ej.parsed_output -> 'events') = 'array' then ej.parsed_output -> 'events'
        else '[]'::jsonb
      end
    ) elem(value)
    where jsonb_typeof(elem.value -> 'extractor_confidence') = 'number'
  ) as min_row_confidence,
  rq.reviewer_notes,
  rq.needs_attention,
  rq.status,
  coalesce(gd_ej.academic_year, gd_ac.academic_year, gd_direct.academic_year) as doc_academic_year,
  coalesce(gd_ej.semester, gd_ac.semester, gd_direct.semester) as doc_semester,
  coalesce(i_ej.id, i_ac.id, i_gd.id) as institution_id
from review_queue rq
  left join extraction_jobs ej
    on ej.id = rq.entity_id and rq.entity_type = 'extraction_jobs'
  left join guideline_documents gd_ej on gd_ej.id = ej.guideline_document_id
  left join institutions i_ej on i_ej.id = gd_ej.institution_id
  left join admission_cycles ac
    on ac.id = rq.entity_id and rq.entity_type = 'admission_cycles'
  left join institutions i_ac on i_ac.id = ac.institution_id
  left join guideline_documents gd_ac on gd_ac.id = ac.guideline_document_id
  left join guideline_documents gd_direct
    on gd_direct.id = rq.entity_id and rq.entity_type = 'guideline_documents'
  left join institutions i_gd on i_gd.id = gd_direct.institution_id
-- Everything a reviewer has not APPROVED. `superseded` is excluded on purpose:
-- those rows were replaced, not judged.
where rq.status in ('open', 'in_review', 'rejected')
order by rq.priority, rq.created_at;

comment on view public.v_review_queue_dashboard is
  'Review-queue rows a reviewer has not approved yet — open, in_review AND '
  'rejected — joined to their institution and guideline document. Rejected '
  'rows stay visible so a wrong rejection can be reversed and so a document '
  'with one bad section does not disappear as if it were complete. '
  'institution_id is the grouping key for the triage rail.';


-- --- action RPCs: `rejected` becomes a re-decidable state ------------------

create or replace function public.fn_review_accept(
  queue_item_id uuid,
  reviewer_user_id uuid default null::uuid
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
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
     and status in ('open', 'in_review', 'rejected')
   returning id into v_id;

  if v_id is null then
    raise exception 'fn_review_accept: queue item % not found or already approved',
      queue_item_id;
  end if;

  return v_id;
end $function$;


create or replace function public.fn_review_edit_accept(
  queue_item_id uuid,
  corrected_payload jsonb,
  reviewer_user_id uuid default null::uuid,
  reviewer_notes text default null::text
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare
  v_caller uuid := coalesce(reviewer_user_id, auth.uid());
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


create or replace function public.fn_review_reject(
  queue_item_id uuid,
  reason text,
  reason_detail text default null::text,
  reviewer_user_id uuid default null::uuid
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare
  v_caller uuid := coalesce(reviewer_user_id, auth.uid());
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


create or replace function public.fn_flag_source_wrong(
  queue_item_id uuid,
  detail text default null::text,
  reviewer_user_id uuid default null::uuid
)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare
  v_caller uuid := coalesce(reviewer_user_id, auth.uid());
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

  -- Includes rows already rejected for another reason: the point of this
  -- action is that the SOURCE is bad, which supersedes whatever per-section
  -- reason was recorded before. Approved rows are left alone — undoing a
  -- publication is a separate, deliberate act.
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
