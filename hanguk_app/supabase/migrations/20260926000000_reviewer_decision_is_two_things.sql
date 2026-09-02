-- `review_queue.reviewer_decision` holds two unrelated things, and approving
-- a row must not confuse them.
--
--   fn_review_edit_accept / fn_review_save_edit  → a corrected payload
--   fn_review_reject                             → {"reason": ..., "detail": ...}
--
-- Nothing in the schema separates them. That was survivable while
-- `fn_review_accept` nulled the column on every approval — a rejection reason
-- could never outlive the rejection. Migration 20260925000000 removed that
-- null, deliberately, so a correction saved by the new save-without-approving
-- step would survive being approved. It also, accidentally, let a REJECTION
-- REASON survive an approval.
--
-- That matters because publish_worker reads
-- `reviewer_decision or parsed_output`. A row rejected earlier and approved
-- later would hand it `{"reason": "other", "detail": null}` as the payload —
-- publishing an empty calendar for a university that has a full one, with no
-- error anywhere.
--
-- Measured before this migration: 270 rows carry a reason-shaped
-- reviewer_decision (8 rejected, 262 superseded) and one in_review row carries
-- a mixture — a reviewer opened the edit panel on a rejected card, which the
-- UI had seeded from the reason object, and saved. None had been approved, so
-- nothing was published wrong. This closes the window.
--
-- The real cleanup is to stop overloading one column, which means moving
-- rejection reasons to their own field and migrating fn_review_reject,
-- publish_worker and the UI's serverRejection() together. That is a larger
-- change than the bug warrants right now; this makes the dangerous path safe
-- and names the debt.

-- ---------------------------------------------------------------------------
-- What counts as a corrected payload
-- ---------------------------------------------------------------------------
-- A correction carries the field group's items array (`events` for calendar,
-- `rows` for everything else). A rejection reason never does. The UI applies
-- the same rule in reviewLogic.isCorrectionPayload, so what the reviewer sees
-- in the edit panel and what gets published cannot disagree.
create or replace function public.fn_is_correction_payload(payload jsonb)
returns boolean
language sql
immutable
set search_path to 'public', 'pg_catalog'
as $function$
  -- coalesce, and not for tidiness. `payload -> 'events'` on an object with no
  -- such key is SQL NULL, jsonb_typeof(NULL) is NULL, and `NULL = 'array'` is
  -- NULL — so the whole expression returned NULL for exactly the input this
  -- function exists to reject. `if not NULL then raise` never fires, and the
  -- first version of this guard let a rejection reason through while its own
  -- test said it should not.
  select coalesce(
           jsonb_typeof(payload) = 'object'
           -- A top-level `reason` marks a rejection, and stays one even when
           -- an items array got added to it. No extraction payload has one.
           and not (payload ? 'reason')
           and (
                 coalesce(jsonb_typeof(payload -> 'events'), '') = 'array'
              or coalesce(jsonb_typeof(payload -> 'rows'),   '') = 'array'
               ),
           false
         );
$function$;

comment on function public.fn_is_correction_payload(jsonb) is
  'True when a reviewer_decision is a corrected extraction payload rather '
  'than a rejection reason. reviewer_decision carries both; only a payload '
  'has an events[] or rows[] array.';

-- ---------------------------------------------------------------------------
-- Approve keeps a correction, drops a rejection reason
-- ---------------------------------------------------------------------------
create or replace function public.fn_review_accept(
  queue_item_id    uuid,
  reviewer_user_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare
  v_caller uuid := case
                     when auth.role() = 'service_role' then coalesce(reviewer_user_id, auth.uid())
                     else auth.uid()
                   end;
  v_id     uuid;
begin
  if v_caller is null then
    raise exception 'fn_review_accept: no reviewer_user_id and auth.uid() is null';
  end if;

  if not public.fn_can_review_uni_db(v_caller) then
    raise exception 'fn_review_accept: caller % is not authorized to review', v_caller;
  end if;

  update public.review_queue
     set status            = 'approved',
         assigned_to       = v_caller,
         -- Keep a correction (publish_worker will use it); drop anything else,
         -- which in practice means the rejection reason left behind by an
         -- earlier fn_review_reject on this same row.
         reviewer_decision = case
                               when public.fn_is_correction_payload(review_queue.reviewer_decision)
                                 then review_queue.reviewer_decision
                               else null
                             end,
         reviewer_notes    = null
   where id = queue_item_id
     and status in ('open', 'in_review', 'rejected')
   returning id into v_id;

  if v_id is null then
    raise exception 'fn_review_accept: queue item % not found or already approved',
      queue_item_id;
  end if;

  return v_id;
end $function$;

comment on function public.fn_review_accept(uuid, uuid) is
  'Approve a review-queue item. Keeps a corrected payload saved by '
  'fn_review_save_edit and discards a leftover rejection reason — the column '
  'carries both, and publishing a reason as a payload empties the section.';

-- ---------------------------------------------------------------------------
-- Save refuses to write anything that is not a payload
-- ---------------------------------------------------------------------------
-- The UI no longer seeds the editor from a rejection reason, but the RPC is
-- reachable without it, and one bad row already got in this way.
create or replace function public.fn_review_save_edit(
  queue_item_id     uuid,
  corrected_payload jsonb,
  reviewer_user_id  uuid default null,
  reviewer_notes    text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare
  v_caller uuid := case
                     when auth.role() = 'service_role' then coalesce(reviewer_user_id, auth.uid())
                     else auth.uid()
                   end;
  v_notes  text := reviewer_notes;
  v_id     uuid;
begin
  if v_caller is null then
    raise exception 'fn_review_save_edit: no reviewer_user_id and auth.uid() is null';
  end if;

  if corrected_payload is null or corrected_payload = '{}'::jsonb then
    raise exception 'fn_review_save_edit: corrected_payload must be non-empty';
  end if;

  if not public.fn_is_correction_payload(corrected_payload) then
    raise exception
      'fn_review_save_edit: payload has no events[] or rows[] — refusing to '
      'store it in reviewer_decision, which publish_worker reads as the '
      'section''s content';
  end if;

  if not public.fn_can_review_uni_db(v_caller) then
    raise exception 'fn_review_save_edit: caller % is not authorized to review', v_caller;
  end if;

  update public.review_queue
     set status            = 'in_review',
         assigned_to       = v_caller,
         reviewer_decision = corrected_payload,
         reviewer_notes    = coalesce(v_notes, review_queue.reviewer_notes)
   where id = queue_item_id
     and status in ('open', 'in_review', 'rejected')
   returning id into v_id;

  if v_id is null then
    raise exception 'fn_review_save_edit: queue item % not found or already decided',
      queue_item_id;
  end if;

  return v_id;
end $function$;

-- ---------------------------------------------------------------------------
-- Repair the row that already went wrong
-- ---------------------------------------------------------------------------
-- One in_review row holds {reason, detail, events: []} — a reason object the
-- UI seeded, with an empty array added by a Save on the resulting blank form.
-- Its extraction has 19 real events. Clearing the slot restores the card to
-- "no correction saved", which is the truth, and puts parsed_output back in
-- front of the reviewer.
update public.review_queue
   set reviewer_decision = null,
       status            = 'open'
 where status = 'in_review'
   and reviewer_decision ? 'reason'
   and coalesce(jsonb_array_length(reviewer_decision -> 'events'), 0) = 0
   and coalesce(jsonb_array_length(reviewer_decision -> 'rows'),   0) = 0;
