-- Expose university admission announcements to the student app's
-- "University Room → News" tab.
--
-- The `announcements` and `announcement_sources` base tables are admin-only by
-- RLS (USING(false) for end users), so the News tab had no readable source and
-- always showed an empty state. Announcements are PUBLIC university notices
-- (Korean title + official URL + dates) — safe to show to applicants.
--
-- This curated view exposes only the safe, public columns and joins through
-- announcement_sources to surface institution_id (the key the app filters on;
-- it equals application.universityId). It runs with the view owner's rights
-- (security_invoker left OFF by design) so it can read past the admin-only RLS,
-- and SELECT is granted to authenticated users only. No PII or crawler
-- internals (polling cadence, failure counters, source config) are exposed.
CREATE OR REPLACE VIEW public.v_institution_announcements AS
SELECT
  a.id,
  s.institution_id,
  a.title_ko,
  a.url_ko,
  a.posted_at,
  a.detected_at,
  a.classifier_label
FROM public.announcements a
JOIN public.announcement_sources s ON s.id = a.source_id;

GRANT SELECT ON public.v_institution_announcements TO authenticated;
