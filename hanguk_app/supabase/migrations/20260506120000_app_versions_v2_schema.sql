-- Auto-updater v2 schema upgrade.
-- See: .claude/PRPs/plans/autoupdater-perfect.plan.md (Task 1)
--
-- Adds the columns the new updater needs:
--   sha256              integrity verification of the downloaded artifact
--   size_bytes          progress UI + cellular-data warning
--   release_notes       shown in the update dialog
--   min_supported_version  hard floor; below this, force-update regardless of force_update
--   ios_app_store_url   App Store deep-link (iOS path)
--   channel             stable / beta / canary
--   rollout_percentage  staged rollout dice (0..100)
--   force_full_reinstall one-shot flag for the cert-rotation transition
--
-- Repkeys the table on (id, channel) so we can have separate stable+beta rows
-- per platform.

begin;

alter table public.app_versions
  add column if not exists sha256 text,
  add column if not exists size_bytes bigint,
  add column if not exists release_notes text,
  add column if not exists min_supported_version text,
  add column if not exists ios_app_store_url text,
  add column if not exists channel text not null default 'stable',
  add column if not exists rollout_percentage int not null default 100,
  add column if not exists force_full_reinstall bool not null default false;

-- Replace the (id) primary key with (id, channel).
alter table public.app_versions drop constraint if exists app_versions_pkey;
alter table public.app_versions add primary key (id, channel);

-- Range check on rollout_percentage.
alter table public.app_versions
  drop constraint if exists app_versions_rollout_percentage_check;
alter table public.app_versions
  add constraint app_versions_rollout_percentage_check
  check (rollout_percentage between 0 and 100);

-- Channel value must be one of the known set.
alter table public.app_versions
  drop constraint if exists app_versions_channel_check;
alter table public.app_versions
  add constraint app_versions_channel_check
  check (channel in ('stable', 'beta', 'canary'));

commit;
