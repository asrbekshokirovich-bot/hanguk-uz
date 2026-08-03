-- Free re-application: a season a student is not charged for.
--
-- The agency's guarantee is that a student whose visa is refused gets re-sent
-- the following intake at no cost. The CRM could not express that, and it
-- showed: two students carried from Fall 2026 into Spring 2027 were billed
-- twice.
--
-- The cause is a grain mismatch, not bad data. The payment plan lives on
-- `profiles` (payment_plan / payment_mode / contract_date) — one per student,
-- season-independent — while `student_intakes` is deliberately multi-season.
-- Expected payments are derived per active season from the profile's plan, so
-- a student in two seasons has the same plan counted in both.
--
-- The existing 'free' plan value cannot express this: it is on the profile, so
-- setting it would also zero the first season, where the student really did
-- pay. The exemption belongs to the (student, season) pair — which is exactly
-- what a row of this table is.

alter table public.student_intakes
  add column if not exists is_free_reapplication boolean not null default false;

comment on column public.student_intakes.is_free_reapplication is
  'This season is a free re-application for the student (e.g. the previous intake ended in a visa refusal). Suppresses expected payments for this season only; other seasons bill normally.';

-- Partial: the flag is false for almost every row, and the reads that care
-- ("who is exempt this season") only ever want the true side.
create index if not exists student_intakes_free_reapplication_idx
  on public.student_intakes (intake_id)
  where is_free_reapplication;
