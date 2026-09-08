-- infra_health: last known state of each infra-health-check probe.
-- One row per check; the edge function alerts only when `state` flips.
create table if not exists public.infra_health (
  "check"      text primary key,
  state        text not null check (state in ('ok','fail')),
  detail       text,
  state_since  timestamptz not null default now(),
  checked_at   timestamptz not null default now()
);

alter table public.infra_health enable row level security;

-- Staff can read the board from the CRM; only the service role writes.
drop policy if exists infra_health_staff_read on public.infra_health;
create policy infra_health_staff_read on public.infra_health
  for select to authenticated
  using (exists (
    select 1 from public.user_roles r
    where r.user_id = auth.uid() and r.role in ('owner','admin')
  ));

-- Hourly probe, offset from channel-health-check (:25) so they don't collide.
select cron.unschedule('infra-health-check-hourly')
  where exists (select 1 from cron.job where jobname = 'infra-health-check-hourly');

select cron.schedule(
  'infra-health-check-hourly',
  '40 * * * *',
  $$
    select net.http_post(
      url := 'https://lysjdtyanhdfphqyijsr.supabase.co/functions/v1/infra-health-check',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'uni_db_service_role_jwt' limit 1)),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000)
  $$
);
