-- Hanguk Ish: the open monthly jobs are on a public page (hanguk.uz/ish).
--
-- Anyone — also signed out — may read the open monthly jobs: they hold only
-- what the staff wrote for workers (title, company, area, pay, schedule,
-- description), no contacts. Closed jobs and everything else stay private;
-- «Qiziqaman» needs a signed-in worker (monthly_applications is unchanged).

create policy monthly_jobs_public_read on ish.monthly_jobs
  for select to anon using (status = 'open');

grant select on ish.monthly_jobs to anon;
