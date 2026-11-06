-- B4-2/B4-3 uchun cron: intizom ogohlantirishi (ish kunlari 18:30 Toshkent) va haftalik KPI
-- (shanba 09:00 Toshkent). index.ts'da ?action=report&kind=discipline|kpi allaqachon bor edi,
-- faqat avtomatik chaqiruvi yo'q edi — prod'da qo'llanib tekshirilgan (jobname/schedule mos).

select cron.unschedule('staff-bot-discipline') where exists (select 1 from cron.job where jobname = 'staff-bot-discipline');
select cron.schedule('staff-bot-discipline', '30 13 * * 1-6', $c$
  select net.http_post(
    url := 'https://lysjdtyanhdfphqyijsr.supabase.co/functions/v1/staff-bot?action=report&kind=discipline',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'secret_key')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000)
$c$);

select cron.unschedule('staff-bot-kpi-weekly') where exists (select 1 from cron.job where jobname = 'staff-bot-kpi-weekly');
select cron.schedule('staff-bot-kpi-weekly', '0 4 * * 6', $c$
  select net.http_post(
    url := 'https://lysjdtyanhdfphqyijsr.supabase.co/functions/v1/staff-bot?action=report&kind=kpi',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'secret_key')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000)
$c$);
