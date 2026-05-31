-- Add vapi_call_id to interview_sessions so completed sessions can be
-- replayed via the Vapi recording link (Task 4 of
-- .claude/PRPs/plans/interview-training-fixes.plan.md).
--
-- Existing rows stay NULL; the audio player widget already shows
-- "Audio recording not found" gracefully when the column is null.

alter table public.interview_sessions
  add column if not exists vapi_call_id text;

create index if not exists interview_sessions_vapi_call_id_idx
  on public.interview_sessions (vapi_call_id);

comment on column public.interview_sessions.vapi_call_id is
  'Vapi call ID for fetching the WebRTC session recording. Populated by '
  'InterviewNotifier.setVapiCallId() when a Vapi call connects.';
