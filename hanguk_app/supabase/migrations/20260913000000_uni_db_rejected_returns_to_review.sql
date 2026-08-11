-- Rejecting a section no longer ends the story for that section.
--
-- Before this migration a reviewer's rejection was terminal in every sense:
-- `fn_review_reject` flipped review_queue.status to 'rejected' and touched
-- nothing else. The guideline document kept parse_status='succeeded', so the
-- finder's content-hash guard
--
--     select 1 from guideline_documents
--      where file_hash_sha256 = $1 and parse_status <> 'failed'
--
-- matched forever and the same PDF was never ingested again. A section a
-- reviewer threw out simply vanished: no re-extraction, no re-fetch, no card.
-- Only `fn_flag_source_wrong` unlocked that guard, and only for the whole doc.
--
-- Rejections split into two lanes by what is actually broken:
--
--   EXTRACTION lane — the PDF is the right one, the model read it wrong:
--     hallucinated_field, ocr_garbled, wrong_archetype, other
--   → leave the document alone; `requeue-rejected` re-extracts ONLY that
--     field group from the stored blob and persist_outcome files a fresh
--     review card. Nothing here needs a DB write: the worker finds its own
--     work by looking for rejected rows whose extraction job is still the
--     newest for that (document, field_group).
--
--   SOURCE lane — the document itself is wrong, so re-reading it changes
--   nothing:
--     wrong_year   (right university, wrong year's 모집요강)
--     source_404   (the URL no longer resolves)
--   → flip parse_status to 'failed'. That releases the hash guard, so the
--     next crawl re-ingests the URL and, if the university has posted a
--     corrected file, the whole document comes back through review.
--
-- Idempotent: create-or-replace only.

-- 1) Reason → lane, so SQL and Python agree on one definition -----------------
create or replace function public.fn_reject_reason_lane(reason text)
  returns text
  language sql
  immutable
  set search_path to 'public', 'pg_catalog'
as $$
  select case
    when reason in ('wrong_year', 'source_404')      then 'source'
    when reason in ('hallucinated_field', 'ocr_garbled',
                    'wrong_archetype', 'other')      then 'extraction'
    else 'none'
  end
$$;

comment on function public.fn_reject_reason_lane(text) is
  'Which recovery lane a rejection reason belongs to: ''source'' (re-fetch the '
  'document — flips parse_status to failed), ''extraction'' (re-extract that '
  'field group from the stored blob — driven by the requeue-rejected worker), '
  'or ''none''. Mirrored in uni_db.workers.rejected_requeue_worker.';

-- 2) fn_review_reject: unchanged contract, plus the source-lane unlock -------
create or replace function public.fn_review_reject(
  queue_item_id uuid,
  reason text,
  reason_detail text default null,
  reviewer_user_id uuid default null
) returns uuid
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

  update public.review_queue
     set status            = 'rejected',
         assigned_to       = v_caller,
         reviewer_decision = jsonb_build_object('reason', v_reason, 'detail', v_detail),
         reviewer_notes    = v_notes,
         resolved_at       = now()
   where id = queue_item_id
     and status in ('open', 'in_review')
   returning id into v_id;

  if v_id is null then
    raise exception 'fn_review_reject: queue item % not found or already terminal',
      queue_item_id;
  end if;

  v_lane := public.fn_reject_reason_lane(v_reason);

  -- Source lane: release the finder's content-hash guard so the next crawl
  -- re-ingests this URL. The extraction lane deliberately does NOT do this —
  -- the stored PDF is fine and requeue-rejected re-reads it for free.
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

comment on function public.fn_review_reject(uuid, text, text, uuid) is
  'Reject one review card. Records the reason and stamps resolved_at. For '
  'source-lane reasons (wrong_year, source_404) the guideline document is '
  'flipped to parse_status=''failed'' so the finder''s hash guard releases and '
  'the next crawl re-ingests the URL. Extraction-lane reasons leave the '
  'document intact for the requeue-rejected worker to re-extract.';

-- 3) The extraction lane's work list, as a view the worker and CRM share -----
--    A rejected card is still outstanding while its extraction job remains
--    the newest for that (document, field_group): anything newer means a
--    re-extraction already landed and produced a fresh card.
create or replace view public.v_rejected_awaiting_requeue
  with (security_invoker = on) as
  with latest as (
    select distinct on (ej.guideline_document_id, ej.field_group)
           ej.guideline_document_id,
           ej.field_group,
           ej.id as job_id
      from public.extraction_jobs ej
     order by ej.guideline_document_id, ej.field_group,
              ej.started_at desc nulls last, ej.ended_at desc nulls last
  ),
  rejected as (
    select rq.id                        as queue_id,
           rq.entity_id                 as job_id,
           ej.guideline_document_id,
           ej.field_group,
           rq.reviewer_decision->>'reason' as reason,
           rq.resolved_at
      from public.review_queue rq
      join public.extraction_jobs ej on ej.id = rq.entity_id
     where rq.status = 'rejected'
       and rq.entity_type = 'extraction_jobs'
  )
  select r.queue_id,
         r.guideline_document_id,
         r.field_group,
         r.reason,
         r.resolved_at,
         gd.storage_path,
         gd.file_hash_sha256,
         gd.institution_id,
         (select count(*)
            from rejected r2
           where r2.guideline_document_id = r.guideline_document_id
             and r2.field_group = r.field_group) as reject_count
    from rejected r
    join latest l
      on l.guideline_document_id = r.guideline_document_id
     and l.field_group = r.field_group
     and l.job_id = r.job_id          -- nothing newer has been extracted
    join public.guideline_documents gd on gd.id = r.guideline_document_id
   where public.fn_reject_reason_lane(r.reason) = 'extraction'
     and gd.storage_path is not null
     and gd.parse_status <> 'failed';

comment on view public.v_rejected_awaiting_requeue is
  'Extraction-lane rejections that have not yet been re-extracted: the '
  'rejected card''s job is still the newest for its (document, field_group). '
  'reject_count is how many times this pair has been rejected, so the worker '
  'can stop retrying a section the model keeps getting wrong. Drives '
  '`uni-db requeue-rejected`.';
