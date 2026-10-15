-- Push notifications to students when a stage of their application is done.
--
-- The owner's rule (2026-10-15): everyone who installed the app and signed in
-- with their magic code gets a notification after each finished stage —
-- documents collected, online application submitted, offline application
-- (paper documents) posted, and so on.
--
--   * public.student_stage_notifications is the outbox: one row per student,
--     stage and (where it applies) university. The unique index makes each
--     stage notify once; turning a step off before the row is sent removes it.
--   * Triggers fill it:
--       documents_ready       the last required document of the application
--                             pack (src/lib/studentDocSlots.ts) is approved
--       university_offered    staff offer one of the two staff-picked
--                             universities — the student must answer in the app
--       university_confirmed  staff give a university the final confirmation
--       online_submitted      "Onlayn topshirildi" on the Onlayn ariza page
--       offline_sent          the paper documents are posted (Oflayn ariza)
--   * pg_cron calls the notify-student-stages edge function every minute; it
--     sends what has waited at least 30 seconds (so two universities offered
--     together arrive as one notification) in the language of each phone.
--
-- Applied to production on 2026-10-15 through the Supabase connector; kept
-- here so the repo matches.

create table if not exists public.student_stage_notifications (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references auth.users (id) on delete cascade,
  kind           text not null check (kind in (
                   'documents_ready', 'university_offered', 'university_confirmed',
                   'online_submitted', 'offline_sent')),
  institution_id uuid references public.institutions (id) on delete cascade,
  created_at     timestamptz not null default now(),
  sent_at        timestamptz,
  attempts       smallint not null default 0,
  last_error     text
);

create unique index if not exists student_stage_notifications_once
  on public.student_stage_notifications
  (student_id, kind, coalesce(institution_id, '00000000-0000-0000-0000-000000000000'::uuid));

create index if not exists student_stage_notifications_unsent
  on public.student_stage_notifications (created_at)
  where sent_at is null;

alter table public.student_stage_notifications enable row level security;

-- The student may read their own (a later in-app history); only the triggers
-- and the edge function (service role) write.
create policy "student_stage_notifications_read_own" on public.student_stage_notifications
  for select to authenticated
  using (student_id = (select auth.uid()));

create policy "student_stage_notifications_staff_read" on public.student_stage_notifications
  for select to authenticated
  using (
    public.has_role((select auth.uid()), 'owner'::public.app_role) or
    public.has_role((select auth.uid()), 'admin'::public.app_role) or
    public.has_role((select auth.uid()), 'document_handler'::public.app_role)
  );

create or replace function public.enqueue_stage_notification(p_student uuid, p_kind text, p_institution uuid default null)
returns void
language sql
security definer
set search_path = public
as $$
  -- Some legacy rows point at a student with no sign-in account; they can't
  -- receive a push, and must not break the change that fired the trigger.
  insert into public.student_stage_notifications (student_id, kind, institution_id)
  select p_student, p_kind, p_institution
   where exists (select 1 from auth.users u where u.id = p_student)
  on conflict do nothing;
$$;

-- A step undone before its notification went out is not announced.
create or replace function public.withdraw_stage_notification(p_student uuid, p_kind text, p_institution uuid default null)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.student_stage_notifications
   where student_id = p_student and kind = p_kind
     and institution_id is not distinct from p_institution
     and sent_at is null;
$$;

