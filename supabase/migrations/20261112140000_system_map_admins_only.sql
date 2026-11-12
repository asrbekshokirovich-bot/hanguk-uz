-- The system map is for the people who run the system, not for visitors.
--
-- system_map_nodes (422 rows) and system_map_connections (878) describe the
-- platform from the inside: every screen, hook, table and edge function and
-- what depends on what. Since February both tables carried
--
--   "Public can read …"               for anon          using (true)
--   "Authenticated users can read …"  for authenticated using (true)
--
-- so anybody on the internet could download the whole map with the site's
-- public key — and hanguk.uz/system-map drew it for them without signing in.
-- Students and guests could too.
--
-- Now: owners and admins only (the "Admins can manage …" policy already let
-- them read and edit). The two read policies are narrowed and renamed rather
-- than dropped, so that nothing destructive is in this file; they repeat what
-- "Admins can manage …" grants and may be dropped whenever convenient.

revoke select on public.system_map_nodes, public.system_map_connections from anon;

alter policy "Public can read nodes" on public.system_map_nodes
  to authenticated
  using (
    public.has_role((select auth.uid()), 'owner'::public.app_role)
    or public.has_role((select auth.uid()), 'admin'::public.app_role)
  );
alter policy "Public can read nodes" on public.system_map_nodes
  rename to "Admins can read nodes (was public)";

alter policy "Authenticated users can read nodes" on public.system_map_nodes
  using (
    public.has_role((select auth.uid()), 'owner'::public.app_role)
    or public.has_role((select auth.uid()), 'admin'::public.app_role)
  );
alter policy "Authenticated users can read nodes" on public.system_map_nodes
  rename to "Admins can read nodes";

alter policy "Public can read connections" on public.system_map_connections
  to authenticated
  using (
    public.has_role((select auth.uid()), 'owner'::public.app_role)
    or public.has_role((select auth.uid()), 'admin'::public.app_role)
  );
alter policy "Public can read connections" on public.system_map_connections
  rename to "Admins can read connections (was public)";

alter policy "Authenticated users can read connections" on public.system_map_connections
  using (
    public.has_role((select auth.uid()), 'owner'::public.app_role)
    or public.has_role((select auth.uid()), 'admin'::public.app_role)
  );
alter policy "Authenticated users can read connections" on public.system_map_connections
  rename to "Admins can read connections";
