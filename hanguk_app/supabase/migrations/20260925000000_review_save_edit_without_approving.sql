-- Saving a correction and approving it become two separate acts.
--
-- The edit panel's only button was "Saqlash va tasdiqlash" — one click that
-- wrote the reviewer's corrections AND approved the card. A reviewer who
-- wanted to fix three dates, re-read them against the PDF, and only then
-- approve had nowhere to stop: the moment they saved, the card was published
-- material. The reviewer asked for the obvious thing — save first, approve
-- afterwards — and they are right, because those are different decisions.
-- "These numbers now match the PDF" is a transcription claim. "This is fit to
-- show a student" is an editorial one.
--
-- `review_queue.reviewer_decision` is already the column that carries a
-- corrected payload; `fn_review_edit_accept` writes it while approving. This
-- adds a function that writes it WITHOUT approving, and — the part that
-- actually needed care — stops the plain approve path from throwing it away.

-- ---------------------------------------------------------------------------
-- 1. Save, and only save.
-- ---------------------------------------------------------------------------
create or replace function public.fn_review_save_edit(
  queue_item_id     uuid,
  corrected_payload jsonb,
  reviewer_user_id  uuid default null,
  reviewer_notes    text default null
)
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
  -- Copied to a local, as fn_review_edit_accept does: inside the UPDATE the
  -- bare name is ambiguous between this parameter and the column.
  v_notes  text := reviewer_notes;
  v_id     uuid;
begin
  if v_caller is null then
    raise exception 'fn_review_save_edit: no reviewer_user_id and auth.uid() is null';
  end if;

  if corrected_payload is null or corrected_payload = '{}'::jsonb then
    raise exception 'fn_review_save_edit: corrected_payload must be non-empty';
  end if;

  if not public.fn_can_review_uni_db(v_caller) then
    raise exception 'fn_review_save_edit: caller % is not authorized to review', v_caller;
  end if;

  -- 'in_review' is the status this state has always meant: a human has the
  -- card and is working on it. It keeps the row on the dashboard
  -- (v_review_queue_dashboard selects open/in_review/rejected) so the work is
  -- visible to the rest of the team rather than hidden in one browser tab.
  --
  -- Nothing here approves, and publish_worker only reads rows with
  -- status = 'approved', so a saved-but-unapproved correction can never reach
  -- a student.
  update public.review_queue
     set status            = 'in_review',
         assigned_to       = v_caller,
         reviewer_decision = corrected_payload,
         reviewer_notes    = coalesce(v_notes, review_queue.reviewer_notes)
   where id = queue_item_id
     and status in ('open', 'in_review', 'rejected')
   returning id into v_id;

  if v_id is null then
    raise exception 'fn_review_save_edit: queue item % not found or already decided',
      queue_item_id;
  end if;

  return v_id;
end $function$;

comment on function public.fn_review_save_edit(uuid, jsonb, uuid, text) is
  'Store a reviewer''s corrected payload without approving it. The card stays '
  'on the dashboard as in_review; fn_review_accept later approves whatever is '
  'saved. Splits "the data is now right" from "this may go to a student".';

revoke all on function public.fn_review_save_edit(uuid, jsonb, uuid, text) from public;
grant execute on function public.fn_review_save_edit(uuid, jsonb, uuid, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Approving must not discard the saved correction.
-- ---------------------------------------------------------------------------
-- This is the reason the split needed a migration rather than two buttons in
-- the UI. `fn_review_accept` set `reviewer_decision = null` unconditionally.
-- With a save step in front of it, that line silently destroys the reviewer's
-- work: they fix five dates, save, click "Tasdiqlash", and the ORIGINAL
-- extractor output is what gets published — with no error and nothing on
-- screen to show it happened. publish_worker reads
-- `reviewer_decision or parsed_output`, so the corrections would simply
-- vanish.
--
-- Approve now keeps whatever was saved. Where nothing was saved the column is
-- already null and behaviour is unchanged.
create or replace function public.fn_review_accept(
  queue_item_id    uuid,
  reviewer_user_id uuid default null
)
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
         -- Deliberately NOT nulled: a correction saved by fn_review_save_edit
         -- is the payload being approved.
         reviewer_decision = review_queue.reviewer_decision,
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

comment on function public.fn_review_accept(uuid, uuid) is
  'Approve a review-queue item. Preserves any corrected payload saved earlier '
  'by fn_review_save_edit — nulling it here published the uncorrected '
  'extractor output instead, silently.';

-- ---------------------------------------------------------------------------
-- 3. Let the editor reopen on what was saved.
-- ---------------------------------------------------------------------------
-- Without this the edit panel re-seeds from `parsed_output` every time it
-- opens, so a reviewer who saves, closes the panel and reopens it sees their
-- corrections gone — they are in the database, but not on screen, which is
-- worse than not saving at all.
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
  coalesce(ej.field_group, rq.field_group) as field_group,
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
  coalesce(i_ej.id, i_ac.id, i_gd.id) as institution_id,
  -- Appended, not inserted: `create or replace view` cannot renumber existing
  -- columns, and dropping the view to reorder them would take its dependents
  -- with it. New columns go on the end.
  --
  -- The reviewer's saved-but-unapproved correction, when there is one.
  rq.reviewer_decision
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
where rq.status in ('open', 'in_review', 'rejected')
order by rq.priority, rq.created_at;

comment on view public.v_review_queue_dashboard is
  'Open review-queue rows joined to their institution and guideline document. '
  'institution_id is the grouping key for the triage rail. field_group comes '
  'from the extraction job when there is one, and from review_queue.field_group '
  'for document-level cards. reviewer_decision carries a correction saved but '
  'not yet approved, so the edit panel reopens on it. Rejected rows stay '
  'visible so a reviewer can revisit them (20260823120000).';
