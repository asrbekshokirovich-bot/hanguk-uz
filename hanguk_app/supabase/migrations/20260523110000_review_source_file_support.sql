-- ============================================================================
--  Review console: source-file support
--
--  Two additions so staff can verify an extraction against its source PDF and
--  flag a bad source:
--
--  1. Expose guideline_document_id on v_review_queue_dashboard. The site needs
--     it to call the get-pdf-url Edge Function (POST {document_id}) which mints
--     a 15-minute signed URL for the cached PDF in the guideline-blobs bucket.
--     (source_url_ko — the live Korean admissions page — is already exposed as
--     a second, always-available source link.)
--
--  2. fn_flag_source_wrong(queue_item_id, detail) — when the SOURCE document
--     itself is wrong (not just the extraction), mark the guideline document
--     failed and reject every open review item that came from it, in one step.
--     A wrong source means all its extractions are wrong, so they're rejected
--     together; the crawler will re-fetch / a correct source can be registered.
--
--  Idempotent: CREATE OR REPLACE.
-- ============================================================================

set local search_path = public, pg_catalog;

-- 1. View — add guideline_document_id ----------------------------------------
create or replace view public.v_review_queue_dashboard
with (security_invoker = true) as
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
  -- appended last: CREATE OR REPLACE VIEW only allows adding columns at the end
  coalesce(ej.guideline_document_id, ac.guideline_document_id, gd_direct.id) as guideline_document_id
from public.review_queue rq
  left join public.extraction_jobs ej
    on ej.id = rq.entity_id and rq.entity_type = 'extraction_jobs'
  left join public.guideline_documents gd_ej on gd_ej.id = ej.guideline_document_id
  left join public.institutions i_ej on i_ej.id = gd_ej.institution_id
  left join public.admission_cycles ac
    on ac.id = rq.entity_id and rq.entity_type = 'admission_cycles'
  left join public.institutions i_ac on i_ac.id = ac.institution_id
  left join public.guideline_documents gd_ac on gd_ac.id = ac.guideline_document_id
  left join public.guideline_documents gd_direct
    on gd_direct.id = rq.entity_id and rq.entity_type = 'guideline_documents'
  left join public.institutions i_gd on i_gd.id = gd_direct.institution_id
where rq.status = 'open'
order by rq.priority, rq.created_at;

-- 2. fn_flag_source_wrong ----------------------------------------------------
create or replace function public.fn_flag_source_wrong(
  queue_item_id    uuid,
  detail           text default null,
  reviewer_user_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
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

  -- Resolve the source guideline document behind this queue item.
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

  -- Mark the source document as bad so the pipeline stops trusting it.
  update public.guideline_documents
     set parse_status = 'failed'
   where id = v_gdid;

  v_note := 'wrong_source: ' || coalesce(detail, 'source document marked wrong by reviewer');

  -- Reject every open/in-review item that came from this source.
  with affected as (
    select rq.id
    from public.review_queue rq
    left join public.extraction_jobs ej
      on ej.id = rq.entity_id and rq.entity_type = 'extraction_jobs'
    where rq.status in ('open', 'in_review')
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
end $$;

revoke all on function public.fn_flag_source_wrong(uuid, text, uuid) from public;
grant execute on function public.fn_flag_source_wrong(uuid, text, uuid) to authenticated, service_role;

comment on function public.fn_flag_source_wrong(uuid, text, uuid) is
  'Mark the source guideline document behind a queue item as wrong: sets '
  'guideline_documents.parse_status=failed and rejects all open review items '
  'from that source. Returns the number of items rejected.';
