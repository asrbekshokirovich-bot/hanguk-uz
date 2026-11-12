-- Hanguk Ish — live updates while an app is open (P11, 2026-11-11).
-- New notifications and chat messages are streamed by Supabase Realtime to
-- the people row-level security lets read them; the apps reload the screens
-- showing server data. Skipped where Realtime is not installed.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table ish.notifications, ish.messages;
  end if;
end
$$;
