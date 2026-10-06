-- "Viza imkoniyatim": the budget question is gone (owner, 2026-10-06).
--
-- The money check is the embassy's own: the KDB deposit in the student's
-- name and the parents' formal income. The yearly cost is still shown on the
-- result, as information only. Only the notes change, so staff editing the
-- rules read what they do.

update public.eligibility_rules
   set note = 'Ishlatilmaydi (2026-10-06 dan byudjet savoli yo''q)', updated_at = now()
 where key in ('budget_penalty', 'budget_kdb_missing_share');
