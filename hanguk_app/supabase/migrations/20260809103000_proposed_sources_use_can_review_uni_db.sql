-- ============================================================================
--  proposed_sources — align RLS with the staff-wide review gate
--
--  `proposed_sources_reviewer_read`/`_update` (from
--  20260606000200_uni_db_v2_proposed_sources.sql) still check
--  `profiles.role in ('admin','uni_db_reviewer')` directly. That predates
--  20260523080000_uni_db_open_review_to_staff.sql, which introduced
--  `fn_can_review_uni_db()` and repointed review_queue / extraction_jobs /
--  guideline_documents / institutions at it so ANY non-student staff member
--  (owner / admin / call_operator / document_handler / university_staff via
--  `user_roles`) can review — not just accounts with a legacy
--  profiles.role of 'admin' or 'uni_db_reviewer'.
--
--  proposed_sources was added two weeks later but never got the same
--  update, so a staff member whose access lives in `user_roles` (the normal
--  case — see the comment in 20260523080000) sees the "Havolalar" tab
--  (ProposedLinksView, via useProposedSources) as permanently empty even
--  when rows exist: RLS silently filters them all out. Repoint both
--  policies at fn_can_review_uni_db() to match every other reviewer-facing
--  table.
--
--  Idempotent: DROP POLICY IF EXISTS + CREATE POLICY throughout.
-- ============================================================================

set local search_path = public, pg_catalog;

drop policy if exists proposed_sources_reviewer_read on public.proposed_sources;
create policy proposed_sources_reviewer_read on public.proposed_sources
  for select using (public.fn_can_review_uni_db());

drop policy if exists proposed_sources_reviewer_update on public.proposed_sources;
create policy proposed_sources_reviewer_update on public.proposed_sources
  for update using (public.fn_can_review_uni_db());
