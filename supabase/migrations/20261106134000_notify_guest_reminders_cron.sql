-- Ushlab qolish rejasi P09: notify-guest-reminders at 05:00 and 14:00 UTC
-- (10:00 and 19:00 Tashkent), same wiring as notify-student-stages. Nothing
-- is sent until NOTIFY_GUEST_ENABLED is set (test, then all).
do $$
begin
  perform cron.unschedule(j) from unnest(array['notify-guest-reminders-am', 'notify-guest-reminders-pm']) j
    where exists (select 1 from cron.job where jobname = j);
end $$;

select cron.schedule('notify-guest-reminders-am', '0 5 * * *', $cron$
  select net.http_post(
    url := 'https://lysjdtyanhdfphqyijsr.supabase.co/functions/v1/notify-guest-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'secret_key')),
    body := '{}'::jsonb, timeout_milliseconds := 60000)
$cron$);

select cron.schedule('notify-guest-reminders-pm', '0 14 * * *', $cron$
  select net.http_post(
    url := 'https://lysjdtyanhdfphqyijsr.supabase.co/functions/v1/notify-guest-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'secret_key')),
    body := '{}'::jsonb, timeout_milliseconds := 60000)
$cron$);
