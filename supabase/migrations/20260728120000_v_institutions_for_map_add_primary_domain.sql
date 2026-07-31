-- Expose institutions.primary_domain through v_institutions_for_map.
--
-- The map detail sheet's "Visit University Website" button was gated on the
-- deprecated `website` field, which map_repository always emitted as null, so
-- the button never appeared. All 421 institutions have `primary_domain`
-- populated (e.g. 'yonsei.ac.kr'); the Flutter side turns it into
-- https://<domain>. This adds the column to the read view so the app can
-- select it. Additive-only: existing columns/order are unchanged, and the
-- view's security_invoker option is preserved (RLS on institutions still
-- applies per-caller).
CREATE OR REPLACE VIEW public.v_institutions_for_map
WITH (security_invoker = on) AS
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
    walkaround_url,
    primary_domain
   FROM institutions i
  WHERE is_visible_on_map = true;
