-- ============================================================================
--  uni_db — enrichment fields for the combined review view
--
--  Adds the one genuinely-new destination column: scholarships.ielts_tier_table
--  (IELTS-band scholarship tiers for foreign students, mirroring the existing
--  topik_tier_table). All other enrichment fields map to columns that already
--  exist (university_admission_periods.*, tuition.*, programs.name_ko via
--  recruitment_unit_programs) — the work there is in the extractor + prompts.
--
--  Idempotent.
-- ============================================================================

alter table public.scholarships
  add column if not exists ielts_tier_table jsonb;

comment on column public.scholarships.ielts_tier_table is
  'IELTS-band scholarship tiers: [{ielts_min, award_type, award_value, duration}]. '
  'Sibling of topik_tier_table for the English-track foreign-student scholarship grids.';
