-- P3 security: public.uni_db_fn_errors had RLS enabled but ZERO policies, so
-- it relied entirely on default-deny (no one — including staff — could read
-- the function-error log, and a future policy mistake would have no backstop).
-- Add an explicit staff-only read policy. The pipeline writes via the
-- service role, which bypasses RLS, so no INSERT policy is needed.
set local search_path = public, pg_catalog;

alter table public.uni_db_fn_errors enable row level security;

drop policy if exists uni_db_fn_errors_staff_read on public.uni_db_fn_errors;
create policy uni_db_fn_errors_staff_read on public.uni_db_fn_errors
  for select to authenticated
  using (public.fn_can_review_uni_db());
