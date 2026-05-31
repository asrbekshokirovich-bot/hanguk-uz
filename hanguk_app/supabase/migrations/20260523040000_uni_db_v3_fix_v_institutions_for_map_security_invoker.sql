-- Restore security_invoker = on for v_institutions_for_map.
--
-- The 2026-05-12 _v2 migration (v_institutions_for_map_virtual_tour_v2)
-- did DROP VIEW + CREATE VIEW to add virtual_tour / walkaround_url
-- columns. CREATE VIEW omits the security_invoker option set by the
-- 2026-05-10 fix migration (uni_db_v3_fix_view_security_invoker), so
-- the view reverted to definer semantics and Supabase advisor
-- 0010_security_definer_view fired.
--
-- Underlying RLS on institutions / admission_cycles / cycle_dates
-- gates SELECT on fn_is_app_user(), which works for any caller passing
-- the app-user check. Restoring invoker semantics matches the rest of
-- the uni_db view set.

alter view public.v_institutions_for_map set (security_invoker = on);
