-- 2026-09-01 audit finding, Stage 2.3 of HEALTH_IMPLEMENTATION_PLAN.md.
--
-- requirements/scholarships/documents_required have NO natural-key
-- uniqueness at all (only a surrogate `id` primary key), and tuition's
-- existing unique constraint includes the nullable recruitment_unit_id
-- column, which the publisher always leaves NULL — Postgres treats NULL as
-- distinct from NULL, so that constraint has never actually fired. Every
-- publish_worker call bare-INSERTs, so a re-extraction approved after an
-- earlier publish adds a second full set of rows with nothing removing the
-- first. The live-DB audit measured 209 duplicate groups already reaching
-- students: 169 documents_required, 24 tuition, 12 requirements,
-- 4 scholarships.
--
-- This script must run and be verified duplicate-free (the final SELECTs
-- below all return 0) BEFORE the companion migration
-- `20260925000100_natural_keys_on_content_tables.sql` can succeed — CREATE
-- UNIQUE INDEX fails outright if duplicates under that key still exist.
--
-- EXECUTED against production 2026-09-01 ~17:14 UTC via Supabase MCP
-- execute_sql, on explicit owner instruction ("GO"). Run table-by-table
-- (not as this single transactional script) so each DELETE's row count
-- could be checked against the immediately-preceding live re-count before
-- moving to the next table. Live counts at execution time had already
-- shifted from the audit's 209/2h-earlier snapshot — documents_required
-- showed 0 duplicate groups (already clean) — so only tuition/
-- requirements/scholarships needed deletion:
--   tuition:       24 groups → 60 rows deleted (returned ids matched count)
--   requirements:  12 groups → 21 rows deleted (returned ids matched count)
--   scholarships:   2 groups →  2 rows deleted (returned ids matched count)
--   documents_required: 0 groups, nothing to delete
-- Verification SELECT re-run after all deletes: 0 remaining duplicate
-- groups in all four tables. Companion migration
-- 20260925000100_natural_keys_on_content_tables.sql applied immediately
-- after and succeeded (would have failed outright otherwise).

begin;

-- ---------------------------------------------------------------------------
-- tuition: key = (institution_id, recruitment_unit_id treated as one value
-- whether NULL or set, academic_year, semester_number, faculty_group).
-- Keep the newest row (highest created_at, tie-broken by id) per key.
-- ---------------------------------------------------------------------------
with ranked as (
  select id,
         row_number() over (
           partition by institution_id,
                        coalesce(recruitment_unit_id, '00000000-0000-0000-0000-000000000000'::uuid),
                        academic_year, semester_number, faculty_group
           order by created_at desc nulls last, id desc
         ) as rn
  from public.tuition
)
delete from public.tuition t
using ranked
where t.id = ranked.id and ranked.rn > 1;

-- ---------------------------------------------------------------------------
-- requirements: key = (cycle_id, applicant_category, recruitment_unit_id,
-- content hash of prose_ko). Nullable columns coalesced to a stable sentinel
-- so NULL groups collapse into one bucket instead of each counting as
-- distinct.
-- ---------------------------------------------------------------------------
with ranked as (
  select id,
         row_number() over (
           partition by cycle_id, coalesce(applicant_category, ''),
                        coalesce(recruitment_unit_id, '00000000-0000-0000-0000-000000000000'::uuid),
                        md5(coalesce(prose_ko, ''))
           order by created_at desc nulls last, id desc
         ) as rn
  from public.requirements
)
delete from public.requirements r
using ranked
where r.id = ranked.id and ranked.rn > 1;

-- ---------------------------------------------------------------------------
-- scholarships: institution-scoped (no cycle_id column on this table). key =
-- (institution_id, name_ko, award_type, award_value).
-- ---------------------------------------------------------------------------
with ranked as (
  select id,
         row_number() over (
           partition by institution_id, coalesce(name_ko, ''),
                        coalesce(award_type, ''), coalesce(award_value::text, '')
           order by created_at desc nulls last, id desc
         ) as rn
  from public.scholarships
)
delete from public.scholarships s
using ranked
where s.id = ranked.id and ranked.rn > 1;

-- ---------------------------------------------------------------------------
-- documents_required: the schema requires only source_text_ko per row (a
-- known audit finding — many rows carry no document_type/name at all), so
-- the key folds in source_text_ko alongside document_type/notes_ko rather
-- than risk collapsing two different, identity-less documents into one.
-- ---------------------------------------------------------------------------
with ranked as (
  select id,
         row_number() over (
           partition by cycle_id, coalesce(applicant_category, ''),
                        coalesce(document_type, ''),
                        md5(coalesce(notes_ko, '') || '|' || coalesce(source_text_ko, ''))
           order by created_at desc nulls last, id desc
         ) as rn
  from public.documents_required
)
delete from public.documents_required d
using ranked
where d.id = ranked.id and ranked.rn > 1;

-- ---------------------------------------------------------------------------
-- Verification — every one of these MUST return 0 rows before the
-- companion migration is safe to apply. If any return rows, stop: the key
-- above is not tight enough for that table's real data and needs revising,
-- not a forced index creation.
-- ---------------------------------------------------------------------------
select 'tuition' as tbl, count(*) as remaining_dupe_groups from (
  select 1 from public.tuition
  group by institution_id,
           coalesce(recruitment_unit_id, '00000000-0000-0000-0000-000000000000'::uuid),
           academic_year, semester_number, faculty_group
  having count(*) > 1
) x
union all
select 'requirements', count(*) from (
  select 1 from public.requirements
  group by cycle_id, coalesce(applicant_category, ''),
           coalesce(recruitment_unit_id, '00000000-0000-0000-0000-000000000000'::uuid),
           md5(coalesce(prose_ko, ''))
  having count(*) > 1
) x
union all
select 'scholarships', count(*) from (
  select 1 from public.scholarships
  group by institution_id, coalesce(name_ko, ''),
           coalesce(award_type, ''), coalesce(award_value::text, '')
  having count(*) > 1
) x
union all
select 'documents_required', count(*) from (
  select 1 from public.documents_required
  group by cycle_id, coalesce(applicant_category, ''), coalesce(document_type, ''),
           md5(coalesce(notes_ko, '') || '|' || coalesce(source_text_ko, ''))
  having count(*) > 1
) x;

-- Review the verification output. If all four are 0, COMMIT. Otherwise
-- ROLLBACK and revise the partition keys above for the table(s) that still
-- show duplicates.
commit;
