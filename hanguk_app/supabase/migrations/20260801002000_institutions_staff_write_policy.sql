-- CRM partner / map-visibility / edit / add / delete on the Universities page
-- returned HTTP 406. Root cause: public.institutions has RLS enabled with only
-- SELECT policies (institutions_app_read, institutions_reviewer_read) and NO
-- INSERT/UPDATE/DELETE policy, so every staff write matched zero rows and
-- PostgREST's .update().select().single() surfaced 406 (0 rows). Table-level
-- write grants for `authenticated` already exist; only the row predicate was
-- missing.
--
-- Mirror the established "Staff can manage admission periods" predicate
-- (owner / admin / document_handler via user_roles) so management writes are
-- allowed for staff and still denied for everyone else.
--
-- Verified on prod (rolled back): the toggle's UPDATE returns 1 row for a real
-- owner (value flips, no 406) and 0 rows for a non-staff user.

drop policy if exists institutions_staff_write on public.institutions;

create policy institutions_staff_write
  on public.institutions
  as permissive
  for all
  to public
  using (
    has_role(auth.uid(), 'owner'::app_role)
    or has_role(auth.uid(), 'admin'::app_role)
    or has_role(auth.uid(), 'document_handler'::app_role)
  )
  with check (
    has_role(auth.uid(), 'owner'::app_role)
    or has_role(auth.uid(), 'admin'::app_role)
    or has_role(auth.uid(), 'document_handler'::app_role)
  );
