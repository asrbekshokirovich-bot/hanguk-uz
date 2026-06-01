-- Per-institution admissions-content counts, so the student university browser
-- can show which universities actually have info (and how much) in a single
-- query instead of one-per-card.
--
-- security_invoker = true: the view runs with the caller's privileges, so it
-- respects the RLS on the underlying tables (a student only counts rows they are
-- allowed to read). Verified as a real student: returns 51 rows, 24 with info.

create or replace view public.v_institution_content_counts
with (security_invoker = true) as
select
  i.id as institution_id,
  (select count(*) from public.admission_cycles c
     where c.institution_id = i.id and c.status <> 'superseded') as cycles,
  (select count(*) from public.requirements r
     join public.admission_cycles c on c.id = r.cycle_id
     where c.institution_id = i.id) as requirements,
  (select count(*) from public.documents_required d
     join public.admission_cycles c on c.id = d.cycle_id
     where c.institution_id = i.id) as documents,
  (select count(*) from public.scholarships s where s.institution_id = i.id) as scholarships,
  (select count(*) from public.tuition t where t.institution_id = i.id) as tuition,
  (select count(*) from public.university_admission_periods p where p.institution_id = i.id) as periods
from public.institutions i;

grant select on public.v_institution_content_counts to anon, authenticated;
