-- A student often finishes their document pack before a university is chosen
-- (applications.institution_id is NOT NULL, so no application row can exist
-- yet). This flag lets "Hujjatlar" mark that pack ready per season, so
-- "Arizalar" can show the student in its "Hujjatlar tayyor" column even
-- without a real application row — student_intakes is already the
-- role-independent, per-season home for exactly this kind of fact.

alter table public.student_intakes
  add column if not exists docs_ready boolean not null default false;

comment on column public.student_intakes.docs_ready is
  'Staff-set (Hujjatlar > "Keyingi bosqichga o''tkazish") when this student''s document pack is ready this season but no application/university is attached yet. Drives their virtual card in the "Hujjatlar tayyor" column of Arizalar until a real application exists.';
