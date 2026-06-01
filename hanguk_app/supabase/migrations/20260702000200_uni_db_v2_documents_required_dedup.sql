-- Phase 3.1 of the fix plan: de-duplicate documents_required and add the unique
-- guard the publish path was missing (unlike university_admission_periods, the
-- documents insert had no ON CONFLICT, so re-extraction stacked duplicate rows —
-- 213 rows vs 157 distinct (cycle_id, document_type, applicant_category)).

-- 1) collapse existing duplicates, keeping the earliest row per key
delete from public.documents_required
 where id in (
   select id from (
     select id,
            row_number() over (
              partition by cycle_id, document_type, applicant_category
              order by created_at asc, id asc
            ) as rn
       from public.documents_required
   ) z
   where z.rn > 1
 );

-- 2) prevent it from happening again
create unique index if not exists documents_required_cycle_doc_cat_uniq
  on public.documents_required (cycle_id, document_type, applicant_category)
  nulls not distinct;
