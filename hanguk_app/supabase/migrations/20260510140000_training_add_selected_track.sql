-- ============================================================================
--  training — persist selected_track on study_plan_sessions
--
--  Audit F2 (docs/audits/training_audit_2026-05-10.md). Previously the
--  Dart side patched selectedTrack into the in-memory session object but
--  never wrote it to Supabase. Resumed sessions came back with track =
--  null and the analysis/track-mismatch warning couldn't function.
--
--  Track values converged on 'en' / 'ko' (audit F5) but legacy rows may
--  still carry 'english' / 'korean' — both shapes are accepted by the
--  Step 1 guide and the analysis view's mismatch warning.
-- ============================================================================

alter table public.study_plan_sessions
  add column if not exists selected_track text;

comment on column public.study_plan_sessions.selected_track is
  'Language track of the draft: ''en'' or ''ko''. Legacy rows may carry ''english''/''korean''.';
