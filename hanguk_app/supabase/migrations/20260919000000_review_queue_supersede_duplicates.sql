-- One open review card per (guideline document, field group), enforced in the
-- database rather than in each worker that enqueues.
--
-- The reviewer saw "Muddatlar va ariza to'lovi" twice for the same university,
-- with the same dates and two different gate notes. Both rows were real: on
-- 2026-08-06 the same (document, field_group) was enqueued twice five minutes
-- apart, and both stayed open until a human resolved them by hand six days
-- later. `requirements` on document 3d9c38b0 got three rows inside six minutes.
--
-- parse_worker already guards against this — it supersedes any still-open row
-- for the same (document, field_group) before inserting its own. The guard
-- lives in application code, so backfill_review_worker, added later, never got
-- it: its idempotency check asks "does THIS JOB have a row?"
-- (`rq.entity_id = ej.id`), not "does this SECTION have one?", and the pipeline
-- creates many jobs per section — up to 41 for a single pairing. Every orphaned
-- job is a distinct id, so each one enqueued another card for a section that
-- already had one.
--
-- Fixing the worker alone would leave the same trap for the next enqueue path.
-- This moves the rule to where no path can miss it: whatever inserts, older
-- open rows for that section are retired the moment a newer one arrives.
--
-- Semantics deliberately match parse_worker's existing supersede, so this
-- changes nothing about how re-extractions already behave there:
--   * only rows for the SAME guideline document AND field group,
--   * only rows not yet published (published_at is null),
--   * only rows still in play (open / in_review / approved),
--   * status becomes 'superseded', never deleted — the audit trail stands.
--
-- Scope: extraction-job rows only. Document-level entries
-- (entity_type = 'guideline_documents') have their own, separate duplication
-- and are left alone here.

-- Statement-level, over the inserted rows as a set.
--
-- A per-row trigger cannot express this correctly. Postgres fires AFTER ROW
-- triggers at the END of the statement, so with a multi-row INSERT every new
-- row sees the others already present: "supersede everything but me" leaves
-- the section with no open card at all. Restricting it to older rows does not
-- rescue it either — `created_at` defaults to `now()`, which is the
-- TRANSACTION's timestamp, so rows inserted in one transaction all carry the
-- same value and the ordering collapses onto a random uuid.
--
-- Reading the whole inserted set at once sidesteps both traps: for every
-- section the statement touched, keep the newest live row and retire the rest.
-- Exactly one survivor, whether the rows arrived together or one statement at
-- a time.
create or replace function public.fn_supersede_stale_review_rows()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  with touched as (
    -- Sections this statement actually enqueued work for. A row inserted
    -- already-superseded is bookkeeping, not a new card. A job without both
    -- keys belongs to no section, so there is nothing to deduplicate against.
    select distinct
           ej.guideline_document_id as doc_id,
           ej.field_group           as field_group
      from inserted i
      join public.extraction_jobs ej on ej.id = i.entity_id
     where i.entity_type = 'extraction_jobs'
       and i.status <> 'superseded'
       and ej.guideline_document_id is not null
       and ej.field_group is not null
  ),
  ranked as (
    select rq.id,
           row_number() over (
             partition by ej.guideline_document_id, ej.field_group
             order by rq.created_at desc, rq.id desc
           ) as rn
      from public.review_queue rq
      join public.extraction_jobs ej on ej.id = rq.entity_id
      join touched t
        on t.doc_id = ej.guideline_document_id
       and t.field_group = ej.field_group
     where rq.entity_type = 'extraction_jobs'
       and rq.status in ('open', 'in_review', 'approved')
       and rq.published_at is null
  )
  update public.review_queue rq
     set status      = 'superseded',
         resolved_at = now()
    from ranked
   where rq.id = ranked.id
     and ranked.rn > 1;

  return null;
end;
$$;

comment on function public.fn_supersede_stale_review_rows is
  'Retires older open review_queue rows for the same (guideline document, '
  'field group) when a newer one is enqueued, so a reviewer never sees the '
  'same section twice. Mirrors the supersede parse_worker performs in '
  'application code, but applies to every insert path.';

-- AFTER INSERT, once per statement, with the inserted rows exposed as a
-- transition table. The trigger only ever issues an UPDATE, and an INSERT
-- trigger does not fire on UPDATE, so it cannot recurse.
drop trigger if exists trg_supersede_stale_review_rows on public.review_queue;

create trigger trg_supersede_stale_review_rows
  after insert on public.review_queue
  referencing new table as inserted
  for each statement
  execute function public.fn_supersede_stale_review_rows();
