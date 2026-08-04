-- CRM → Leads worklist: persist the next call's goal, author and reasoning.
--
-- `leads.next_follow_up` already carries *when* the next call is due. The
-- redesigned Leads worklist also assigns each lead a next-call *goal*, records
-- whether Hanguk AI or an operator chose it, and keeps the sentence explaining
-- why — so the "Set by Hanguk AI" badge and any manual override survive a
-- reload instead of being recomputed on every page load.
--
-- Additive and nullable: existing rows keep working, and a lead with no plan
-- yet simply falls back to the AI planner's suggestion at render time.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS next_call_goal   text,
  -- 'ai' when Hanguk AI assigned the call, otherwise the operator's user id.
  ADD COLUMN IF NOT EXISTS next_call_set_by text,
  ADD COLUMN IF NOT EXISTS next_call_reason text;

COMMENT ON COLUMN public.leads.next_call_goal IS
  'Goal of the next call, e.g. "Qualify budget & intake". Paired with next_follow_up.';
COMMENT ON COLUMN public.leads.next_call_set_by IS
  'Who scheduled the next call: the literal ''ai'' or the operator''s auth user id.';
COMMENT ON COLUMN public.leads.next_call_reason IS
  'Why this goal and timing were chosen — shown as the "Why Hanguk AI chose this" note.';
