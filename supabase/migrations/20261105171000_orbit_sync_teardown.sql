-- Orbit moved to its own project; orbit-sync edge function is now a 410 stub
-- (security audit 2026-11-05, owner approved). Remove the CRM→Orbit push
-- trigger first (it posts to orbit_sync_url on every tasks change), then the
-- shared sync secret.
drop trigger if exists trg_orbit_instant_sync on public.tasks;
drop function if exists public.fn_orbit_instant_sync();
delete from public.orbit_sync_config where key in ('sync_secret', 'orbit_sync_url', 'owner_uid');
