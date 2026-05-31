-- ============================================================================
--  uni_db v1 — review_decisions audit log
--  Plan §G.5 — every reviewer action is recorded immutably with the field-
--  level diff. Mirrors `change_events` for HITL provenance but is scoped to
--  the review action (not crawl-detected drift).
--
--  Idempotent (CREATE TABLE IF NOT EXISTS). Service role and the
--  `uni_db_reviewer` role have INSERT; the table is otherwise read-only
--  via RLS so reviewers cannot tamper with their own history.
-- ============================================================================

set local search_path = public, pg_catalog;

create table if not exists public.review_decisions (
  id                  uuid primary key default gen_random_uuid(),
  review_queue_id     uuid not null references public.review_queue(id) on delete cascade,
  reviewer_id         uuid not null references auth.users(id),
  decision            text not null check (decision in (
    'approved_as_is','approved_with_edits','rejected','escalated'
  )),
  field_diffs         jsonb,                              -- [{path,old,new,note}]
  reviewer_notes      text,
  decided_at          timestamptz not null default now()
);

create index if not exists review_decisions_queue_idx
  on public.review_decisions (review_queue_id, decided_at desc);
create index if not exists review_decisions_reviewer_idx
  on public.review_decisions (reviewer_id, decided_at desc);

alter table public.review_decisions enable row level security;

-- Reviewers can read their own audit trail; admins read all.
drop policy if exists review_decisions_owner_select on public.review_decisions;
create policy review_decisions_owner_select on public.review_decisions
  for select using (
    reviewer_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() and p.role = 'admin'
    )
  );

-- Inserts only by reviewers + service_role (service_role bypasses RLS).
drop policy if exists review_decisions_reviewer_insert on public.review_decisions;
create policy review_decisions_reviewer_insert on public.review_decisions
  for insert with check (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.role in ('uni_db_reviewer', 'admin')
    )
  );

-- No UPDATEs / DELETEs from non-service roles. (No policy → denied.)

comment on table public.review_decisions is
  'Plan §G.5 immutable audit log for HITL reviewer decisions. Trigger on review_queue updates writes here.';
