-- Guest Explorer (DESIGN_SPEC §3b): let a visitor browse the university
-- catalogue before they have a magic code.
--
-- Applied to production. Verified afterwards as `anon`: 204 catalogue rows
-- readable, and 0 rows from applications, documents, profiles,
-- interview_sessions, leads and user_tracked_universities.
--
-- ---------------------------------------------------------------------------
-- Why it is done this way
-- ---------------------------------------------------------------------------
-- The obvious move is to add an `anon` policy to `institutions`:
--
--     create policy institutions_public_read on institutions
--       for select to anon using (is_visible_on_map = true);
--
-- That is deliberately NOT what this does. `anon` already holds a table-level
-- SELECT grant on `institutions` (only RLS is holding it back), so such a
-- policy would hand every column of every visible row to any anonymous caller
-- writing any query they like — including columns the app never shows and
-- columns the table may grow later. A guest browsing a map should not be able
-- to enumerate the institution table.
--
-- Instead the existing map view becomes the anon entry point. It already
-- restricts:
--   * the rows    — `where is_visible_on_map = true`, the same gate the
--                   authenticated policy applies;
--   * the columns — 18 public catalogue fields (names, city, coordinates,
--                   logo, tier, IEQAS status, partner flag, tour URLs,
--                   primary domain). No contact details, no internal notes,
--                   no student data, and nothing joinable to a student.
--
-- Switching it to a security-definer view means it runs as its owner
-- (postgres) rather than the caller, so the `fn_is_app_user()` policy on the
-- underlying table no longer blocks anon — while the view's own WHERE clause
-- and column list still do all the limiting.
--
-- Net effect for anon: exactly the rows and columns an authenticated student
-- already sees on the map. Nothing else in the schema changes, and no new
-- policy is created anywhere.

alter view public.v_institutions_for_map set (security_invoker = off);

-- Already granted; restated so the intent lives in one place rather than
-- being implied by a default.
grant select on public.v_institutions_for_map to anon;

comment on view public.v_institutions_for_map is
  'Public university catalogue. Security-definer by design: this is the one '
  'surface anonymous (guest) users may read, and it restricts both rows '
  '(is_visible_on_map) and columns. Do not add a column here that an '
  'unauthenticated visitor should not see.';

-- ---------------------------------------------------------------------------
-- App-side companions (all done)
-- ---------------------------------------------------------------------------
-- 1. `/guest` and `/walkaround` are the only paths `app_router.dart` lets an
--    unauthenticated visitor reach; everything else still redirects to
--    /welcome. Pinned by test/features/guest/guest_route_access_test.dart.
-- 2. The guest screens read `universitiesProvider` and three local providers
--    and nothing else — no applications, documents, interview or chat
--    provider, and no direct Supabase call.
-- 3. `kGuestModeEnabled` in welcome_screen.dart is true.
--
-- ---------------------------------------------------------------------------
-- Verification after applying
-- ---------------------------------------------------------------------------
--   -- as anon: should return rows
--   set local role anon;
--   select count(*) from public.v_institutions_for_map;
--
--   -- as anon: should still return zero rows / permission denied
--   select count(*) from public.institutions;
--   select count(*) from public.applications;
--   select count(*) from public.interview_sessions;
--   reset role;
