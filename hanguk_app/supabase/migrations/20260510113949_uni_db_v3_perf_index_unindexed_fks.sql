-- ============================================================================
--  Performance: covering indexes on uni_db FK columns that lacked one.
--
--  Without these, JOIN/lookup queries on the parent side fall back to
--  sequential scans on the child, and CASCADE deletes scan the child
--  table fully. The most-trafficked FK in the bunch is
--  user_tracked_universities → institutions; every notify-tracked-changes
--  cron tick joins through it.
--
--  Applied via Supabase MCP on 2026-05-10 to both projects.
-- ============================================================================

create index if not exists admission_cycles_guideline_document_id_idx
  on public.admission_cycles (guideline_document_id) where guideline_document_id is not null;
create index if not exists admission_cycles_superseded_by_id_idx
  on public.admission_cycles (superseded_by_id) where superseded_by_id is not null;
create index if not exists announcement_sources_institution_id_idx
  on public.announcement_sources (institution_id);
create index if not exists announcements_guideline_document_id_idx
  on public.announcements (guideline_document_id);
create index if not exists crawl_findings_announcement_id_idx
  on public.crawl_findings (announcement_id);
create index if not exists cycle_dates_recruitment_unit_id_idx
  on public.cycle_dates (recruitment_unit_id) where recruitment_unit_id is not null;
create index if not exists embedding_chunks_guideline_document_id_idx
  on public.embedding_chunks (guideline_document_id);
create index if not exists embedding_chunks_institution_id_idx
  on public.embedding_chunks (institution_id);
create index if not exists guideline_documents_superseded_by_id_idx
  on public.guideline_documents (superseded_by_id) where superseded_by_id is not null;
create index if not exists legacy_scholarships_university_id_idx
  on public.legacy_scholarships (university_id);
create index if not exists proposed_sources_promoted_to_id_idx
  on public.proposed_sources (promoted_to_id) where promoted_to_id is not null;
create index if not exists proposed_sources_reviewed_by_idx
  on public.proposed_sources (reviewed_by) where reviewed_by is not null;
create index if not exists recruitment_unit_programs_program_id_idx
  on public.recruitment_unit_programs (program_id);
create index if not exists requirements_recruitment_unit_id_idx
  on public.requirements (recruitment_unit_id) where recruitment_unit_id is not null;
create index if not exists review_queue_assigned_to_idx
  on public.review_queue (assigned_to) where assigned_to is not null;
create index if not exists translations_reviewed_by_idx
  on public.translations (reviewed_by) where reviewed_by is not null;
create index if not exists tuition_recruitment_unit_id_idx
  on public.tuition (recruitment_unit_id) where recruitment_unit_id is not null;
create index if not exists user_alerts_change_event_id_idx
  on public.user_alerts (change_event_id);
create index if not exists user_tracked_universities_institution_id_idx
  on public.user_tracked_universities (institution_id);
