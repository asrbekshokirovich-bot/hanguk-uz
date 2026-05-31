-- Audit M17 / M18 / K6 (2026-05-12): virtual-tour + walkaround-url
-- extension on `institutions`.
--
-- Scope:
--   1. Add `virtual_tour` JSONB column. Schema for the JSON object is
--      tour-spec v1 (see docs/runbooks/kakao.md "Pannellum tour
--      pilot"): { default_scene, scenes: [{ id, panorama_url, title,
--      title_uz?, title_ko?, hotspots: [{ yaw, pitch, target_scene_id?,
--      target_url?, text? }] }] }. When set, the institution detail
--      sheet surfaces a curated "Virtual Tour" button (Pannellum)
--      instead of / alongside the Kakao Roadview "Walkaround".
--   2. Add `walkaround_url` text — optional override pointing at an
--      official university VR page (Yonsei, SNU, KAIST). When set
--      and `virtual_tour` is NULL, the detail sheet's tour button
--      opens this URL in an external browser instead of the
--      Roadview WebView.
--   3. Seed the Yonsei row (`institution_id` lookup by `name_ko`)
--      with the Pannellum CC0 example panorama so the pilot has a
--      visible end-to-end path on staging + prod from minute zero.
--      The `TODO: replace with real Yonsei imagery` marker on the
--      seed JSON is the trigger for content team to swap in real
--      campus panoramas when they license them.

ALTER TABLE public.institutions
  ADD COLUMN IF NOT EXISTS virtual_tour jsonb,
  ADD COLUMN IF NOT EXISTS walkaround_url text;

COMMENT ON COLUMN public.institutions.virtual_tour IS
  'Audit M17 (2026-05-12) Pannellum tour spec v1; see docs/runbooks/kakao.md';
COMMENT ON COLUMN public.institutions.walkaround_url IS
  'Audit M18 (2026-05-12) optional URL of an official university VR page.';

-- Lightweight shape check so a malformed JSON doesn't break the UI.
-- We accept NULL or an object containing at least a `scenes` array.
ALTER TABLE public.institutions
  DROP CONSTRAINT IF EXISTS institutions_virtual_tour_shape_chk;
ALTER TABLE public.institutions
  ADD CONSTRAINT institutions_virtual_tour_shape_chk CHECK (
    virtual_tour IS NULL
    OR (jsonb_typeof(virtual_tour) = 'object'
        AND jsonb_typeof(virtual_tour -> 'scenes') = 'array')
  );

-- Seed Yonsei. We match by `name_ko = '연세대학교'` (the canonical KOR
-- name on the institutions table). If the seed row doesn't exist on a
-- particular environment, the UPDATE simply touches zero rows and the
-- migration is still applied — no error.
UPDATE public.institutions
SET virtual_tour = jsonb_build_object(
  '_note', 'TODO: replace with real Yonsei imagery (Pannellum CC0 demo seeded as the pilot baseline).',
  'default_scene', 'main_gate',
  'scenes', jsonb_build_array(
    jsonb_build_object(
      'id', 'main_gate',
      'panorama_url',
      'https://pannellum.org/images/alma.jpg',
      'title', 'Main Gate',
      'title_ko', '정문',
      'title_uz', 'Bosh darvoza',
      'hotspots', jsonb_build_array(
        jsonb_build_object(
          'yaw', 117.0,
          'pitch', -10.0,
          'target_scene_id', 'library',
          'text', 'To the Yonsei Central Library'
        )
      )
    ),
    jsonb_build_object(
      'id', 'library',
      'panorama_url',
      'https://pannellum.org/images/bma-1.jpg',
      'title', 'Central Library',
      'title_ko', '중앙도서관',
      'title_uz', 'Markaziy kutubxona',
      'hotspots', jsonb_build_array(
        jsonb_build_object(
          'yaw', -65.0,
          'pitch', -5.0,
          'target_scene_id', 'main_gate',
          'text', 'Back to the Main Gate'
        ),
        jsonb_build_object(
          'yaw', 90.0,
          'pitch', -3.0,
          'target_scene_id', 'quad',
          'text', 'Step into the Quad'
        )
      )
    ),
    jsonb_build_object(
      'id', 'quad',
      'panorama_url',
      'https://pannellum.org/images/cerro-toco-0.jpg',
      'title', 'Campus Quad',
      'title_ko', '캠퍼스 광장',
      'title_uz', 'Kampus maydoni',
      'hotspots', jsonb_build_array(
        jsonb_build_object(
          'yaw', 180.0,
          'pitch', -5.0,
          'target_scene_id', 'library',
          'text', 'Back to the Library'
        )
      )
    )
  )
)
WHERE name_ko = '연세대학교'
  AND (virtual_tour IS NULL OR virtual_tour ? '_note');
-- The second predicate makes this migration idempotent: re-running it
-- only overwrites the seed, never a hand-curated real panorama set
-- (which won't have the `_note` key).

-- Rebuild the map view to expose the new fields if the view's contract
-- ever shifts to include them. For now `v_institutions_for_map` does
-- NOT need them — the detail sheet reads from `institutions` directly
-- (see InstitutionDetailScreen). Documented here as a marker so a
-- future iteration knows where to make the call.
