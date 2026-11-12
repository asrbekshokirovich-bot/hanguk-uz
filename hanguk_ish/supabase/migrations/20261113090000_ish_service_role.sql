-- Hanguk Ish — the service role in the `ish` schema (P48, 2026-11-11).
--
-- `ish` lives in hanguk.uz's project. A new schema has none of the grants
-- Supabase gives `public`, and the default privileges set in ish_core cover
-- only what the role running that migration creates. The service role (the
-- edge functions: ish-business-register) needs every table and function here,
-- whoever made it.
grant all on all tables in schema ish to service_role;
grant all on all sequences in schema ish to service_role;
grant execute on all functions in schema ish to service_role;
