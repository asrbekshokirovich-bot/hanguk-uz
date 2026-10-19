-- Automatic translation: at most 5 per 24 hours (owner, 2026-10-19).
--
-- The project's GEMINI_API_KEY is on the free tier: 20 gemini-2.5-flash
-- requests a day, shared by every AI feature (Hanguk AI chat, interview
-- practice, lead analysis, document checks, call analysis, the CRM's manual
-- translation...). The backlog of 138 translations used up a whole day's
-- quota on 2026-10-19 and the owner chose to stay on the free tier, so the
-- worker now takes at most 5 a day and leaves the rest to everything else.
--
-- Counted: automatic jobs completed or in progress in the last 24 hours (a
-- rolling window, so no calendar day can see more than 5). Jobs waiting for
-- documents never reach the AI and do not count. The cron call is skipped
-- while the cap is reached, so an idle day costs no function invocations.
--
-- Applied to production on 2026-10-19 through the Supabase connector, and the
-- cron job (paused when the quota ran out) turned back on.

create or replace function public.auto_translation_slots_left(p_daily_limit int default 5)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select greatest(p_daily_limit - count(*)::int, 0)
    from public.translation_jobs
   where auto_triggered
     and (status = 'processing' or (status = 'completed' and completed_at > now() - interval '24 hours'));
$$;

revoke all on function public.auto_translation_slots_left(int) from public, anon, authenticated;
grant execute on function public.auto_translation_slots_left(int) to service_role;

create or replace function public.claim_auto_translation_job(p_max_attempts int default 3)
returns setof public.translation_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.translation_jobs
     set status = 'failed',
         error_message = coalesce(error_message, 'Tarjima vaqtida to''xtab qoldi')
   where auto_triggered
     and status = 'processing'
     and updated_at < now() - interval '15 minutes'
     and attempts >= p_max_attempts;

  -- A job stuck in 'processing' (the worker died) is taken back regardless of
  -- the cap: it already holds one of the day's slots.
  return query
  update public.translation_jobs j
     set status = 'processing', attempts = j.attempts + 1
   where j.id = (
     select id from public.translation_jobs
      where auto_triggered
        and ((status = 'queued'
              and (error_message is null or updated_at < now() - interval '5 minutes')
              and public.auto_translation_slots_left() > 0)
             or (status = 'processing' and updated_at < now() - interval '15 minutes'))
      order by created_at
      limit 1
      for update skip locked)
  returning j.*;
end;
$$;

select cron.unschedule('auto-translate-documents');
select cron.schedule(
  'auto-translate-documents',
  '* * * * *',
  $cron$
    select net.http_post(
      url := 'https://lysjdtyanhdfphqyijsr.supabase.co/functions/v1/auto-translate-documents',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'secret_key')),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000)
     where exists (
       select 1 from public.translation_jobs
        where auto_triggered
          and ((status = 'queued'
                and (error_message is null or updated_at < now() - interval '5 minutes')
                and public.auto_translation_slots_left() > 0)
               or (status = 'processing' and updated_at < now() - interval '15 minutes')))
  $cron$
);
