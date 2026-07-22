-- The third applicant track becomes vocational education ("Kasbiy ta'lim").
--
-- Historic rows are deliberately NOT rewritten: students recorded as GKS before
-- today stay GKS. Only new applications get 'vocational'. Both values therefore
-- remain valid — 'gks' is history, 'vocational' is what the picker writes now.
--
-- Renaming rather than reusing 'gks' matters because the system already has a
-- separate, real GKS concept (profiles.is_gks_applicant + the "GKS Applicants"
-- filter); overloading 'gks' to mean "vocational" would collide with it.

alter table public.applications
  drop constraint if exists applications_degree_level_check;

alter table public.applications
  add constraint applications_degree_level_check
  check (degree_level is null or degree_level in ('bachelor', 'master', 'vocational', 'gks'));

comment on column public.applications.degree_level is
  'Applicant track: bachelor | master | vocational. ''gks'' is historic (recorded before the vocational rename) and is kept as-is. NULL for rows created before the column existed.';
