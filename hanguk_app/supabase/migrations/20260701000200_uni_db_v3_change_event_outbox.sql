-- ============================================================================
--  uni_db v3 — change_event_outbox (durable push delivery queue)
--
--  Plan §I-Phase-3 success criterion: "Push notification delivered
--  within 1 hour of a 정정공고 detection in 95% of cases."
--
--  Why outbox + cron rather than Supabase Realtime: if the dispatcher
--  fails to talk to FCM / APNs / web-push, we'd lose the event.
--  The outbox table makes retries safe; the notify-tracked-changes
--  Edge Function runs every minute and is idempotent (rows in
--  status='sending' that don't transition within 5 minutes get reset
--  to 'pending' on the next tick).
--
--  Trigger: when a review_decision lands as action='accepted' on a
--  recruitment-data row, fn_emit_change_event() inserts an outbox
--  row. notify-tracked-changes drains it.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The outbox table
-- ---------------------------------------------------------------------------

create table if not exists public.change_event_outbox (
  id                 uuid primary key default gen_random_uuid(),
  target_table       text not null,                -- 'recruitment_units' etc.
  target_id          uuid not null,
  event_type         text not null,                -- see check below
  payload            jsonb not null default '{}'::jsonb,
  status             text not null default 'pending'
                       check (status in ('pending', 'sending', 'sent',
                                         'failed', 'dead')),
  attempts           int  not null default 0,
  queued_at          timestamptz not null default now(),
  next_attempt_at    timestamptz not null default now(),
  sent_at            timestamptz,
  last_error         text
);

-- A single event_type check keeps the column flexible without the
-- coordinated-rollout pain of a real ENUM. The same set of values
-- gets added to the existing notification_event ENUM in migration
-- 20260701000300 so the Flutter app can switch on a typed enum.
alter table public.change_event_outbox
  drop constraint if exists change_event_outbox_event_type_check;
alter table public.change_event_outbox
  add constraint change_event_outbox_event_type_check
  check (event_type in (
    'recruitment_changed',
    'correction_notice',
    'deadline_within_7d',
    'deadline_within_24h'
  ));

create index if not exists change_event_outbox_pending_idx
  on public.change_event_outbox (status, next_attempt_at)
  where status in ('pending', 'failed');
create index if not exists change_event_outbox_queued_at_idx
  on public.change_event_outbox (queued_at desc);

alter table public.change_event_outbox enable row level security;

-- App users have NO access to the outbox. Reviewers can SELECT for
-- debugging. Service role bypasses RLS.
drop policy if exists change_event_outbox_select_reviewer
  on public.change_event_outbox;
create policy change_event_outbox_select_reviewer on public.change_event_outbox
  for select using (
    coalesce(
      (select role from public.profiles where user_id = auth.uid()),
      'student'
    ) in ('uni_db_reviewer', 'uni_db_admin')
  );

-- ---------------------------------------------------------------------------
-- 2. The trigger that enqueues events from review_decisions
-- ---------------------------------------------------------------------------

create or replace function public.fn_emit_change_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event_type    text;
  v_target_table  text;
  v_payload       jsonb;
begin
  -- Only emit on accepted decisions.
  if new.action <> 'accepted' then
    return new;
  end if;

  -- Determine target_table from the decision row. review_decisions
  -- carries target_table as a column already.
  v_target_table := new.target_table;

  -- Map target_table → event_type. recruitment_units changes are the
  -- common case; correction notices have their own event_type so
  -- the client can render them with different urgency.
  if coalesce((new.payload_diff -> 'is_correction_notice')::boolean, false) then
    v_event_type := 'correction_notice';
  else
    v_event_type := 'recruitment_changed';
  end if;

  -- Build a compact payload for the push body. We keep this small
  -- (< 1 kB) so FCM / APNs / web-push limits aren't a concern.
  v_payload := jsonb_build_object(
    'target_table', v_target_table,
    'target_id',    new.target_id,
    'review_decision_id', new.id,
    'reviewer_user_id', new.reviewer_user_id,
    'reviewed_at', new.reviewed_at
  );

  insert into public.change_event_outbox (
    target_table, target_id, event_type, payload
  ) values (
    v_target_table, new.target_id, v_event_type, v_payload
  );

  return new;
end;
$$;

-- The trigger only attaches if review_decisions exists (Phase 1
-- migration created it). Wrap in DO block so this migration is
-- idempotent even if review_decisions hasn't been created yet on a
-- bare staging shim.
do $$
begin
  if exists (
    select 1 from information_schema.tables
     where table_schema = 'public'
       and table_name = 'review_decisions'
  ) then
    drop trigger if exists trg_emit_change_event on public.review_decisions;
    create trigger trg_emit_change_event
      after insert on public.review_decisions
      for each row execute function public.fn_emit_change_event();
  end if;
end
$$;

comment on table public.change_event_outbox is
  'Durable outbox for push notifications. notify-tracked-changes Edge
   Function drains it every minute. Rows in status=dead have exhausted
   retries and need manual triage.';
