-- ============================================================================
--  Pre-uni_db rename: scholarships -> legacy_scholarships
--
--  The prod baseline (00000000000001_lovable_baseline.sql) carries a
--  `public.scholarships` table from the legacy Lovable schema (per-row
--  university scholarships with university_id, name, coverage, ...).
--
--  uni_db Phase 0 (20260601000003_uni_db_v1_scholarships_documents.sql)
--  creates its own `public.scholarships` table with a DIFFERENT shape
--  (institution_id, scope, award_type, topik_tier_table, ...). The two
--  shapes can't coexist under the same name.
--
--  Resolution: rename the legacy table out of the way before uni_db
--  Phase 0 runs. Data is preserved on prod under the new name; staging
--  was empty so this is a no-op there. A future migration (Phase 1+
--  equivalent of fn_copy_legacy_universities_to_institutions) will
--  migrate any rows worth carrying over.
--
--  Idempotent — safe to re-run.
-- ============================================================================

do $$
begin
  if exists (
    select 1 from information_schema.tables
     where table_schema = 'public'
       and table_name = 'scholarships'
       and table_type = 'BASE TABLE'
  ) and not exists (
    select 1 from information_schema.tables
     where table_schema = 'public'
       and table_name = 'legacy_scholarships'
       and table_type = 'BASE TABLE'
  ) then
    -- Detect schema-shape: legacy has university_id, uni_db has
    -- institution_id. Only rename the legacy shape.
    if exists (
      select 1 from information_schema.columns
       where table_schema = 'public'
         and table_name = 'scholarships'
         and column_name = 'university_id'
    ) then
      alter table public.scholarships rename to legacy_scholarships;
      raise notice 'renamed legacy public.scholarships to public.legacy_scholarships';
    else
      raise notice 'public.scholarships exists but appears to be the uni_db shape; not renaming';
    end if;
  else
    raise notice 'pre_uni_db_scholarships_rename: nothing to do';
  end if;
end
$$;
