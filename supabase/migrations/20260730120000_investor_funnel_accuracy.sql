-- Two corrections to the investor season funnel.
--
-- 1. "Departed" was derived from applications.status = 'completed'. That status
--    is a CRM workflow label, not a record of a student boarding a plane, so a
--    single application marked complete during testing reported one student as
--    having departed for Korea in a season that has not started. Nothing in the
--    schema records departure, so the stage now returns zero like the other
--    untracked stages and is captioned as such in the UI.
--
-- 2. "Signed" counted student_intakes rows directly. Three of those rows point
--    at students whose profile was deleted, leaving the link behind, so the
--    investor saw 7 signed students where staff screens -- which join through
--    profiles -- correctly showed 4. The count now joins profiles too, so a
--    deleted student stops being counted without touching the stale rows.
--
-- "Submitted" keeps its real derivation (applications.submitted_at). No code
-- path writes that column today, so it reads zero, but the derivation is
-- correct and will start working on its own once submission is implemented.
--
-- security_invoker is left unset (default false) so the view keeps running with
-- owner rights and can aggregate tables the investor cannot read, and the
-- investor_can_view_intake() self-gate is preserved.

CREATE OR REPLACE VIEW public.v_investor_season_funnel AS
WITH base AS (
  SELECT
    ik.id AS intake_id,
    (
      SELECT count(*)
      FROM student_intakes si
      JOIN profiles p ON p.user_id = si.student_id
      WHERE si.intake_id = ik.id
    ) AS signed,
    (
      SELECT count(*)
      FROM applications a
      WHERE a.intake_id = ik.id AND a.submitted_at IS NOT NULL
    ) AS submitted
  FROM intakes ik
)
SELECT
  b.intake_id,
  s.stage,
  s.stage_order,
  CASE s.stage_order
    WHEN 1 THEN b.signed
    WHEN 2 THEN 0::bigint
    WHEN 3 THEN b.submitted
    WHEN 4 THEN 0::bigint
    WHEN 5 THEN 0::bigint
    WHEN 6 THEN 0::bigint
    ELSE NULL::bigint
  END AS student_count
FROM base b
CROSS JOIN (
  VALUES
    ('Signed'::text, 1),
    ('Documents Ready'::text, 2),
    ('Submitted'::text, 3),
    ('Offer Received'::text, 4),
    ('Visa Approved'::text, 5),
    ('Departed'::text, 6)
) s(stage, stage_order)
WHERE investor_can_view_intake(b.intake_id);
