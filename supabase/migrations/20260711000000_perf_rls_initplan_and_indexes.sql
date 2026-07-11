-- Performance: wrap auth.uid() in (select auth.uid()) across RLS policies, and
-- add indexes serving the hot batch queries.
--
-- Why: calling auth.uid() bare in a policy makes Postgres re-evaluate it for
-- every candidate row. Wrapping it in a scalar sub-select lets the planner
-- evaluate it once per statement (InitPlan), which is dramatically cheaper on
-- the full-table scans the CRM issues today. The value is identical, so this is
-- behaviour-preserving. See:
-- https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
--
-- The DO block rewrites each affected policy in place via ALTER POLICY, reading
-- the current definition from pg_policies and re-emitting it with the wrapped
-- form. It is re-runnable: policies already wrapped are skipped.

DO $$
DECLARE
  r record;
  new_qual text;
  new_check text;
  stmt text;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~ 'auth\.uid\(\)'
      -- Case-insensitive guard: Postgres re-deparses the wrapped form as
      -- uppercase `SELECT auth.uid()`, so a case-sensitive check would re-match
      -- and double-wrap on a second run. ~* keeps this migration idempotent.
      AND (coalesce(qual, '') || ' ' || coalesce(with_check, '')) !~* '\(\s*select\s+auth\.uid'
  LOOP
    new_qual := CASE WHEN r.qual IS NOT NULL
      THEN regexp_replace(r.qual, 'auth\.uid\(\)', '(select auth.uid())', 'g') END;
    new_check := CASE WHEN r.with_check IS NOT NULL
      THEN regexp_replace(r.with_check, 'auth\.uid\(\)', '(select auth.uid())', 'g') END;

    stmt := format('ALTER POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    IF new_qual IS NOT NULL THEN
      stmt := stmt || format(' USING (%s)', new_qual);
    END IF;
    IF new_check IS NOT NULL THEN
      stmt := stmt || format(' WITH CHECK (%s)', new_check);
    END IF;

    EXECUTE stmt;
  END LOOP;
END $$;

-- Indexes serving the batched `.in('student_id', ...)` fetches in useCRMData and
-- the per-student comment/document/payment lookups. Existing partial-unique
-- indexes on these tables do not cover all rows, so add plain btree indexes.
CREATE INDEX IF NOT EXISTS idx_documents_student_id ON public.documents (student_id);
CREATE INDEX IF NOT EXISTS idx_payments_student_id ON public.payments (student_id);
CREATE INDEX IF NOT EXISTS idx_student_comments_student_id ON public.student_comments (student_id);
