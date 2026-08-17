-- ai_content_reports — a student's report of an AI answer they consider wrong,
-- offensive or harmful.
--
-- Why this exists: the app has two open-ended generative surfaces — the Hanguk
-- AI chat and the AI mock interview — and until now there was no way for a
-- student to flag a bad answer. App Review guideline 1.2 expects an app that
-- shows generated content to give the user a mechanism to report objectionable
-- output and the developer a way to act on it. Nothing in the app or the
-- schema provided either.
--
-- It is also simply useful. An AI that tells a student the wrong TOPIK
-- requirement is a consulting problem before it is a policy one, and today
-- nobody finds out.
--
-- Shape of the flow: the student taps "report" under an AI message, optionally
-- says what is wrong, and a row lands here with the text they were looking at.
-- Staff triage it in the CRM. Nothing is deleted or hidden automatically —
-- an automatic takedown on an unreviewed report is its own failure mode.

create table if not exists public.ai_content_reports (
  id               uuid primary key default gen_random_uuid(),

  -- Defaults to the caller so the client cannot file a report as someone
  -- else even if it tries; the RLS check below enforces the same thing.
  reporter_user_id uuid not null default auth.uid()
                     references auth.users(id) on delete cascade,

  -- Which generative surface produced the text. Kept as a checked text
  -- column rather than an enum: new AI surfaces should not need a migration
  -- to be reportable, only a new value here.
  surface          text not null
                     check (surface in ('chat', 'interview', 'study_plan')),

  -- The AI output the student was looking at. Capped because this is
  -- attacker-reachable input from a signed-in client, and an unbounded text
  -- column reachable by insert is a cheap way to fill a 0.5 GB instance.
  reported_text    text not null
                     check (length(btrim(reported_text)) > 0
                            and length(reported_text) <= 8000),

  -- Optional free text from the student. Same reasoning on the cap.
  reason           text check (reason is null or length(reason) <= 2000),

  -- Anything the surface wants to carry — message id, session id, locale.
  -- jsonb rather than columns so a new surface does not need a migration.
  context          jsonb not null default '{}'::jsonb,

  status           text not null default 'open'
                     check (status in ('open', 'reviewed', 'actioned', 'dismissed')),
  created_at       timestamptz not null default now(),
  reviewed_at      timestamptz,
  reviewed_by      uuid references auth.users(id) on delete set null
);

-- Triage order: newest open reports first.
create index if not exists ai_content_reports_open_idx
  on public.ai_content_reports (created_at desc)
  where status = 'open';

create index if not exists ai_content_reports_reporter_idx
  on public.ai_content_reports (reporter_user_id, created_at desc);

alter table public.ai_content_reports enable row level security;

-- A signed-in user files their own reports and sees them back. Seeing them
-- back matters: "did that send?" with no way to check is why people report
-- the same thing four times.
drop policy if exists ai_content_reports_own_insert on public.ai_content_reports;
create policy ai_content_reports_own_insert
  on public.ai_content_reports
  for insert
  to authenticated
  with check (reporter_user_id = auth.uid());

drop policy if exists ai_content_reports_own_select on public.ai_content_reports;
create policy ai_content_reports_own_select
  on public.ai_content_reports
  for select
  to authenticated
  using (reporter_user_id = auth.uid());

-- No student UPDATE or DELETE policy on purpose. A report is a record of what
-- was said at the time; letting the reporter rewrite or withdraw it after
-- staff have started reading turns the queue into something that cannot be
-- trusted.

-- Staff triage. Mirrors institution_notes_staff_all.
drop policy if exists ai_content_reports_staff_all on public.ai_content_reports;
create policy ai_content_reports_staff_all
  on public.ai_content_reports
  as permissive
  for all
  to public
  using (
    has_role(auth.uid(), 'owner'::app_role)
    or has_role(auth.uid(), 'admin'::app_role)
    or has_role(auth.uid(), 'document_handler'::app_role)
  )
  with check (
    has_role(auth.uid(), 'owner'::app_role)
    or has_role(auth.uid(), 'admin'::app_role)
    or has_role(auth.uid(), 'document_handler'::app_role)
  );

comment on table public.ai_content_reports is
  'Student reports of AI-generated answers (chat, mock interview). Required by '
  'App Store guideline 1.2 and triaged by staff in the CRM. Insert-only for the '
  'reporter; no auto-moderation.';
