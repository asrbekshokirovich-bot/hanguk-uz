-- Hanguk Ish — live applications and attendance (P13, 2026-11-11).
-- A new application, a decision, a check-in or check-out and a payment mark
-- reach the open screens of both sides at once: BA1's «미출근» clears when
-- the worker scans in; A06 shows a confirmation without a pull. Row-level
-- security limits each change to the worker and the business's members.
-- Skipped where Realtime is not installed.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.applications;
  end if;
end
$$;
