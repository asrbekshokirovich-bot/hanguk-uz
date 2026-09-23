-- Run telegram-poll every minute.
--
-- Each run keeps the account's MTProto connection for about 45 seconds and
-- the function answers the cron at once (the work continues in the
-- background), so the request below returns quickly and runs never overlap:
-- telegram_poll_acquire hands the session to one run at a time.
--
-- Authenticated with the service-role JWT from vault, the same way
-- lead-sla-check-1min is.

do $$
declare
  v_jwt text;
begin
  select decrypted_secret into v_jwt
  from vault.decrypted_secrets
  where name = 'uni_db_service_role_jwt';

  if v_jwt is null then
    raise warning 'telegram-poll not scheduled: vault secret uni_db_service_role_jwt is missing';
    return;
  end if;

  perform cron.unschedule('telegram-poll-1min')
  where exists (select 1 from cron.job where jobname = 'telegram-poll-1min');

  perform cron.schedule(
    'telegram-poll-1min',
    '* * * * *',
    format($job$
      select net.http_post(
        url := 'https://lysjdtyanhdfphqyijsr.supabase.co/functions/v1/telegram-poll',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer %s'),
        body := '{}'::jsonb,
        timeout_milliseconds := 30000)
    $job$, v_jwt)
  );
end;
$$;
