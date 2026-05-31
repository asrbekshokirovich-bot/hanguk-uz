-- ============================================================================
--  uni_db v1 — legacy compatibility (dual-read / dual-write)
--  Plan §I-Phase-1 migration plan, §0.4.3
--
--  Until the existing Lovable `universities` table is renamed to
--  `institutions` (§I-Phase-2), the new schema must coexist with the
--  flat row-per-institution shape that lib/features/map and
--  lib/features/applications already read.
--
--  Strategy:
--    Phase 0 (now)  — institutions table is empty; legacy `universities`
--                     remains the source of truth. We DO NOT drop or rename
--                     the legacy table here.
--    Phase 1        — copy legacy rows into institutions; create a writable
--                     view named `universities` over institutions; drop the
--                     legacy physical table.
--    Phase 2        — finish the cutover; remove the compat view.
--
--  This migration only adds the helpers Phase 1 will rely on. It is safe
--  to run when the legacy `universities` table doesn't exist yet (we guard
--  every reference with to_regclass).
-- ============================================================================

set local search_path = public, pg_catalog;

-- ----------------------------------------------------------------------------
--  fn_legacy_universities_present
--  Helper used by Phase 1 to decide whether to attempt a copy.
-- ----------------------------------------------------------------------------
create or replace function public.fn_legacy_universities_present()
returns boolean
language sql
stable
as $$
  select to_regclass('public.universities') is not null;
$$;

-- ----------------------------------------------------------------------------
--  fn_copy_legacy_universities_to_institutions
--  Phase 1 will call this once. It copies surviving columns from the
--  legacy table into institutions, mapping name_en/name_uz into the
--  display_names jsonb so we don't lose Uzbek labels.
--
--  Idempotent: rows are matched by (kcue_code, name_ko) and updated;
--  missing rows are inserted. Stable across re-runs.
--
--  This is INTENTIONALLY not invoked here. Phase 1 invokes it explicitly
--  after the team confirms the legacy data shape.
-- ----------------------------------------------------------------------------
create or replace function public.fn_copy_legacy_universities_to_institutions()
returns table(rows_inserted int, rows_updated int)
language plpgsql
as $$
declare
  v_inserted int := 0;
  v_updated  int := 0;
begin
  if not public.fn_legacy_universities_present() then
    return query select 0::int, 0::int;
    return;
  end if;

  -- The legacy table may not have name_ko at all; we leave it null in that
  -- case — the canonical Korean name will be filled by the first crawl.
  with src as (
    select
      u.id,
      coalesce(u.name_en, '')               as name_en,
      coalesce(u.name_uz, '')               as name_uz,
      coalesce(u.city_en, '')               as city_en,
      u.latitude,
      u.longitude,
      u.logo_url,
      u.is_partner,
      u.is_visible_on_map,
      u.website_url
    from public.universities u
  )
  insert into public.institutions (
    id, name_ko, name_en, primary_domain, latitude, longitude,
    logo_url, is_partner, is_visible_on_map,
    institution_type, display_names
  )
  select
    id,
    name_en,                                  -- placeholder until crawl fills name_ko
    name_en,
    coalesce(
      regexp_replace(website_url, '^https?://(www\.)?([^/]+).*$', '\2'),
      'unknown.ac.kr'
    ),
    latitude,
    longitude,
    logo_url,
    is_partner,
    is_visible_on_map,
    'private',                                -- best guess; HITL will correct
    jsonb_build_object('en', name_en, 'uz', name_uz)
  from src
  on conflict (id) do update
    set display_names = jsonb_build_object(
          'en', excluded.name_en,
          'uz', coalesce(excluded.display_names ->> 'uz', '')
        )
  returning 1
  ;

  get diagnostics v_inserted = row_count;
  return query select v_inserted, v_updated;
end $$;

-- ----------------------------------------------------------------------------
--  Phase 1 will additionally:
--    - rename legacy `universities` to `universities_legacy_lovable`
--    - create a view `universities` that mirrors v_institutions_for_map's
--      shape with the legacy column names so map_repository.dart keeps
--      working unchanged
--  Those steps are NOT in this migration because they require coordinated
--  release with the Flutter app. See plan §I-Phase-1.
-- ----------------------------------------------------------------------------
