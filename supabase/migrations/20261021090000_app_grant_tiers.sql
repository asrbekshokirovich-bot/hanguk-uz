-- The board's "Grant / stipendiya" (student app, design 2026-10-21): what
-- tuition grant a student's TOPIK or IELTS earns at each university. Read
-- from university_guideline_grants (the guidelines' scholarship tables):
-- only grants given on admission ("kirishda"), in percent, and tied to a
-- test the board asks about — "boshqa" (a partner school, a language
-- institute) is not something the student can choose. Open to guests.
create or replace function public.app_grant_tiers()
returns table (
  guideline_id uuid,
  mezon text,
  topik_min numeric,
  topik_max numeric,
  ielts_min numeric,
  grant_pct integer
)
language sql
stable
security definer
set search_path = public
as $$
  select g.guideline_uuid, g.mezon, g.topik_min, g.topik_max, g.ielts_min, g.grant_foiz::int
    from public.university_guideline_grants g
   where g.qachon = 'kirishda'
     and g.grant_foiz is not null
     and g.mezon <> 'boshqa';
$$;

revoke all on function public.app_grant_tiers() from public;
grant execute on function public.app_grant_tiers() to anon, authenticated;
