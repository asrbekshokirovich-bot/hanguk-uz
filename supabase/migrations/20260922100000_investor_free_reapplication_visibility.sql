-- Free re-application students become visible to the investor, and their
-- earlier-season payment moves with them.
--
-- Two things used to be wrong together. v_investor_applications and
-- v_investor_season_funnel excluded is_free_reapplication students entirely
-- -- a free reapplication is a real student, not a data artifact, and there
-- was no way to show her without also showing her as a full-price signup
-- she is not. Separately, `payments` carries its own `intake_id`,
-- independent of `student_intakes`: when a student was moved to a new
-- season as a free reapplication, her payment record was never moved with
-- her, so the season she actually belongs to under-counted her revenue
-- while the season she left over-counted it -- and the investor could not
-- see either, because the exclusion above hid her from Applications too.
--
-- The fix: let her show, and keep the money where she now is.

-- 1) Backfill: for every student currently flagged free_reapplication, move
--    any payment still sitting in an earlier season's intake into the
--    season she was moved to. One UPDATE, no hardcoded list of names.
--    old_i is comma-joined rather than ON-joined because an UPDATE ... FROM
--    join tree cannot reference the target table (p) inside a nested ON
--    clause -- the comparison to p.intake_id has to live in WHERE instead.
update public.payments p
set intake_id = si.intake_id
from public.student_intakes si
join public.intakes new_i on new_i.id = si.intake_id,
     public.intakes old_i
where si.student_id = p.student_id
  and si.is_free_reapplication
  and old_i.id = p.intake_id
  and p.intake_id <> si.intake_id
  and public.intake_sort_key(old_i.season, old_i.year)
    < public.intake_sort_key(new_i.season, new_i.year);

-- 2) Keep it that way automatically. Staff flips is_free_reapplication from
--    EditStudentDialog; nothing there moves payments, so without this the
--    backfill above would need repeating by hand for every future case.
create or replace function public.move_free_reapplication_payments()
returns trigger
language plpgsql
set search_path = 'public'
as $$
begin
  if not new.is_free_reapplication then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.is_free_reapplication and old.intake_id = new.intake_id then
    return new; -- already handled, nothing changed
  end if;

  update public.payments p
  set intake_id = new.intake_id
  from public.intakes new_i, public.intakes old_i
  where new_i.id = new.intake_id
    and old_i.id = p.intake_id
    and p.student_id = new.student_id
    and p.intake_id <> new.intake_id
    and public.intake_sort_key(old_i.season, old_i.year)
      < public.intake_sort_key(new_i.season, new_i.year);

  return new;
end;
$$;

drop trigger if exists trg_move_free_reapplication_payments on public.student_intakes;
create trigger trg_move_free_reapplication_payments
  after insert or update of is_free_reapplication, intake_id on public.student_intakes
  for each row
  when (new.is_free_reapplication)
  execute function public.move_free_reapplication_payments();

-- 3) Investor visibility: demo stays excluded, free reapplication no longer
--    is. CREATE OR REPLACE keeps the view's OID/grants -- the column list is
--    unchanged, only the WHERE clause loses one condition.
create or replace view public.v_investor_applications as
 SELECT a.id AS application_id,
    a.intake_id,
    sp.full_name AS student_name,
    sp.payment_plan AS plan,
    COALESCE(inst.name_en, inst.name_ko) AS university,
    a.degree_level AS program,
    a.status,
    a.submitted_at,
    a.updated_at,
    CURRENT_DATE - a.updated_at::date AS days_since_movement
   FROM applications a
     LEFT JOIN profiles sp ON sp.user_id = a.student_id
     LEFT JOIN institutions inst ON inst.id = a.institution_id
  WHERE investor_can_view_intake(a.intake_id)
    AND NOT (EXISTS ( SELECT 1 FROM profiles p WHERE p.user_id = a.student_id AND p.is_demo));

create or replace view public.v_investor_season_funnel as
 WITH base AS (
         SELECT ik.id AS intake_id,
            ( SELECT count(*) AS count
                   FROM leads l
                  WHERE l.intake_id = ik.id) AS leads,
            ( SELECT count(*) AS count
                   FROM student_intakes si
                     JOIN profiles p ON p.user_id = si.student_id
                  WHERE si.intake_id = ik.id AND NOT p.is_demo) AS signed,
            ( SELECT count(*) AS count
                   FROM applications a
                  WHERE a.intake_id = ik.id AND a.submitted_at IS NOT NULL AND NOT (EXISTS ( SELECT 1
                           FROM profiles p
                          WHERE p.user_id = a.student_id AND p.is_demo))) AS submitted
           FROM intakes ik
        )
 SELECT b.intake_id,
    s.stage,
    s.stage_order,
        CASE s.stage_order
            WHEN 0 THEN b.leads
            WHEN 1 THEN b.signed
            WHEN 2 THEN 0::bigint
            WHEN 3 THEN b.submitted
            WHEN 4 THEN 0::bigint
            WHEN 5 THEN 0::bigint
            WHEN 6 THEN 0::bigint
            ELSE NULL::bigint
        END AS student_count
   FROM base b
     CROSS JOIN ( VALUES ('Leads'::text,0), ('Signed'::text,1), ('Documents Ready'::text,2), ('Submitted'::text,3), ('Offer Received'::text,4), ('Visa Approved'::text,5), ('Departed'::text,6)) s(stage, stage_order)
  WHERE investor_can_view_intake(b.intake_id);
