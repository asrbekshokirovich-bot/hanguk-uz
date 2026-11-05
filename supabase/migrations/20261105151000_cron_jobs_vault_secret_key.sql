-- Xavfsizlik (2026-11-05): lead-sla-check-1min va telegram-poll-1min buyrug'ida
-- service_role JWT ochiq matnda turardi (cron.job jadvalida). Boshqa cron'lar kabi
-- endi vault'dagi `secret_key` `apikey` sarlavhasida yuboriladi.
-- Shart: lead-sla-check va telegram-poll sb_secret kalitni qabul qiladigan versiyada
-- joylangan bo'lishi kerak (shu PR merge qilingach, deploy workflow).
do $$
declare
  v_id bigint;
begin
  select jobid into v_id from cron.job where jobname = 'lead-sla-check-1min';
  if v_id is not null then
    perform cron.alter_job(v_id, command := $cmd$
      select net.http_post(
        url := 'https://lysjdtyanhdfphqyijsr.supabase.co/functions/v1/lead-sla-check',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'secret_key')),
        body := '{}'::jsonb,
        timeout_milliseconds := 30000)
    $cmd$);
  end if;

  select jobid into v_id from cron.job where jobname = 'telegram-poll-1min';
  if v_id is not null then
    perform cron.alter_job(v_id, command := $cmd$
      select net.http_post(
        url := 'https://lysjdtyanhdfphqyijsr.supabase.co/functions/v1/telegram-poll',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'secret_key')),
        body := '{}'::jsonb,
        timeout_milliseconds := 30000)
    $cmd$);
  end if;
end $$;
