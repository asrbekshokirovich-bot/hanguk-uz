-- Signal 4 of the app analytics plan (stage 5): a university offer the
-- student has not answered for 48 hours goes to the documents team (the
-- «offer_unanswered» task, 20261029090000) — and now also to the student, as
-- a push: «Javobingizni kutyapmiz» with the universities, in the phone's
-- language, through the stage outbox notify-student-stages already sends.
-- Once per offer (the outbox's unique index); the push opens the offer
-- screen, and push_opened carries campaign 'offer_reminder'.

alter table public.student_stage_notifications
  drop constraint if exists student_stage_notifications_kind_check;
alter table public.student_stage_notifications
  add constraint student_stage_notifications_kind_check check (kind in (
    'documents_ready', 'university_offered', 'university_confirmed',
    'online_submitted', 'offline_sent', 'admission_accepted', 'final_university',
    'offer_reminder'));

create or replace function public.trg_app_signal_offer_reminder()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
begin
  insert into public.student_stage_notifications (student_id, kind, institution_id)
  select c.student_id, 'offer_reminder', c.institution_id
    from public.student_university_choices c
   where c.student_id = new.user_id
     and c.status = 'offered' and c.responded_at is null
     and c.created_at <= now() - interval '48 hours'
  on conflict do nothing;
  return null;
end;
$$;

revoke all on function public.trg_app_signal_offer_reminder() from public, anon, authenticated;

drop trigger if exists app_signal_offer_reminder on public.app_signals;
create trigger app_signal_offer_reminder
  after insert on public.app_signals
  for each row
  when (new.rule_key = 'offer_unanswered' and new.user_id is not null)
  execute function public.trg_app_signal_offer_reminder();
