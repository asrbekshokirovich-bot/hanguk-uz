-- Onlayn / oflayn ariza progress per student per chosen university.
--
--   online_submitted_at  set on the Onlayn ariza page ("Onlayn topshirildi").
--                        Until it is set the student shows dimmed on the
--                        Oflayn ariza page and their paper documents can't be
--                        marked as sent.
--   offline_sent_at      set on the Oflayn ariza page once the paper documents
--                        have been posted to the university.
--   copies, note         how many copies go to the university, and a note —
--                        typed by staff on the Oflayn ariza page.
--
-- Applied to production on 2026-10-14 (statement by statement through the
-- Supabase connector); kept here so the repo matches.

create table if not exists public.student_university_submissions (
  id                  uuid primary key default gen_random_uuid(),
  student_id          uuid not null references auth.users (id) on delete cascade,
  institution_id      uuid not null references public.institutions (id) on delete cascade,
  online_submitted_at timestamptz,
  online_submitted_by uuid,
  offline_sent_at     timestamptz,
  offline_sent_by     uuid,
  copies              smallint check (copies is null or copies between 0 and 50),
  note                text,
  updated_at          timestamptz not null default now(),
  unique (student_id, institution_id)
);

alter table public.student_university_submissions enable row level security;

create policy "student_university_submissions_staff_all" on public.student_university_submissions
  for all to authenticated
  using (
    public.has_role((select auth.uid()), 'owner'::public.app_role) or
    public.has_role((select auth.uid()), 'admin'::public.app_role) or
    public.has_role((select auth.uid()), 'document_handler'::public.app_role) or
    public.has_role((select auth.uid()), 'call_operator'::public.app_role)
  )
  with check (
    public.has_role((select auth.uid()), 'owner'::public.app_role) or
    public.has_role((select auth.uid()), 'admin'::public.app_role) or
    public.has_role((select auth.uid()), 'document_handler'::public.app_role) or
    public.has_role((select auth.uid()), 'call_operator'::public.app_role)
  );
