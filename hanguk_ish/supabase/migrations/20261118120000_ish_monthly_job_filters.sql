-- Hanguk Ish: the feed's filters also sort the monthly jobs.
--
-- A03 lists monthly jobs in the same screen as the day shifts, with the same
-- chips (pay, distance, field, time of day). A monthly job now says its field
-- (category, like a business's) and whether it is a day or a night job; the
-- distance uses its lat / lng (already there).

alter table ish.monthly_jobs
  add column category text check (category in ('cafe', 'restaurant', 'retail', 'logistics', 'event', 'office', 'other')),
  add column work_time text check (work_time in ('day', 'night'));

comment on column ish.monthly_jobs.category is 'Field, for the feed''s «Soha» filter; null = not said.';
comment on column ish.monthly_jobs.work_time is 'day (06–18) or night (18–06), for the feed''s «Vaqt» filter; null = either.';
