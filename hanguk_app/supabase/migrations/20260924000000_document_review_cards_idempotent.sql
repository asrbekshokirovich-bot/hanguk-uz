-- Document-level review cards stop coming back after a reviewer decides them.
--
-- The complaint: the same "Hujjatni tekshirish kerak" (degree_check) card
-- reappeared for months. Approving it did nothing durable, because approval
-- resolves a review_queue ROW and the card is regenerated from the PDF:
--
--   * parse_worker.persist_outcome inserts document-level entries with a bare
--     INSERT — no supersede, no "already decided?" check (unlike the
--     extraction-job path, which has supersede in application code).
--   * migration 20260919000000 moved dedup into the database but scoped it to
--     extraction-job rows, saying so in its own header: "Document-level
--     entries (entity_type = 'guideline_documents') have their own, separate
--     duplication and are left alone here."
--
-- So every nightly uni-db-auto-crawl, every three-hourly drain-backlog, every
-- retry-failed re-ran the parse and inserted the card again. A reviewer could
-- never win: the queue regrew what they had just cleared.
--
-- Two things are missing and both are added here.
--
-- 1. review_queue has no field_group column. The parser HAS a field_group for
--    these entries ('degree_split' vs 'degree_check') but it was dropped on
--    insert, and the dashboard view takes field_group from the extraction_jobs
--    join, which is NULL for document rows. Without that key there is nothing
--    to deduplicate ON, and the UI was left discriminating the two card types
--    by regex over the Uzbek/English prose in reviewer_notes.
--
-- 2. Nothing stops the re-insert. Fixing only parse_worker would leave the
--    trap for the next enqueue path — exactly the reasoning 20260919000000
--    gives for putting the extraction-job rule in the database. Same choice
--    here: a BEFORE INSERT trigger, so whatever inserts, the rule holds.
--
-- Deliberately NOT changed: nothing is deleted, no existing row changes
-- status, and extraction-job rows are untouched. A guideline PDF that is
-- re-fetched with different content gets a new content hash and therefore a
-- new guideline_documents row, so a genuinely changed document still raises
-- its card under its own id.

-- ---------------------------------------------------------------------------
-- 1. The missing key.
-- ---------------------------------------------------------------------------
alter table public.review_queue
  add column if not exists field_group text;

comment on column public.review_queue.field_group is
  'Section key for the card. For entity_type = ''extraction_jobs'' this '
  'mirrors extraction_jobs.field_group and the dashboard prefers that join. '
  'For entity_type = ''guideline_documents'' it is the only place the '
  'parser''s card type (degree_split / degree_check) is recorded, and it is '
  'the deduplication key for those rows.';

-- Backfill the history so the guard below applies to cards that already
-- exist, not only to future ones. The wording is parse_worker's; it is also
-- what fn_split_guideline_document_by_degree matches on, so the two stay
-- consistent. Only rows that are still NULL are touched.
update public.review_queue
   set field_group = 'degree_check'
 where entity_type = 'guideline_documents'
   and field_group is null
   and reviewer_notes ~* 'no split boundary|no degree section header';

update public.review_queue
   set field_group = 'degree_split'
 where entity_type = 'guideline_documents'
   and field_group is null
   and reviewer_notes ~* 'split into separate admission';

-- ---------------------------------------------------------------------------
-- 2. The guard.
-- ---------------------------------------------------------------------------
create or replace function public.fn_skip_settled_document_review_card()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  settled_status text;
begin
  -- Only document-level cards, and only when we have a key to match on.
  if new.entity_type is distinct from 'guideline_documents'
     or new.field_group is null then
    return new;
  end if;

  select rq.status
    into settled_status
    from public.review_queue rq
   where rq.entity_type = 'guideline_documents'
     and rq.entity_id   = new.entity_id
     and rq.field_group = new.field_group
     and rq.id is distinct from new.id
     and rq.status in ('open', 'in_review', 'approved', 'rejected')
   order by case rq.status
              when 'approved' then 1   -- a human (or the auto-split) settled it
              when 'rejected' then 1
              when 'in_review' then 2
              else 3                   -- 'open': a live card already exists
            end,
            rq.created_at desc
   limit 1;

  if settled_status is null then
    return new;
  end if;

  -- 'approved'/'rejected' — the decision stands; re-raising it is the bug
  -- this migration exists to fix.
  -- 'open'/'in_review'    — a live card is already in front of a reviewer.
  -- Either way, skip the insert. Returning NULL from a BEFORE INSERT trigger
  -- drops the row without raising, so a re-parse stays a no-op instead of
  -- failing the whole parse transaction the way a unique index would.
  raise debug
    'review_queue: skipping % card for document % — an existing row is %',
    new.field_group, new.entity_id, settled_status;
  return null;
