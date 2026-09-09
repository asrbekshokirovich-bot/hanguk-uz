-- Run the channel heartbeat every hour.
--
-- Hourly, not every minute: the thing being detected is "a channel has been
-- quiet for a day", so a minute of extra latency costs nothing and an hourly
-- job leaves a readable history in cron.job_run_details. Minute 25 keeps it
-- clear of the other jobs already scheduled on the hour.
--
-- The call carries the service-role JWT from vault, the same way
-- instagram-token-refresh-weekly authenticates itself.

do $$
declare
  v_jwt text;
begin
  select decrypted_secret into v_jwt
  from vault.decrypted_secrets
  where name = 'uni_db_service_role_jwt';

  if v_jwt is null then
    raise warning 'channel-health-check not scheduled: vault secret uni_db_service_role_jwt is missing';
    return;
  end if;

  perform cron.unschedule('channel-health-check-hourly')
  where exists (select 1 from cron.job where jobname = 'channel-health-check-hourly');

  perform cron.schedule(
    'channel-health-check-hourly',
    '25 * * * *',
    format($job$
      select net.http_post(
        url := 'https://lysjdtyanhdfphqyijsr.supabase.co/functions/v1/channel-health-check',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer %s'),
        body := '{}'::jsonb,
        timeout_milliseconds := 30000)
    $job$, v_jwt)
  );
end;
$$;
