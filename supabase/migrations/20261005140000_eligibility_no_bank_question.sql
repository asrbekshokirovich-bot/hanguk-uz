-- "Viza imkoniyatim": the bank statement question is gone (owner, 2026-10-05).
--
-- The money rule now reads the parents' formal income only: income → the
-- fin_both_ok_bonus, no income → at most fin_no_income_cap ("mid"). The
-- fin_none_cap rule (no income and no bank statement) is no longer used.
-- Only the notes change, so staff editing the rules read what they do.

update public.eligibility_rules
   set note = 'Ota-onada rasmiy daromad bor', updated_at = now()
 where key = 'fin_both_ok_bonus';

update public.eligibility_rules
   set note = 'Ota-onada rasmiy daromad yo''q — eng ko''pi o''rta', updated_at = now()
 where key = 'fin_no_income_cap';

update public.eligibility_rules
   set note = 'Ishlatilmaydi (bank spravkasi savoli olib tashlangan)', updated_at = now()
 where key = 'fin_none_cap';