end;
$$;

comment on function public.fn_skip_settled_document_review_card() is
  'Keeps document-level review cards idempotent: a (guideline document, '
  'field_group) that already has a live or decided card does not get a '
  'second one, however many times the document is re-parsed.';

drop trigger if exists trg_skip_settled_document_review_card
  on public.review_queue;

create trigger trg_skip_settled_document_review_card
  before insert on public.review_queue
  for each row
  execute function public.fn_skip_settled_document_review_card();

-- Makes the lookup above an index scan rather than a seq scan on a table that
-- grows with every parse.
create index if not exists review_queue_document_field_group_idx
  on public.review_queue (entity_id, field_group)
  where entity_type = 'guideline_documents';

-- ---------------------------------------------------------------------------
-- 3. Surface the column, so the UI stops parsing prose.
-- ---------------------------------------------------------------------------
-- Same definition as 20260918000000, with one changed expression: field_group
-- now falls back to the review_queue column when the extraction_jobs join has
-- none. Document rows therefore arrive at the client already labelled
-- 'degree_split' / 'degree_check'.
--
-- One correction to 20260918000000 while we are here. That migration copied
-- the view body from an older revision and wrote `where rq.status = 'open'`,
-- dropping the 'in_review' and 'rejected' statuses that 20260823120000 and
-- 20260913000000 had deliberately added — the whole point of those two being
-- that a rejected row comes BACK to the dashboard so a reviewer can revisit
-- it. The live database still has the three-status filter, so replacing the
-- view with the repo's own 20260918000000 text would have silently switched
-- that feature off. The filter below is the one production actually runs.
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
where rq.status in ('open', 'in_review', 'rejected')
order by rq.priority, rq.created_at;

comment on view public.v_review_queue_dashboard is
  'Open review-queue rows joined to their institution and guideline document. '
  'institution_id is the grouping key for the triage rail: one card per '
  'university, with that university''s guideline documents nested inside. '
  'field_group comes from the extraction job when there is one, and from '
  'review_queue.field_group for document-level cards. Rejected rows stay '
  'visible so a reviewer can revisit them (20260823120000).';

-- ---------------------------------------------------------------------------
-- 4. Clear the backlog this bug created.
-- ---------------------------------------------------------------------------
-- Where the same (document, field_group) has several live cards, keep the
-- newest and retire the rest. Same semantics as 20260919000000's supersede:
-- status becomes 'superseded', nothing is deleted, the audit trail stands.
-- One-time; the trigger above prevents the pile-up from recurring.
with ranked as (
  select id,
         row_number() over (
           partition by entity_id, field_group
           order by created_at desc, id desc
         ) as rn
    from public.review_queue
   where entity_type = 'guideline_documents'
     and field_group is not null
     and status in ('open', 'in_review')
     and published_at is null
)
update public.review_queue rq
   set status = 'superseded'
  from ranked
 where ranked.id = rq.id
   and ranked.rn > 1;

-- And where a reviewer already decided a card, retire the copies that came
-- back after their decision — those are precisely the ones the reviewer kept
-- seeing again.
update public.review_queue rq
   set status = 'superseded'
 where rq.entity_type = 'guideline_documents'
   and rq.field_group is not null
   and rq.status in ('open', 'in_review')
   and rq.published_at is null
   and exists (
     select 1
       from public.review_queue decided
      where decided.entity_type = 'guideline_documents'
        and decided.entity_id   = rq.entity_id
        and decided.field_group = rq.field_group
        and decided.status in ('approved', 'rejected')
   );
