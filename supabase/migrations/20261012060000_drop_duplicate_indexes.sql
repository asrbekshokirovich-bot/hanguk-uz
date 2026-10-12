-- Six tables each carried two identical indexes (the performance advisor's
-- duplicate_index lint). Every write paid for both; only one was ever read.
-- Each pair keeps the twin the planner has been using.

drop index if exists public.idx_study_plan_analyses_session_id;
drop index if exists public.idx_study_plan_chat_history_session_id;
drop index if exists public.idx_study_plan_drafts_session_id;
drop index if exists public.idx_study_plan_sessions_student_id;
drop index if exists public.idx_university_admission_periods_university_id;
drop index if exists public.idx_university_programs_university_id;
