-- 2026-09-01 audit finding, Stage 2.1 of HEALTH_IMPLEMENTATION_PLAN.md.
--
-- publish_worker.py always inserts admission_cycles with status='unverified'
-- (publish_worker.py:340-ish, "_publish_cycle") and nothing anywhere in the
-- codebase — no worker, no RPC, no trigger — ever promotes a cycle to
-- 'verified'. The only 'verified' rows in production are three institutions
-- from the 2026-05-10 demo seed (20260510112339_uni_db_seed_top3_demo_data.sql).
--
-- Three views filter on status='verified' and are therefore permanently
-- empty for every real, pipeline-published cycle:
--   - v_user_upcoming_deadlines  (the authenticated Flutter deadline tracker)
--   - v_recruitment_for_interview (the university-specific interview add-on)
--   - v_institutions_for_map.next_event_at (a subselect inside the map view)
--
-- Meanwhile the newer guest-facing views (v_guest_approved_admissions,
-- shipped 2026-09-17) filter on `status <> 'superseded'` instead and DO
-- return real data — so the schema currently holds two contradictory
-- definitions of "ready to show," and a LOGGED-IN student's deadline screen
-- is empty while a logged-out guest sees deadlines for the same institution.
--
-- This migration aligns the three stale views to the guest views' existing
-- rule. It changes what these views SELECT, not what any table stores, and
-- exposes no data an authenticated app user (RLS already gates all three
-- behind fn_is_app_user / security_invoker=on) could not already read
-- directly from admission_cycles — it only removes a filter that made three
-- specific reads return nothing.
--
-- Left deliberately alone: 337 of 528 admission_cycles (64%) carry
-- needs_attention=true. This migration does not filter on it — a `verified`
-- status was never actually a quality gate in practice (nothing computed
-- it from data quality), so `needs_attention` remains the one flag that
-- already reflects real per-row quality; a client should surface it as a
-- "needs checking" marker rather than hide the row, matching how the guest
-- views already treat it.
--
-- NOT APPLIED to production by this commit. Prepared for review; the CI
-- migration-replay job (if the audit's Stage 7 fresh-replay fix lands
-- first) and a staging dry-run are the intended path before `supabase db
-- push` / an owner-approved apply_migration call.
--
-- security_invoker=on is restated explicitly on both CREATE OR REPLACE VIEW
-- statements below — a bare CREATE OR REPLACE VIEW clears the prior
-- reloptions if the WITH clause is omitted, which is exactly how a sibling
-- view (v_institutions_for_map) drifted between its guest-open and
-- RLS-respecting states across two migration histories (see
-- AUDIT_RESULTS.md, Phase 4). Both source reloptions were confirmed via
-- pg_class.reloptions against production immediately before writing this.

begin;

create or replace view public.v_user_upcoming_deadlines
with (security_invoker = on) as
select
  utu.user_id,
  i.id as institution_id,
  i.name_ko,
  i.name_en,
  ac.applicant_category,
  ac.cycle_track,
  cd.event_type,
  cd.starts_at,
  cd.notes_ko
from public.user_tracked_universities utu
join public.institutions i on i.id = utu.institution_id
join public.admission_cycles ac
  on ac.institution_id = i.id
  and ac.status <> 'superseded'  -- was: ac.status = 'verified' (never set by the pipeline)
join public.cycle_dates cd on cd.cycle_id = ac.id
where cd.starts_at > now()
  and (utu.applicant_category is null or utu.applicant_category = ac.applicant_category)
order by cd.starts_at;

create or replace view public.v_recruitment_for_interview
with (security_invoker = on) as
select
  i.id as institution_id,
  i.name_ko,
  i.name_en,
  ru.id as recruitment_unit_id,
  ru.faculty_ko,
  ru.department_ko,
  ru.major_track_ko,
  ru.faculty_group,
  ac.id as cycle_id,
  ac.intake_year,
  ac.intake_term,
  ac.cycle_track,
  ac.applicant_category,
  (
    select jsonb_agg(
             jsonb_build_object('event_type', cd.event_type, 'starts_at', cd.starts_at)
             order by cd.starts_at
           )
    from public.cycle_dates cd
    where cd.cycle_id = ac.id
  ) as upcoming_events,
  (
    select jsonb_agg(
             jsonb_build_object(
               'name_ko', s.name_ko, 'name_en', s.name_en,
               'award_type', s.award_type, 'award_value', s.award_value
             )
           )
    from public.scholarships s
    where s.institution_id = i.id
    limit 3
  ) as top_scholarships,
  (
    select jsonb_build_object(
             'topik_min_level', r.topik_min_level, 'english_test', r.english_test,
             'interview_required', r.interview_required, 'prose_ko', r.prose_ko
           )
    from public.requirements r
    where r.cycle_id = ac.id
    limit 1
  ) as requirements_summary
from public.institutions i
join public.admission_cycles ac
  on ac.institution_id = i.id
  and ac.status <> 'superseded'  -- was: ac.status = 'verified' (never set by the pipeline)
join public.recruitment_units ru on ru.institution_id = i.id and ru.is_active = true;

-- v_institutions_for_map's next_event_at subselect carries the same
-- ac.status = 'verified' filter (see AUDIT_RESULTS.md Phase 6), but that
-- view was already touched by two separate migration histories fighting
-- over its security_invoker reloption (root supabase/migrations/20260728140000
-- vs hanguk_app/supabase/migrations/20260914000000) — re-defining it here
-- risks reverting whichever one currently wins in production. It is
-- deliberately left out of this migration; fixing next_event_at needs a
-- prior step establishing which reloption state production actually has
-- (Stage 7's live-schema diff), not a guess made from migration text alone.

commit;
