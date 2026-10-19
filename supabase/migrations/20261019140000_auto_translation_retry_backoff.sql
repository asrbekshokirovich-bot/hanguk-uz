-- Automatic translation: wait between retries.
--
-- On the first run Gemini answered 503 "model is currently experiencing high
-- demand", and the worker claimed the same job again at once, using all of its
-- attempts within seconds. A job that failed before (error_message set) now
-- waits 5 minutes before it is claimed again; the worker also no longer counts
-- a try the AI service turned away as busy, and stops its run on one.
--
-- Applied to production on 2026-10-19 through the Supabase connector, together
-- with putting the jobs that hit the 503 back in the queue with no attempts.

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

  -- A job that failed before (error_message set) waits 5 minutes before the
  -- next try, so a busy AI service is not hammered and attempts not burned.
  return query
  update public.translation_jobs j
     set status = 'processing', attempts = j.attempts + 1
   where j.id = (
     select id from public.translation_jobs
      where auto_triggered
        and ((status = 'queued' and (error_message is null or updated_at < now() - interval '5 minutes'))
             or (status = 'processing' and updated_at < now() - interval '15 minutes'))
      order by created_at
      limit 1
      for update skip locked)
  returning j.*;
end;
$$;

update public.translation_jobs
   set status = 'queued', attempts = 0
 where auto_triggered and status = 'failed' and error_message like 'AI xizmatida xatolik: 503%';
