-- ============================================================================
--  uni_db v1 — round-robin reviewer assignment
--  Plan §G + plan §K (HITL staffing). The assignment function picks the
--  reviewer with the fewest currently-open assignments and ties break by
--  longest time since last assignment, so load drifts slowly toward
--  fairness without a heavy scheduler.
--
--  Callers: a pg_cron job (Phase 2) or the Edge Function that promotes a
--  review_queue row from 'open' to 'in_review'.
-- ============================================================================

set local search_path = public, pg_catalog;

-- ----------------------------------------------------------------------------
--  fn_pick_next_reviewer — returns the user_id of the next reviewer.
--
--  Excludes admins by default unless `include_admins=true`. Returns NULL
--  when no eligible reviewer exists; the caller leaves the queue row
--  unassigned in that case.
-- ----------------------------------------------------------------------------
create or replace function public.fn_pick_next_reviewer(
  include_admins boolean default false
) returns uuid
language sql
stable
as $$
  with eligible as (
    select p.user_id
      from public.profiles p
     where p.role in ('uni_db_reviewer')
        or (include_admins and p.role = 'admin')
  ),
  load as (
    select e.user_id,
           count(rq.id) filter (
             where rq.status = 'in_review' and rq.assigned_to = e.user_id
           ) as open_assignments,
           max(rd.decided_at) filter (
             where rd.reviewer_id = e.user_id
           ) as last_decision_at
      from eligible e
      left join public.review_queue rq on rq.assigned_to = e.user_id
      left join public.review_decisions rd on rd.reviewer_id = e.user_id
     group by e.user_id
  )
  select user_id
    from load
   order by open_assignments asc nulls first,
            last_decision_at  asc nulls first
   limit 1;
$$;

comment on function public.fn_pick_next_reviewer(boolean) is
  'Plan §G — round-robin reviewer picker. Lowest open count + longest idle wins.';

-- ----------------------------------------------------------------------------
--  fn_claim_review_queue — atomically assign + transition to in_review.
--
--  Returns the review_queue.id assigned, or NULL if the queue is empty
--  or no reviewer is eligible. Uses FOR UPDATE SKIP LOCKED so multiple
--  workers calling concurrently don't double-claim.
-- ----------------------------------------------------------------------------
create or replace function public.fn_claim_review_queue(
  reviewer_id uuid default null,
  priorities  smallint[] default array[1,2,3,4,5]::smallint[]
) returns uuid
language plpgsql
as $$
declare
  v_assignee uuid;
  v_picked   uuid;
begin
  v_assignee := coalesce(reviewer_id, public.fn_pick_next_reviewer());
  if v_assignee is null then
    return null;
  end if;

  with claimed as (
    select rq.id
      from public.review_queue rq
     where rq.status = 'open'
       and rq.priority = any(priorities)
     order by rq.priority asc, rq.created_at asc
     for update skip locked
     limit 1
  )
  update public.review_queue
     set status      = 'in_review',
         assigned_to = v_assignee
   where id in (select id from claimed)
   returning id into v_picked;

  return v_picked;
end $$;

comment on function public.fn_claim_review_queue(uuid, smallint[]) is
  'Plan §G — atomic claim of the next open review_queue item for a reviewer.';

-- ----------------------------------------------------------------------------
--  trg_review_queue_audit — when a review_queue row transitions to a
--  terminal state ('approved'/'rejected'/'escalated'), insert a
--  review_decisions row capturing the diff.
-- ----------------------------------------------------------------------------
create or replace function public.trg_fn_review_queue_audit()
returns trigger
language plpgsql
as $$
declare
  v_decision text;
begin
  if NEW.status not in ('approved','rejected','escalated') then
    return NEW;
  end if;

  -- Map review_queue.status -> review_decisions.decision.
  v_decision := case NEW.status
    when 'approved'  then case
      when NEW.reviewer_decision is not null and NEW.reviewer_decision <> '{}'::jsonb
        then 'approved_with_edits'
      else 'approved_as_is'
    end
    when 'rejected'  then 'rejected'
    when 'escalated' then 'escalated'
  end;

  insert into public.review_decisions (
    review_queue_id, reviewer_id, decision, field_diffs, reviewer_notes
  ) values (
    NEW.id,
    coalesce(NEW.assigned_to, auth.uid()),
    v_decision,
    NEW.reviewer_decision,
    NEW.reviewer_notes
  );

  NEW.resolved_at := now();
  return NEW;
end $$;

drop trigger if exists trg_review_queue_audit on public.review_queue;
create trigger trg_review_queue_audit
  before update on public.review_queue
  for each row
  when (OLD.status is distinct from NEW.status)
  execute function public.trg_fn_review_queue_audit();
