-- Audit M17 / M18 (2026-05-12): expose virtual_tour + walkaround_url
-- on v_institutions_for_map so the universities provider can read
-- them in a single round-trip.
--
-- Note: CREATE OR REPLACE VIEW can't reorder columns. The first
-- attempt failed (`cannot change name of view column`) because
-- adding the new columns mid-list would shift `next_event_at`. We
-- DROP then re-CREATE to side-step the ordering constraint.
DROP VIEW IF EXISTS public.v_institutions_for_map CASCADE;

CREATE VIEW public.v_institutions_for_map AS
 SELECT id,
    name_ko,
    name_ko_short,
    COALESCE(display_names ->> 'en'::text, name_en) AS name_en,
    COALESCE(display_names ->> 'uz'::text, name_en, name_ko) AS name_uz,
    city_ko,
    latitude,
    longitude,
    logo_url,
    tier,
    ieqas_status,
    is_partner,
    is_visible_on_map,
    last_verified_at,
    ( SELECT min(cd.starts_at) AS min
           FROM cycle_dates cd
             JOIN admission_cycles ac ON ac.id = cd.cycle_id
          WHERE ac.institution_id = i.id
            AND ac.status = 'verified'::text
            AND (cd.event_type = ANY (ARRAY['apply_open'::text, 'apply_close'::text]))
            AND cd.starts_at > now()) AS next_event_at,
    virtual_tour,
    walkaround_url
   FROM institutions i
  WHERE is_visible_on_map = true;

GRANT SELECT ON public.v_institutions_for_map TO anon, authenticated;
