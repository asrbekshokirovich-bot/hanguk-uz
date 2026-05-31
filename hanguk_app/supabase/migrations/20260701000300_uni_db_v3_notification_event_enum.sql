-- ============================================================================
--  uni_db v3 — extend notification_event enum
--
--  The Hanguk app's existing prod schema has a `notification_event`
--  ENUM type used by the existing notifications table. Phase 3 adds
--  four uni_db-specific values so the Flutter client can switch on a
--  typed enum.
--
--  This migration is idempotent and safe to run against:
--    (a) production (where the enum already exists with N pre-uni_db values)
--    (b) staging with a real prod baseline (same shape as prod)
--    (c) staging with the legacy shim baseline (no enum) — we create
--        the type with just the four uni_db values
--
--  Note: ALTER TYPE … ADD VALUE cannot run inside a transaction in
--  some Postgres versions, so we use the IF NOT EXISTS form which
--  Supabase migrations support since CLI 2.40+.
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'notification_event'
  ) then
    create type public.notification_event as enum (
      'recruitment_changed',
      'correction_notice',
      'deadline_within_7d',
      'deadline_within_24h'
    );
  end if;
end
$$;

-- For pre-existing enums on prod, add our four values if they aren't
-- already present. ALTER TYPE … ADD VALUE IF NOT EXISTS is the safe
-- form (Postgres 14+). Each ADD VALUE is its own statement because
-- they cannot be combined.
alter type public.notification_event add value if not exists 'recruitment_changed';
alter type public.notification_event add value if not exists 'correction_notice';
alter type public.notification_event add value if not exists 'deadline_within_7d';
alter type public.notification_event add value if not exists 'deadline_within_24h';