revoke all on function public.enqueue_stage_notification(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.withdraw_stage_notification(uuid, text, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- documents_ready: every required slot's newest upload is approved. Mirrors
-- APPLICATION_PACK_SLOTS (required ones) and matchesSlot() with its legacy
-- aliases in src/lib/translationDocuments.ts.
create or replace function public.student_documents_complete(p_student uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with slots(slot_id, ids) as (
    values
      ('applicant_id_card',    array['applicant_id_card']),
      ('foreign_passport',     array['foreign_passport', 'applicant_passport']),
      ('father_id_card',       array['father_id_card', 'parent_passport']),
      ('mother_id_card',       array['mother_id_card']),
      ('birth_certificate',    array['birth_certificate']),
      ('language_certificate', array['language_certificate']),
      ('photo',                array['photo']),
      ('diploma',              array['diploma'])
  ),
  newest as (
    select s.slot_id,
           (select d.status
              from public.documents d
             where d.student_id = p_student
               and exists (
                 select 1 from unnest(s.ids) as i(id)
                  where strpos(lower(coalesce(d.name, '')), '[' || i.id || ']') > 0
                     or starts_with(lower(regexp_replace(coalesce(d.file_path, ''), '^.*/', '')), i.id || '-')
                     or starts_with(lower(regexp_replace(coalesce(d.file_path, ''), '^.*/', '')), i.id || '.'))
             order by d.created_at desc
             limit 1) as status
      from slots s
  )
  -- A slot with no upload has a null status and must count as missing.
  select bool_and(coalesce(status = 'approved', false)) from newest;
$$;

revoke all on function public.student_documents_complete(uuid) from public, anon;
grant execute on function public.student_documents_complete(uuid) to authenticated, service_role;

create or replace function public.trg_documents_stage_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'approved'
     and (tg_op = 'INSERT' or old.status is distinct from 'approved')
     and new.student_id is not null
     and public.student_documents_complete(new.student_id)
  then
    perform public.enqueue_stage_notification(new.student_id, 'documents_ready');
  end if;
  return null;
end;
$$;

create trigger documents_stage_notification
  after insert or update of status on public.documents
  for each row execute function public.trg_documents_stage_notification();

-- ---------------------------------------------------------------------------
-- university_offered / university_confirmed. The partner slot (rank 3) needs
-- no answer from the student, so it is not "offered" to them.
create or replace function public.trg_choices_stage_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.withdraw_stage_notification(old.student_id, 'university_offered', old.institution_id);
    perform public.withdraw_stage_notification(old.student_id, 'university_confirmed', old.institution_id);
    return null;
  end if;
  if tg_op = 'INSERT' and new.rank <> 3 and new.status = 'offered' then
    perform public.enqueue_stage_notification(new.student_id, 'university_offered', new.institution_id);
  end if;
  if new.status = 'confirmed' and (tg_op = 'INSERT' or old.status is distinct from 'confirmed') then
    perform public.enqueue_stage_notification(new.student_id, 'university_confirmed', new.institution_id);
  end if;
  return null;
end;
$$;

create trigger student_university_choices_stage_notification
  after insert or update of status or delete on public.student_university_choices
  for each row execute function public.trg_choices_stage_notification();

-- ---------------------------------------------------------------------------
-- online_submitted / offline_sent, set and unset on the Onlayn / Oflayn ariza
-- pages.
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
  return null;
end;
$$;

create trigger student_university_submissions_stage_notification
  after insert or update of online_submitted_at, offline_sent_at on public.student_university_submissions
  for each row execute function public.trg_submissions_stage_notification();

-- ---------------------------------------------------------------------------
-- Steps finished before this went live are recorded as already sent, so
-- nobody gets a notification for something done days ago.
insert into public.student_stage_notifications (student_id, kind, sent_at, last_error)
select distinct d.student_id, 'documents_ready', now(), 'backfill'
  from public.documents d
  join auth.users u on u.id = d.student_id
 where public.student_documents_complete(d.student_id)
on conflict do nothing;

insert into public.student_stage_notifications (student_id, kind, institution_id, sent_at, last_error)
select c.student_id, case when c.status = 'confirmed' then 'university_confirmed' else 'university_offered' end,
       c.institution_id, now(), 'backfill'
  from public.student_university_choices c
  join auth.users u on u.id = c.student_id
on conflict do nothing;

insert into public.student_stage_notifications (student_id, kind, institution_id, sent_at, last_error)
select s.student_id, 'online_submitted', s.institution_id, now(), 'backfill'
  from public.student_university_submissions s where s.online_submitted_at is not null
on conflict do nothing;

insert into public.student_stage_notifications (student_id, kind, institution_id, sent_at, last_error)
select s.student_id, 'offline_sent', s.institution_id, now(), 'backfill'
  from public.student_university_submissions s where s.offline_sent_at is not null
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Every minute, same wiring as channel-health-check.
select cron.schedule(
  'notify-student-stages',
  '* * * * *',
  $cron$
    select net.http_post(
      url := 'https://lysjdtyanhdfphqyijsr.supabase.co/functions/v1/notify-student-stages',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'secret_key')),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000)
  $cron$
);
