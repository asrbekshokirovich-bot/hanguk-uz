-- Tell the app which institutions actually have data for the season on sale.
--
-- `v_institutions_for_map` returns every `is_visible_on_map` institution — 204
-- today — with no way to tell the 45 we hold verified admission data for from
-- the 159 we know only a name, a city and a pin for. Guest Explore therefore
-- listed all 204 as if they were equally researched.
--
-- `has_intake_data` is that distinction, computed against the intake the CRM
-- has marked default (`public.intakes.is_default`) rather than a hardcoded
-- year. Two consequences that are the point of doing it this way:
--
--   * a university whose guideline is approved and published today shows up
--     on the next app refresh — nobody edits a list;
--   * when the season rolls over and staff flip the default intake to
--     fall 2027, the flag follows, and institutions carrying only spring
--     data stop claiming to be current.
--
-- Superseded cycles do not count: a cycle is superseded precisely when a newer
-- document replaced it, so the surviving row is what should decide the flag.
--
-- The column is additive — every existing consumer of the view is untouched,
-- and a client that does not select it is unaffected.

create or replace view public.v_institutions_for_map as
  select id,
         name_ko,
         name_ko_short,
         coalesce(display_names ->> 'en', name_en) as name_en,
         coalesce(display_names ->> 'uz', name_en, name_ko) as name_uz,
         city_ko,
         latitude,
         longitude,
         logo_url,
         tier,
         ieqas_status,
         is_partner,
         is_visible_on_map,
         last_verified_at,
         (select min(cd.starts_at)
            from cycle_dates cd
            join admission_cycles ac on ac.id = cd.cycle_id
           where ac.institution_id = i.id
             and ac.status = 'verified'
             and cd.event_type = any (array['apply_open', 'apply_close'])
             and cd.starts_at > now()) as next_event_at,
         virtual_tour,
         walkaround_url,
         primary_domain,
         exists (
           select 1
             from public.admission_cycles ac
             join public.intakes it on it.is_default
            where ac.institution_id = i.id
              and ac.intake_year = it.year
              and ac.intake_term = it.season
              and ac.status <> 'superseded'
         ) as has_intake_data
    from institutions i
   where is_visible_on_map = true;

comment on view public.v_institutions_for_map is
  'Map/Explore catalogue. `has_intake_data` marks the institutions holding a '
  'non-superseded admission cycle for the CRM''s default intake — the ones the '
  'app can show more than a pin for. It tracks `intakes.is_default`, so newly '
  'published guidelines appear without a code change and a season rollover '
  'retires last season''s coverage automatically.';
