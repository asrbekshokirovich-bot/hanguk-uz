-- Add `degree_level` to applications so staff can record whether an application
-- is for a Bachelor's, Master's, or GKS (Global Korea Scholarship) track when
-- attaching a student to a university on the CRM applications board.
--
-- Forward-only and additive: the column is nullable, so all existing rows stay
-- NULL until a degree is set. A CHECK keeps the value in the known set.

alter table public.applications
  add column if not exists degree_level text;

alter table public.applications
  drop constraint if exists applications_degree_level_check;

alter table public.applications
  add constraint applications_degree_level_check
  check (degree_level is null or degree_level in ('bachelor', 'master', 'gks'));

comment on column public.applications.degree_level is
  'Applicant track for this application: bachelor | master | gks. NULL for legacy rows.';
