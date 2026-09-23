-- Run the lead SLA watchdog every 2 minutes.
--
-- The threshold it enforces is 10 minutes, not a day, so it needs a much
-- tighter cadence than the hourly channel/infra health jobs — 2 minutes keeps
-- the alert's own latency small next to the SLA it is watching.
--
-- The call carries the service-role JWT from vault, the same way
-- channel-health-check-hourly authenticates itself.

do $$
declare
  v_jwt text;
begin
  select decrypted_secret into v_jwt
  from vault.decrypted_secrets
  where name = 'uni_db_service_role_jwt';

  if v_jwt is null then
    raise warning 'lead-sla-check not scheduled: vault secret uni_db_service_role_jwt is missing';
    return;
  end if;

  perform cron.unschedule('lead-sla-check-2min')
  where exists (select 1 from cron.job where jobname = 'lead-sla-check-2min');

  perform cron.schedule(
    'lead-sla-check-2min',
    '*/2 * * * *',
    format($job$
      select net.http_post(
        url := 'https://lysjdtyanhdfphqyijsr.supabase.co/functions/v1/lead-sla-check',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer %s'),
        body := '{}'::jsonb,
        timeout_milliseconds := 30000)
    $job$, v_jwt)
  );
end;
$$;
