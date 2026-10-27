-- Bosh sahifa "Grant / stipendiya" (owner, 2026-10-20): the app filters the
-- universities by the largest tuition waiver they offer (30%+ / 50%+ / 100%).
--
-- scholarships is readable only by signed-in app users (fn_is_app_user), and
-- the board is the first thing a guest sees, so the per-university maximum —
-- public information from the admission guidelines — is handed out here to
-- everyone.
--
-- Applied to production on 2026-10-20 through the Supabase connector.

create or replace function public.app_grant_summary()
returns table (institution_id uuid, max_waiver_pct int)
language sql
stable
security definer
set search_path = public
as $$
  select s.institution_id, max(s.award_value)::int
    from public.scholarships s
   where s.award_type = 'tuition_waiver_pct'
     and s.award_value is not null
     and s.institution_id is not null
   group by s.institution_id;
$$;

revoke all on function public.app_grant_summary() from public;
grant execute on function public.app_grant_summary() to anon, authenticated;
