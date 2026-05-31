-- ============================================================================
--  Phase 3 outbox bug fix discovered via end-to-end smoke test
--
--  1. fn_emit_change_event() referenced columns on review_decisions
--     (`action`, `payload_diff`, `target_table`, `target_id`,
--     `reviewer_user_id`, `reviewed_at`) that don't exist on the
--     actual table. Rewritten to use the real columns:
--       decision (not action), field_diffs (not payload_diff),
--       reviewer_id (not reviewer_user_id), decided_at (not reviewed_at)
--     and look up entity_type/entity_id by joining review_queue.
--
--  2. trg_emit_change_event was never installed because the original
--     Phase 3 migration's IF EXISTS guard ran before review_decisions
--     existed (Phase 0/1 ran AFTER Phase 3 due to baseline-first
--     ordering on the rebuilt staging+prod). Trigger now installed
--     unconditionally.
--
--  Applied via Supabase MCP on 2026-05-10 to both projects (versions
--  20260510113020 in supabase_migrations.schema_migrations on each).
-- ============================================================================

create or replace function public.fn_emit_change_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_event_type  text;
  v_entity_type text;
  v_entity_id   uuid;
  v_payload     jsonb;
begin
  -- Only emit on accepted decisions.
  if new.decision not in ('approved_as_is', 'approved_with_edits') then
    return new;
  end if;

  -- review_decisions points at review_queue; look up the entity
  select rq.entity_type, rq.entity_id
    into v_entity_type, v_entity_id
    from public.review_queue rq
   where rq.id = new.review_queue_id;

  if v_entity_type is null then
    -- review_queue row was deleted before the decision committed
    return new;
  end if;

  if coalesce((new.field_diffs -> 'is_correction_notice')::boolean, false) then
    v_event_type := 'correction_notice';
  else
    v_event_type := 'recruitment_changed';
  end if;

  v_payload := jsonb_build_object(
    'target_table',       v_entity_type,
    'target_id',          v_entity_id,
    'review_decision_id', new.id,
    'reviewer_id',        new.reviewer_id,
    'decided_at',         new.decided_at,
    'decision',           new.decision
  );

  insert into public.change_event_outbox (
    target_table, target_id, event_type, payload
  ) values (
    v_entity_type, v_entity_id, v_event_type, v_payload
  );

  return new;
end;
$$;

drop trigger if exists trg_emit_change_event on public.review_decisions;
create trigger trg_emit_change_event
  after insert on public.review_decisions
  for each row execute function public.fn_emit_change_event();

alter function public.fn_emit_change_event() set search_path = public, pg_catalog;
revoke execute on function public.fn_emit_change_event() from anon, authenticated, public;
grant execute on function public.fn_emit_change_event() to service_role;
