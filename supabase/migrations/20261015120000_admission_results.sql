-- Admission results on the Onlayn ariza page ("Natijalar" — the results map).
--
-- The owner's choice (2026-10-15): one table shows every student's three
-- choices coloured by result; when a student gets into one or more, staff
-- pick the final university and the student confirms it in the app.
--
--   result               null = waiting, 'accepted' or 'rejected' — set by
--                        staff once the university announces it
--   final_at / final_by  staff marked this university as the student's final
--                        one (at most one per student, only an accepted one)
--   student_confirmed_at the student pressed "Shu universitetga boraman"
--
-- Students get a push for an acceptance and for the final pick (kinds
-- admission_accepted / final_university in student_stage_notifications).
--
-- Applied to production on 2026-10-15 through the Supabase connector; kept
-- here so the repo matches.

alter table public.student_university_submissions
  add column if not exists result text check (result in ('accepted', 'rejected')),
  add column if not exists result_at timestamptz,
  add column if not exists result_by uuid,
  add column if not exists final_at timestamptz,
  add column if not exists final_by uuid,
  add column if not exists student_confirmed_at timestamptz;

alter table public.student_university_submissions
  add constraint student_university_submissions_final_accepted
  check (final_at is null or result = 'accepted');

create unique index if not exists student_university_submissions_one_final
  on public.student_university_submissions (student_id)
  where final_at is not null;

-- New notification kinds.
alter table public.student_stage_notifications
  drop constraint if exists student_stage_notifications_kind_check;
alter table public.student_stage_notifications
  add constraint student_stage_notifications_kind_check check (kind in (
    'documents_ready', 'university_offered', 'university_confirmed',
    'online_submitted', 'offline_sent', 'admission_accepted', 'final_university'));

create or replace function public.trg_submissions_stage_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.online_submitted_at is not null
     and (tg_op = 'INSERT' or old.online_submitted_at is null) then
    perform public.enqueue_stage_notification(new.student_id, 'online_submitted', new.institution_id);
  elsif new.online_submitted_at is null and tg_op = 'UPDATE' and old.online_submitted_at is not null then
    perform public.withdraw_stage_notification(new.student_id, 'online_submitted', new.institution_id);
  end if;

  if new.offline_sent_at is not null
     and (tg_op = 'INSERT' or old.offline_sent_at is null) then
    perform public.enqueue_stage_notification(new.student_id, 'offline_sent', new.institution_id);
  elsif new.offline_sent_at is null and tg_op = 'UPDATE' and old.offline_sent_at is not null then
    perform public.withdraw_stage_notification(new.student_id, 'offline_sent', new.institution_id);
  end if;

  if new.result = 'accepted'
     and (tg_op = 'INSERT' or old.result is distinct from 'accepted') then
    perform public.enqueue_stage_notification(new.student_id, 'admission_accepted', new.institution_id);
  elsif new.result is distinct from 'accepted' and tg_op = 'UPDATE' and old.result = 'accepted' then
    perform public.withdraw_stage_notification(new.student_id, 'admission_accepted', new.institution_id);
  end if;

  if new.final_at is not null
     and (tg_op = 'INSERT' or old.final_at is null) then
    perform public.enqueue_stage_notification(new.student_id, 'final_university', new.institution_id);
  elsif new.final_at is null and tg_op = 'UPDATE' and old.final_at is not null then
    perform public.withdraw_stage_notification(new.student_id, 'final_university', new.institution_id);
  end if;
  return null;
end;
$$;

create or replace trigger student_university_submissions_stage_notification
  after insert or update of online_submitted_at, offline_sent_at, result, final_at
  on public.student_university_submissions
  for each row execute function public.trg_submissions_stage_notification();

-- What the app shows: the student's own results (the table is staff-only).
create or replace function public.my_admission_results()
returns table (
  institution_id uuid,
  result text,
  result_at timestamptz,
  is_final boolean,
  student_confirmed_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select s.institution_id, s.result, s.result_at, s.final_at is not null, s.student_confirmed_at
    from public.student_university_submissions s
   where s.student_id = auth.uid()
     and (s.result is not null or s.final_at is not null);
$$;

-- "Shu universitetga boraman": the student confirms the final university.
create or replace function public.confirm_final_university(p_institution_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.student_university_submissions
     set student_confirmed_at = now(), updated_at = now()
   where student_id = auth.uid()
     and institution_id = p_institution_id
     and final_at is not null;
  if not found then
    raise exception 'Not your final university' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.my_admission_results() from public, anon;
grant execute on function public.my_admission_results() to authenticated;
revoke all on function public.confirm_final_university(uuid) from public, anon;
grant execute on function public.confirm_final_university(uuid) to authenticated;
