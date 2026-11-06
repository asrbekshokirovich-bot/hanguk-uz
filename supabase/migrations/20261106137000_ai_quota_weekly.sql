-- Ushlab qolish rejasi P18: the guest interview quota counts by week
-- (interview:<user>:<YYYY-Www>), so its ai_quota rows must outlive the
-- 3-day clean-up the daily counters get; they go after 8 days.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'ai-runs-retention') then
    perform cron.unschedule('ai-runs-retention');
  end if;
end $$;

select cron.schedule(
  'ai-runs-retention',
  '23 3 * * *',
  $cron$
    delete from public.ai_runs where created_at < now() - interval '13 months';
    delete from public.ai_quota where created_at < now() - interval '3 days' and key not like 'interview:%';
    delete from public.ai_quota where created_at < now() - interval '8 days' and key like 'interview:%';
  $cron$
);
