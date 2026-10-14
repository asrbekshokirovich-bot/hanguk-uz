-- "Universitet tanlash": up to three universities chosen for a student, in
-- priority order (rank 1 is the first choice).
--
-- student_university_priorities already exists, but it holds free-text wishes
-- from the old intake form (no institution, no order); the CRM shows those as
-- the student's earlier wishes and keeps them untouched. Choices made on the
-- new page live here, tied to a catalog institution.
--
-- Staff who work with students (owner, admin, document_handler,
-- call_operator) read and edit every row; a student reads their own.

create table if not exists public.student_university_choices (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references auth.users (id) on delete cascade,
  institution_id uuid not null references public.institutions (id) on delete cascade,
  rank           smallint not null check (rank between 1 and 3),
  created_by     uuid default auth.uid(),
  created_at     timestamptz not null default now(),
  unique (student_id, institution_id)
);

create index if not exists student_university_choices_student_idx
  on public.student_university_choices (student_id, rank);

alter table public.student_university_choices enable row level security;

drop policy if exists "student_university_choices_staff_all" on public.student_university_choices;
create policy "student_university_choices_staff_all" on public.student_university_choices
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

drop policy if exists "student_university_choices_read_own" on public.student_university_choices;
create policy "student_university_choices_read_own" on public.student_university_choices
  for select to authenticated
  using (student_id = (select auth.uid()));
