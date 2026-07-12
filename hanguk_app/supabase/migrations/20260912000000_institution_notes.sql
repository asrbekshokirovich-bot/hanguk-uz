-- institution_notes — staff "insider tips" attached to an institution, the
-- new home for what university_notes held before the 2026-05 universities-table
-- cutover. Written by staff in the CRM (Universities → admissions sheet → Notes),
-- read server-side by the compare-universities edge function to enrich the
-- student-facing AI comparison. Never returned raw to students.
--
-- RLS mirrors institutions_staff_write (owner / admin / document_handler via
-- has_role); the edge function reads with the service role, so no student-facing
-- SELECT policy is needed or wanted.

create table if not exists public.institution_notes (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  note_type      text not null default 'general'
                   check (note_type in ('tip', 'general', 'warning')),
  content        text not null check (length(btrim(content)) > 0),
  is_active      boolean not null default true,
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists institution_notes_institution_id_idx
  on public.institution_notes (institution_id)
  where is_active;

alter table public.institution_notes enable row level security;

-- Staff (owner / admin / document_handler) manage notes; everyone else denied.
drop policy if exists institution_notes_staff_all on public.institution_notes;
create policy institution_notes_staff_all
  on public.institution_notes
  as permissive
  for all
  to public
  using (
    has_role(auth.uid(), 'owner'::app_role)
    or has_role(auth.uid(), 'admin'::app_role)
    or has_role(auth.uid(), 'document_handler'::app_role)
  )
  with check (
    has_role(auth.uid(), 'owner'::app_role)
    or has_role(auth.uid(), 'admin'::app_role)
    or has_role(auth.uid(), 'document_handler'::app_role)
  );

-- updated_at maintenance — reuse the baseline trigger function.
drop trigger if exists institution_notes_set_updated_at on public.institution_notes;
create trigger institution_notes_set_updated_at
  before update on public.institution_notes
  for each row execute function public.update_updated_at_column();
