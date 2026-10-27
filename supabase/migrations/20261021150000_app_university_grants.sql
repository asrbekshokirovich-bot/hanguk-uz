-- The university page's "Grantlar" table (student app, 2026-10-21): every
-- grant one guideline gives on admission ("kirishda") for a TOPIK or IELTS
-- result, as a percent of tuition or as a sum, in the guideline's own
-- order. "boshqa" (a partner school, a language institute) is left out, as
-- on the board. Open to guests.
create or replace function public.app_university_grants(p_guideline uuid)
returns table (
  tartib integer,
  mezon text,
  topik_min numeric,
  topik_max numeric,
  ielts_min numeric,
  toefl_ibt_min numeric,
  grant_pct integer,
  grant_sum numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select g.tartib, g.mezon, g.topik_min, g.topik_max, g.ielts_min, g.toefl_ibt_min,
         g.grant_foiz::int, g.grant_summa
    from public.university_guideline_grants g
   where g.guideline_uuid = p_guideline
     and g.qachon = 'kirishda'
     and g.mezon <> 'boshqa'
     and (g.grant_foiz is not null or g.grant_summa is not null)
   order by g.tartib;
$$;

revoke all on function public.app_university_grants(uuid) from public;
grant execute on function public.app_university_grants(uuid) to anon, authenticated;
