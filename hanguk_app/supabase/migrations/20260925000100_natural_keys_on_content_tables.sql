-- 2026-09-01 audit finding, Stage 2.3 of HEALTH_IMPLEMENTATION_PLAN.md.
--
-- Companion to scripts/dedupe_before_natural_keys.sql, which MUST be run
-- and verified duplicate-free first — every ADD CONSTRAINT below fails
-- outright if a duplicate under that key still exists.
--
-- Without these, every re-extraction cycle can add a second full set of
-- content rows for the same real-world fact, because publish_worker
-- bare-INSERTs and nothing before it checks for an existing row. tuition
-- already had a unique constraint, but it includes the nullable
-- recruitment_unit_id column, which the publisher always leaves NULL — under
-- SQL's NULL-is-distinct-from-NULL rule that constraint has never actually
-- fired. This migration drops it and replaces it, alongside requirements/
-- scholarships/documents_required, with a constraint that coalesces every
-- nullable key column to a stable sentinel instead.
--
-- NOT APPLIED to production by this commit — see the dedup script's header
-- for the review path.

begin;

-- tuition: replace the existing constraint. A plain UNIQUE(...) cannot
-- express "treat NULL as one value" directly, so this is a unique index
-- over coalesced expressions instead of a table constraint.
alter table public.tuition
  drop constraint if exists tuition_institution_id_recruitment_unit_id_academic_year_se_key;

create unique index if not exists uq_tuition_natural_key
  on public.tuition (
    institution_id,
    (coalesce(recruitment_unit_id, '00000000-0000-0000-0000-000000000000'::uuid)),
    academic_year,
    semester_number,
    faculty_group
  );

create unique index if not exists uq_requirements_natural_key
  on public.requirements (
    cycle_id,
    (coalesce(applicant_category, '')),
    (coalesce(recruitment_unit_id, '00000000-0000-0000-0000-000000000000'::uuid)),
    (md5(coalesce(prose_ko, '')))
  );

create unique index if not exists uq_scholarships_natural_key
  on public.scholarships (
    institution_id,
    (coalesce(name_ko, '')),
    (coalesce(award_type, '')),
    (coalesce(award_value::text, ''))
  );

create unique index if not exists uq_documents_required_natural_key
  on public.documents_required (
    cycle_id,
    (coalesce(applicant_category, '')),
    (coalesce(document_type, '')),
    (md5(coalesce(notes_ko, '') || '|' || coalesce(source_text_ko, '')))
  );

commit;

-- After this lands, publish_worker's per-table INSERTs (publish_worker.py:
-- _publish_tuition / _publish_requirements / _publish_scholarships /
-- _publish_documents) need an ON CONFLICT (...) DO UPDATE clause matching
-- each index above, or every insert into an already-published row will
-- start raising a unique-violation instead of silently duplicating —
-- turning a silent correctness bug into a loud availability one. That
-- application-code change is a separate PR from this schema change and
-- should land in the same deploy, not before it.
